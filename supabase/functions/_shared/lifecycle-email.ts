// File: supabase/functions/_shared/lifecycle-email.ts
// Deno runtime — NOT Node.js
//
// Shared sender for L1–L7. Used by send-lifecycle-email (sweep + manual)
// and by stripe-webhook (L6, after premium is granted).
//
// Allowlist hard-stop: fetch() to Resend runs only after mayCallResend().
// A skipped row is terminal for the sweep, so opening the allowlist later
// does not backfill people who were already considered.

import {
  MAX_SENDS_PER_SWEEP,
  idempotencyKey,
  isAllowlisted,
  isTemplateKey,
  mayCallResend,
  nextTemplate,
  parseAllowlist,
} from "./lifecycle-rules.js"
import { renderTemplate, resendPayload, safeHttps } from "./lifecycle-templates.js"

// deno-lint-ignore no-explicit-any
type Db = any

const PENDING_LOCK_MS = 15 * 60 * 1000

export interface DeliverResult {
  status: string
  template: string
  providerId?: string | null
  code?: string
}

export interface SweepResult {
  ok: boolean
  code: string | null
  sent: number
  skipped: number
  failed: number
  already: number
  not_configured: number
  deferred: number
  considered: number
}

function truncate(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500)
}

function isUnique(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "")
}

