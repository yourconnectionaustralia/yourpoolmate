// File: supabase/functions/_shared/delete-account.ts
// Deno runtime — NOT Node.js
//
// Deletes a member's account and everything tied to it. Order matters:
//   1. cancel any live Stripe subscription (so nobody keeps being billed with no account)
//   2. delete their photos from storage (printouts, and the old test-photos bucket)
//   3. delete feedback and suggestions they sent (those rows would otherwise be kept)
//   4. delete the auth user. Foreign keys cascade to profile, pool, tests,
//      equipment, events, email history and reminder history.
// Any failure stops the run and reports which step. Every step is safe to run
// again, so "try again" is always the answer.

// deno-lint-ignore no-explicit-any
type Db = any

export type DeleteResult =
  | { ok: true }
  | { ok: false; code: "STRIPE" | "STORAGE" | "DATA" | "USER"; message: string }

interface Opts {
  stripeKey?: string | null
  fetchFn?: typeof fetch
}

// One folder per member in each bucket: <bucket>/<user_id>/...
// test-photos is no longer used by the app, but an old file may still sit in it,
// and the bucket may be deleted from the dashboard later, so a missing one is fine.
const BUCKETS: { name: string; optional: boolean }[] = [
  { name: "printouts", optional: false },
  { name: "test-photos", optional: true },
]

async function cancelSubscription(subId: string, key: string, fetchFn: typeof fetch): Promise<void> {
  const headers = { Authorization: `Bearer ${key}` }
  const url = `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`
  const got = await fetchFn(url, { headers, signal: AbortSignal.timeout(8000) })
  if (got.status === 404) return // already gone
  if (!got.ok) throw new Error(`Stripe lookup HTTP ${got.status}`)
  const sub = await got.json().catch(() => ({}))
  if (sub?.status === "canceled") return
  const del = await fetchFn(url, { method: "DELETE", headers, signal: AbortSignal.timeout(8000) })
  if (!del.ok && del.status !== 404) throw new Error(`Stripe cancel HTTP ${del.status}`)
}

async function removePhotos(db: Db, bucket: string, userId: string, optional: boolean): Promise<void> {
  // List in pages until it is empty, so nothing is left however many photos there are.
  for (let round = 0; round < 50; round++) {
    const list = await db.storage.from(bucket).list(userId, { limit: 100 })
    if (list.error) {
      if (optional && /not found/i.test(String(list.error.message ?? ""))) return
      throw list.error
    }
    const names = (list.data ?? []).map((f: { name: string }) => `${userId}/${f.name}`)
    if (!names.length) return
    const removed = await db.storage.from(bucket).remove(names)
    if (removed.error) throw removed.error
  }
  throw new Error("Too many photos to remove in one run")
}

export async function deleteAccount(
  db: Db,
  user: { id: string; email?: string | null },
  opts: Opts = {},
): Promise<DeleteResult> {
  const fetchFn = opts.fetchFn ?? fetch

  // 1. Stripe
  try {
    const prof = await db.from("user_profiles")
      .select("stripe_subscription_id, subscription_status")
      .eq("id", user.id).maybeSingle()
    // Column missing (migration 014 not applied) means no subscriptions exist.
    const missing = prof.error && /42703|does not exist/i.test(`${prof.error.code} ${prof.error.message}`)
    if (prof.error && !missing) throw prof.error
    const subId = prof.data?.stripe_subscription_id as string | null | undefined
    if (subId) {
      if (!opts.stripeKey) throw new Error("A subscription exists but Stripe is not configured")
      await cancelSubscription(subId, opts.stripeKey, fetchFn)
    }
  } catch (err) {
    console.error("delete-account: stripe step failed:", (err as Error).message)
    return { ok: false, code: "STRIPE", message: "We couldn't cancel your subscription, so nothing was deleted." }
  }

  // 2. Photos
  try {
    for (const b of BUCKETS) await removePhotos(db, b.name, user.id, b.optional)
  } catch (err) {
    console.error("delete-account: storage step failed:", (err as Error).message)
    return { ok: false, code: "STORAGE", message: "We couldn't remove your saved photos, so your account was not deleted yet." }
  }

  // 3. Feedback and suggestions they sent
  try {
    const a = await db.from("feedback").delete().eq("user_id", user.id)
    if (a.error) throw a.error
    const s = await db.from("suggestions").delete().eq("user_id", user.id)
    if (s.error) throw s.error
    const email = String(user.email ?? "").trim().toLowerCase()
    if (email) {
      // ilike treats _ and % as wildcards: escape them so an address like
      // "a_b@x.com" can only ever match itself, never someone else's rows.
      const literal = email.replace(/[\\%_]/g, (c) => "\\" + c)
      const b = await db.from("feedback_rounds").delete().ilike("submitted_by", literal)
      if (b.error) throw b.error
      const c = await db.from("suggestions").delete().ilike("user_email", literal)
      if (c.error) throw c.error
    }
  } catch (err) {
    console.error("delete-account: feedback step failed:", (err as Error).message)
    return { ok: false, code: "DATA", message: "We couldn't remove everything, so your account was not deleted yet." }
  }

  // 4. The account itself
  const res = await db.auth.admin.deleteUser(user.id)
  if (res.error) {
    console.error("delete-account: deleteUser failed:", res.error.message)
    return { ok: false, code: "USER", message: "We couldn't finish deleting your account." }
  }
  return { ok: true }
}