export function isMissingSchema(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false
  const msg = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`
  return /42P01|PGRST202|PGRST205|does not exist|schema cache|lifecycle_email_candidates/i.test(msg)
}

function emptySweep(code: string): SweepResult {
  return {
    ok: false,
    code,
    sent: 0,
    skipped: 0,
    failed: 0,
    already: 0,
    not_configured: 0,
    deferred: 0,
    considered: 0,
  }
}

async function recordSkip(
  db: Db,
  userId: string,
  template: string,
  email: string | null,
  reason: string,
): Promise<"skipped" | "already"> {
  const inserted = await db.from("email_sends").insert({
    user_id: userId,
    template_key: template,
    to_email: email,
    status: "skipped",
    error: reason,
    provider_id: null,
  }).select("id").maybeSingle()
  if (!inserted.error) return "skipped"
  if (!isUnique(inserted.error)) throw inserted.error

  const existing = await db.from("email_sends")
    .select("id, status")
    .eq("user_id", userId)
    .eq("template_key", template)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (!existing.data) return "already"
  if (existing.data.status === "sent" || existing.data.status === "skipped") return "already"

  // pending or failed, and the address is not allowed: close the row.
  // Do not call Resend.
  const updated = await db.from("email_sends").update({
    status: "skipped",
    error: reason,
    to_email: email,
  }).eq("id", existing.data.id).eq("status", existing.data.status).select("id")
  if (updated.error) throw updated.error
  return "skipped"
}

async function claimPending(
  db: Db,
  userId: string,
  template: string,
  email: string,
  reclaimSkipped: boolean,
): Promise<"go" | "stop"> {
  const inserted = await db.from("email_sends").insert({
    user_id: userId,
    template_key: template,
    to_email: email,
    status: "pending",
    error: null,
    provider_id: null,
  }).select("id").maybeSingle()
  if (!inserted.error) return "go"
  if (!isUnique(inserted.error)) throw inserted.error

  const existing = await db.from("email_sends")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("template_key", template)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (!existing.data) return "stop"

  const status = existing.data.status as string
  let canReclaim = false
  if (status === "failed") canReclaim = true
  else if (status === "skipped" && reclaimSkipped) canReclaim = true
  else if (status === "pending") {
    const age = Date.now() - new Date(existing.data.created_at).getTime()
    canReclaim = Number.isFinite(age) && age >= PENDING_LOCK_MS
  }
  if (!canReclaim) return "stop"

  const updated = await db.from("email_sends").update({
    status: "pending",
    error: null,
    to_email: email,
  }).eq("id", existing.data.id).eq("status", status).select("id")
  if (updated.error) throw updated.error
  if (!updated.data?.length) return "stop"
  return "go"
}

async function markPending(
  db: Db,
  userId: string,
  template: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from("email_sends").update(fields)
    .eq("user_id", userId)
    .eq("template_key", template)
    .eq("status", "pending")
  if (error) console.error(`email_sends update failed for ${template}:`, error.message)
}

function firstNameFromUser(user: { user_metadata?: Record<string, unknown> } | null): string | null {
  const meta = user?.user_metadata ?? {}
  const raw = meta.first_name ?? meta.given_name ?? meta.full_name ?? meta.name
  return typeof raw === "string" ? raw : null
}

export async function deliverLifecycleEmail(
  db: Db,
  opts: {
    userId: string
    template: string
    source: string
    reclaimSkipped?: boolean
    profile?: { founding_member?: boolean; plan?: string | null } | null
    allowlistRaw?: string | null
    resendKey?: string | null
    deferSend?: boolean
    l6?: {
      plan?: string | null
      amountCents?: number | null
      currency?: string | null
      receiptUrl?: string | null
    }
  },
): Promise<DeliverResult> {
  const template = opts.template
  if (!isTemplateKey(template)) {
    return { status: "not_eligible", template, code: "BAD_TEMPLATE" }
  }

  try {
    const userRes = await db.auth.admin.getUserById(opts.userId)
    if (userRes.error) {
      if (isMissingSchema(userRes.error)) {
        return { status: "failed", template, code: "MIGRATION_PENDING" }
      }
      console.error(`lifecycle user lookup failed for ${template}:`, userRes.error.message)
      return { status: "no_user", template, code: "USER_NOT_FOUND" }
    }
    const user = userRes.data?.user
    if (!user) return { status: "no_user", template, code: "USER_NOT_FOUND" }

    const email = String(user.email ?? "").trim().toLowerCase()
    let profile = opts.profile ?? null
    if (!profile) {
      const prof = await db.from("user_profiles")
        .select("founding_member, plan")
        .eq("id", opts.userId)
        .maybeSingle()
      if (prof.error) {
        if (isMissingSchema(prof.error)) return { status: "failed", template, code: "MIGRATION_PENDING" }
        console.error("lifecycle profile lookup failed:", prof.error.message)
      } else {
        profile = prof.data
      }
    }

    const l6 = opts.l6 ?? {}
    const rendered = renderTemplate(template, {
      firstName: firstNameFromUser(user),
      foundingMember: profile?.founding_member === true,
      plan: l6.plan ?? profile?.plan ?? null,
      amountCents: l6.amountCents ?? null,
      currency: l6.currency ?? null,
      receiptUrl: l6.receiptUrl ?? null,
    })

    if (!email.includes("@")) {
      const skip = await recordSkip(db, opts.userId, template, email || null, "no_email")
      console.log(`lifecycle ${template} user=${opts.userId} source=${opts.source} status=${skip} reason=no_email`)
      return { status: skip === "already" ? "already" : "skipped", template, code: "no_email" }
    }

    const allowRaw = opts.allowlistRaw ?? Deno.env.get("EMAIL_ALLOWLIST")
    if (!isAllowlisted(email, allowRaw)) {
      const skip = await recordSkip(db, opts.userId, template, email, "allowlist")
      console.log(`lifecycle ${template} user=${opts.userId} source=${opts.source} status=${skip} reason=allowlist`)
      return { status: skip === "already" ? "already" : "skipped", template, code: "allowlist" }
    }

    const resendKey = opts.resendKey ?? Deno.env.get("RESEND_API_KEY") ?? ""
    if (!mayCallResend(email, allowRaw, Boolean(resendKey))) {
      console.log(`lifecycle ${template} user=${opts.userId} source=${opts.source} status=not_configured`)
      return { status: "not_configured", template, code: "NOT_CONFIGURED" }
    }

    if (opts.deferSend) {
      return { status: "deferred", template }
    }

    const claim = await claimPending(db, opts.userId, template, email, opts.reclaimSkipped === true)
    if (claim !== "go") {
      console.log(`lifecycle ${template} user=${opts.userId} source=${opts.source} status=already`)
      return { status: "already", template }
    }

    // Allowlist hard-stop is mayCallResend above. This is the only Resend call.
    const payload = resendPayload(email, rendered)
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey(opts.userId, template),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = truncate(typeof body?.message === "string" ? body.message : `HTTP ${res.status}`)
      await markPending(db, opts.userId, template, { status: "failed", error: message })
      console.error(`lifecycle ${template} user=${opts.userId} source=${opts.source} status=failed`)
      return { status: "failed", template, code: "RESEND" }
    }
    const providerId = typeof body?.id === "string" ? body.id : null
    await markPending(db, opts.userId, template, {
      status: "sent",
      provider_id: providerId,
      error: null,
    })
    console.log(`lifecycle ${template} user=${opts.userId} source=${opts.source} status=sent`)
    return { status: "sent", template, providerId }
  } catch (err) {
    if (isMissingSchema(err as { code?: string; message?: string })) {
      return { status: "failed", template, code: "MIGRATION_PENDING" }
    }
    console.error(`lifecycle ${template} user=${opts.userId} source=${opts.source} error:`, err)
    return { status: "failed", template, code: "DELIVER" }
  }
}

async function fetchStripeReceiptUrl(sessionId: string): Promise<string | null> {
  const key = Deno.env.get("STRIPE_SECRET_KEY")
  if (!key) return null
  try {
    const params = new URLSearchParams()
    params.append("expand[]", "payment_intent.latest_charge")
    params.append("expand[]", "invoice")
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${params}`,
      { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    return safeHttps(data?.payment_intent?.latest_charge?.receipt_url)
      ?? safeHttps(data?.invoice?.hosted_invoice_url)
  } catch (err) {
    console.error("L6 receipt lookup failed:", err)
    return null
  }
}

// Called only after stripe-webhook has granted premium. Never throws.
export async function sendPaidThanks(
  db: Db,
  input: {
    userId: string
    plan: string
    amountCents?: number | null
    currency?: string | null
    receiptUrl?: string | null
    sessionId?: string | null
    paymentStatus?: string | null
  },
): Promise<DeliverResult> {
  if (input.paymentStatus && input.paymentStatus !== "paid") {
    console.log(`L6 not sent: payment_status=${input.paymentStatus}`)
    return { status: "not_eligible", template: "L6", code: "UNPAID" }
  }
  try {
    let receiptUrl = safeHttps(input.receiptUrl ?? null)
    if (!receiptUrl && input.sessionId) {
      receiptUrl = await fetchStripeReceiptUrl(input.sessionId)
    }
    return await deliverLifecycleEmail(db, {
      userId: input.userId,
      template: "L6",
      source: "stripe-webhook",
      reclaimSkipped: false,
      l6: {
        plan: input.plan,
        amountCents: input.amountCents ?? null,
        currency: input.currency ?? null,
        receiptUrl,
      },
    })
  } catch (err) {
    console.error("L6 send failed (premium grant is unchanged):", err)
    return { status: "failed", template: "L6", code: "DELIVER" }
  }
}

function normaliseCandidate(row: Record<string, unknown>) {
  return {
    user_id: String(row.user_id),
    created_at: String(row.created_at),
    trial_ends_at: (row.trial_ends_at as string | null) ?? null,
    is_premium: row.is_premium === true,
    founding_member: row.founding_member === true,
    plan: (row.plan as string | null) ?? null,
    premium_since: (row.premium_since as string | null) ?? null,
    test_count: Number(row.test_count ?? 0),
    first_test_at: (row.first_test_at as string | null) ?? null,
    third_test_at: (row.third_test_at as string | null) ?? null,
  }
}

function bucket(status: string): keyof Omit<SweepResult, "ok" | "code" | "considered"> {
  if (status === "sent" || status === "skipped" || status === "failed" || status === "not_configured" || status === "deferred") {
    return status
  }
  return "already"
}

export async function sweepLifecycleEmails(db: Db): Promise<SweepResult> {
  const now = new Date()
  const rpc = await db.rpc("lifecycle_email_candidates", { p_now: now.toISOString() })
  if (rpc.error) {
    if (isMissingSchema(rpc.error)) return emptySweep("MIGRATION_PENDING")
    console.error("lifecycle sweep candidates failed:", rpc.error.message)
    return emptySweep("SWEEP_FAILED")
  }

  const rows = Array.isArray(rpc.data) ? rpc.data : []
  const ids = rows.map((row: { user_id?: string }) => row.user_id).filter(Boolean)
  const sendsByUser = new Map<string, { template_key: string; status: string; created_at: string }[]>()
  if (ids.length) {
    const sends = await db.from("email_sends")
      .select("user_id, template_key, status, created_at")
      .in("user_id", ids)
    if (sends.error) {
      if (isMissingSchema(sends.error)) return emptySweep("MIGRATION_PENDING")
      console.error("lifecycle sweep history failed:", sends.error.message)
      return emptySweep("SWEEP_FAILED")
    }
    for (const row of sends.data ?? []) {
      const list = sendsByUser.get(row.user_id) ?? []
      list.push(row)
      sendsByUser.set(row.user_id, list)
    }
  }

  const allowlistRaw = Deno.env.get("EMAIL_ALLOWLIST")
  if (parseAllowlist(allowlistRaw).allowAll) {
    console.warn("EMAIL_ALLOWLIST is open (* / ALL). Eligible users can receive lifecycle mail.")
  }
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? ""

  const counts: SweepResult = {
    ok: true,
    code: null,
    sent: 0,
    skipped: 0,
    failed: 0,
    already: 0,
    not_configured: 0,
    deferred: 0,
    considered: 0,
  }

  for (const row of rows) {
    const candidate = normaliseCandidate(row)
    const template = nextTemplate(candidate, sendsByUser.get(candidate.user_id) ?? [], now)
    if (!template) continue
    counts.considered++
    const result = await deliverLifecycleEmail(db, {
      userId: candidate.user_id,
      template,
      source: "sweep",
      reclaimSkipped: false,
      profile: {
        founding_member: candidate.founding_member,
        plan: candidate.plan,
      },
      allowlistRaw,
      resendKey,
      deferSend: counts.sent >= MAX_SENDS_PER_SWEEP,
      l6: template === "L6" ? { plan: candidate.plan } : undefined,
    })
    counts[bucket(result.status)]++
  }

  if (!resendKey && counts.not_configured > 0) {
    counts.ok = false
    counts.code = "NOT_CONFIGURED"
  }
  return counts
}
