// File: supabase/functions/_shared/recurring-email.ts
// Deno runtime — NOT Node.js
//
// Weekly test reminder and monthly pool report. Called by send-lifecycle-email
// with { "action": "recurring_sweep" }, and for the one-click unsubscribe link.
//
// Same gates as L1-L7: the EMAIL_ALLOWLIST hard-stop (mayCallResend) runs
// before any fetch() to Resend, and a ledger row (recurring_email_sends,
// unique per member, kind and period) stops a second send.

import { isAllowlisted, mayCallResend, parseAllowlist } from "./lifecycle-rules.js"
import {
  KINDS,
  MAX_RECURRING_SENDS_PER_SWEEP,
  PENDING_LOCK_MINUTES,
  monthlyDecision,
  signUnsubscribe,
  unsubscribeUrl,
  verifyUnsubscribe,
  weeklyDecision,
} from "./recurring-rules.js"
import { recurringPayload, renderMonthlyReport, renderWeeklyReminder } from "./recurring-templates.js"

// deno-lint-ignore no-explicit-any
type Db = any

export interface RecurringSweepResult {
  ok: boolean
  code: string | null
  sent: number
  skipped: number
  failed: number
  not_configured: number
  deferred: number
  considered: number
}

type Kind = "weekly_reminder" | "monthly_report"

function empty(code: string | null): RecurringSweepResult {
  return { ok: code === null, code, sent: 0, skipped: 0, failed: 0, not_configured: 0, deferred: 0, considered: 0 }
}

function isUnique(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "")
}

function isMissingSchema(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false
  const msg = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`
  return /42P01|PGRST202|PGRST205|42703|does not exist|schema cache|weekly_reminder_candidates|monthly_report_candidates/i.test(msg)
}

function truncate(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500)
}

function firstNameFromUser(user: { user_metadata?: Record<string, unknown> } | null): string | null {
  const meta = user?.user_metadata ?? {}
  const raw = meta.first_name ?? meta.given_name ?? meta.full_name ?? meta.name
  return typeof raw === "string" ? raw : null
}

function unsubBase(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-lifecycle-email`
}

// Insert the ledger row as pending. Returns "go" if this run owns the send.
async function claim(db: Db, userId: string, kind: Kind, periodKey: string, email: string): Promise<"go" | "stop"> {
  const inserted = await db.from("recurring_email_sends").insert({
    user_id: userId, kind, period_key: periodKey, to_email: email, status: "pending",
  }).select("id").maybeSingle()
  if (!inserted.error) return "go"
  if (!isUnique(inserted.error)) throw inserted.error

  const existing = await db.from("recurring_email_sends")
    .select("id, status, created_at")
    .eq("user_id", userId).eq("kind", kind).eq("period_key", periodKey)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (!existing.data) return "stop"

  const status = existing.data.status as string
  let canReclaim = status === "failed"
  if (status === "pending") {
    const age = Date.now() - new Date(existing.data.created_at).getTime()
    canReclaim = Number.isFinite(age) && age >= PENDING_LOCK_MINUTES * 60 * 1000
  }
  if (!canReclaim) return "stop"
  const updated = await db.from("recurring_email_sends")
    .update({ status: "pending", error: null, to_email: email, created_at: new Date().toISOString() })
    .eq("id", existing.data.id).eq("status", status).select("id")
  if (updated.error) throw updated.error
  return updated.data?.length ? "go" : "stop"
}

async function finish(db: Db, userId: string, kind: Kind, periodKey: string, fields: Record<string, unknown>) {
  const { error } = await db.from("recurring_email_sends").update(fields)
    .eq("user_id", userId).eq("kind", kind).eq("period_key", periodKey).eq("status", "pending")
  if (error) console.error(`recurring_email_sends update failed for ${kind}:`, error.message)
}

async function recordSkip(db: Db, userId: string, kind: Kind, periodKey: string, email: string | null, reason: string) {
  const { error } = await db.from("recurring_email_sends").insert({
    user_id: userId, kind, period_key: periodKey, to_email: email, status: "skipped", error: reason,
  })
  if (error && !isUnique(error)) console.error(`recurring skip insert failed for ${kind}:`, error.message)
}

interface Send {
  userId: string
  kind: Kind
  periodKey: string
  email: string
  render: (unsubUrl: string) => ReturnType<typeof renderWeeklyReminder>
  allowlistRaw: string | null | undefined
  resendKey: string
  defer: boolean
}

async function deliver(db: Db, s: Send): Promise<"sent" | "skipped" | "failed" | "not_configured" | "deferred" | "already"> {
  if (!isAllowlisted(s.email, s.allowlistRaw)) {
    await recordSkip(db, s.userId, s.kind, s.periodKey, s.email, "allowlist")
    return "skipped"
  }
  if (!mayCallResend(s.email, s.allowlistRaw, Boolean(s.resendKey))) return "not_configured"
  if (s.defer) return "deferred"

  const secret = Deno.env.get("LIFECYCLE_CRON_SECRET") ?? ""
  if (!secret) return "not_configured"
  if ((await claim(db, s.userId, s.kind, s.periodKey, s.email)) !== "go") return "already"

  try {
    const token = await signUnsubscribe(secret, s.userId, s.kind)
    const url = unsubscribeUrl(unsubBase(), token)
    const rendered = s.render(url)
    const payload = recurringPayload(s.email, rendered, url)
    // Allowlist hard-stop is mayCallResend above. This is the only Resend call.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `recurring-${s.userId}-${s.kind}-${s.periodKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = truncate(typeof body?.message === "string" ? body.message : `HTTP ${res.status}`)
      await finish(db, s.userId, s.kind, s.periodKey, { status: "failed", error: message })
      console.error(`recurring ${s.kind} user=${s.userId} status=failed`)
      return "failed"
    }
    await finish(db, s.userId, s.kind, s.periodKey, {
      status: "sent", provider_id: typeof body?.id === "string" ? body.id : null, error: null,
    })
    console.log(`recurring ${s.kind} user=${s.userId} status=sent`)
    return "sent"
  } catch (err) {
    // A render or network failure must not leave the row stuck as pending.
    await finish(db, s.userId, s.kind, s.periodKey, { status: "failed", error: truncate(String((err as Error)?.message ?? err)) })
    console.error(`recurring ${s.kind} user=${s.userId} error:`, err)
    return "failed"
  }
}

function bucket(counts: RecurringSweepResult, result: string) {
  if (result === "sent" || result === "skipped" || result === "failed" || result === "not_configured" || result === "deferred") {
    counts[result]++
  }
}

async function ledgerFor(db: Db, kind: Kind, periodKey: string, ids: string[]) {
  const map = new Map<string, { status: string; created_at: string }>()
  if (!ids.length) return map
  const res = await db.from("recurring_email_sends")
    .select("user_id, status, created_at")
    .eq("kind", kind).eq("period_key", periodKey).in("user_id", ids)
  if (res.error) throw res.error
  for (const row of res.data ?? []) map.set(row.user_id, row)
  return map
}

export async function recurringSweep(db: Db): Promise<RecurringSweepResult> {
  const now = new Date()
  const counts = empty(null)
  const allowlistRaw = Deno.env.get("EMAIL_ALLOWLIST")
  if (parseAllowlist(allowlistRaw).allowAll) {
    console.warn("EMAIL_ALLOWLIST is open (* / ALL). Eligible members can receive reminders and reports.")
  }
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? ""
  let used = 0 // real sends this run, across both kinds

  try {
    // ── Weekly reminders ───────────────────────────────────
    const weekly = await db.rpc("weekly_reminder_candidates", { p_now: now.toISOString() })
    if (weekly.error) {
      if (isMissingSchema(weekly.error)) return empty("MIGRATION_PENDING")
      console.error("weekly candidates failed:", weekly.error.message)
      return empty("SWEEP_FAILED")
    }
    const wRows = Array.isArray(weekly.data) ? weekly.data : []
    // Cheap pre-filter: only members whose day is today at a sendable hour reach the ledger.
    const todayKey = weeklyDecision({ reminder_day: 0 }, now, null).periodKey
    const wDue = wRows.filter((r: { reminder_day: number; last_test_at: string | null }) =>
      weeklyDecision({ reminder_day: r.reminder_day, last_test_at: r.last_test_at }, now, null).action !== "none")
    const wLedger = await ledgerFor(db, "weekly_reminder", todayKey, wDue.map((r: { user_id: string }) => r.user_id))

    for (const r of wDue) {
      const decision = weeklyDecision(
        { reminder_day: r.reminder_day, last_test_at: r.last_test_at }, now, wLedger.get(r.user_id) ?? null,
      )
      if (decision.action === "none") continue
      counts.considered++
      const userRes = await db.auth.admin.getUserById(r.user_id)
      const user = userRes.data?.user
      const email = String(user?.email ?? "").trim().toLowerCase()
      if (!user || !email.includes("@")) {
        await recordSkip(db, r.user_id, "weekly_reminder", decision.periodKey, email || null, "no_email")
        counts.skipped++
        continue
      }
      if (decision.action === "skip") {
        await recordSkip(db, r.user_id, "weekly_reminder", decision.periodKey, email, decision.reason ?? "skip")
        counts.skipped++
        continue
      }
      const daysSinceTest = r.last_test_at
        ? Math.max(0, Math.floor((now.getTime() - new Date(r.last_test_at).getTime()) / 86400000))
        : NaN
      const result = await deliver(db, {
        userId: r.user_id, kind: "weekly_reminder", periodKey: decision.periodKey, email,
        render: (unsubUrl) => renderWeeklyReminder({
          firstName: firstNameFromUser(user), reminderDay: r.reminder_day,
          daysSinceTest, lastScore: r.last_score ?? NaN, unsubscribeUrl: unsubUrl,
        }),
        allowlistRaw, resendKey, defer: used >= MAX_RECURRING_SENDS_PER_SWEEP,
      })
      if (result === "sent") used++
      bucket(counts, result)
    }

    // ── Monthly report ─────────────────────────────────────
    const first = monthlyDecision(now, null)
    if (first.action !== "none" && first.period) {
      const { period } = first
      const monthly = await db.rpc("monthly_report_candidates", {
        p_from: period.from, p_to: period.to, p_now: now.toISOString(),
      })
      if (monthly.error) {
        if (isMissingSchema(monthly.error)) return { ...counts, ok: false, code: "MIGRATION_PENDING" }
        console.error("monthly candidates failed:", monthly.error.message)
        return { ...counts, ok: false, code: "SWEEP_FAILED" }
      }
      const mRows = Array.isArray(monthly.data) ? monthly.data : []
      const mLedger = await ledgerFor(db, "monthly_report", period.key, mRows.map((r: { user_id: string }) => r.user_id))
      for (const r of mRows) {
        const decision = monthlyDecision(now, mLedger.get(r.user_id) ?? null)
        if (decision.action !== "send") continue
        counts.considered++
        const userRes = await db.auth.admin.getUserById(r.user_id)
        const user = userRes.data?.user
        const email = String(user?.email ?? "").trim().toLowerCase()
        if (!user || !email.includes("@")) {
          await recordSkip(db, r.user_id, "monthly_report", period.key, email || null, "no_email")
          counts.skipped++
          continue
        }
        const result = await deliver(db, {
          userId: r.user_id, kind: "monthly_report", periodKey: period.key, email,
          render: (unsubUrl) => renderMonthlyReport({
            firstName: firstNameFromUser(user), monthName: period.monthName,
            tests: Number(r.tests ?? 0),
            firstScore: r.first_score ?? NaN, lastScore: r.last_score ?? NaN,
            bestScore: r.best_score ?? NaN, lowestScore: r.lowest_score ?? NaN,
            doses: Number(r.doses ?? 0), lastReadings: r.last_readings ?? null,
            unsubscribeUrl: unsubUrl,
          }),
          allowlistRaw, resendKey, defer: used >= MAX_RECURRING_SENDS_PER_SWEEP,
        })
        if (result === "sent") used++
        bucket(counts, result)
      }
    }
  } catch (err) {
    if (isMissingSchema(err as { code?: string; message?: string })) return { ...counts, ok: false, code: "MIGRATION_PENDING" }
    console.error("recurring sweep failed:", err)
    return { ...counts, ok: false, code: "SWEEP_FAILED" }
  }

  if (!resendKey && counts.not_configured > 0) {
    counts.ok = false
    counts.code = "NOT_CONFIGURED"
  }
  return counts
}

// ── One-click unsubscribe ──────────────────────────────────

const PAGE_STYLE = "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:48px auto;padding:0 20px;color:#1a1a1a;font-size:18px;line-height:1.5;"
const BTN_STYLE = "font-size:18px;padding:14px 22px;min-height:48px;border:0;border-radius:8px;background:#0B7799;color:#fff;cursor:pointer;"

function page(title: string, bodyHtml: string, status = 200): Response {
  const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="${PAGE_STYLE}"><h1 style="font-size:24px;">${title}</h1>${bodyHtml}<p style="font-size:15px;color:#555;">Your Pool Mate</p></body></html>`
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}

const LABEL: Record<string, string> = {
  weekly_reminder: "the weekly test reminder",
  monthly_report: "the monthly pool report",
}

// GET shows a confirm button, so a mail scanner opening the link changes nothing.
// POST (the button, or a mail app's one-click) does the unsubscribe.
export async function handleUnsubscribe(db: Db, req: Request): Promise<Response> {
  const secret = Deno.env.get("LIFECYCLE_CRON_SECRET") ?? ""
  const url = new URL(req.url)
  const token = url.searchParams.get("u") ?? ""
  const who = secret ? await verifyUnsubscribe(secret, token) : null
  if (!who || !(KINDS as string[]).includes(who.kind)) {
    return page("That link didn't work", "<p>It may have been cut short. You can turn reminders and reports off any time in the app: Profile, then Reminders. Or reply to the email and we'll do it for you.</p>", 400)
  }
  const what = LABEL[who.kind]

  if (req.method === "GET") {
    return page(
      "Stop these emails?",
      `<p>You'll stop getting ${what}.</p><form method="post" action="${unsubBase()}?u=${encodeURIComponent(token)}"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit" style="${BTN_STYLE}">Yes, stop them</button></form>`,
    )
  }

  const patch = who.kind === "weekly_reminder" ? { reminder_day: null } : { monthly_report: false }
  const { error } = await db.from("user_profiles").update(patch).eq("id", who.userId)
  if (error) {
    console.error("unsubscribe failed:", error.message)
    return page("Something went wrong", "<p>We couldn't save that just now. Please try the link again in a minute, or reply to the email and we'll do it for you.</p>", 500)
  }
  return page(
    "Done",
    `<p>You won't get ${what} any more. You can switch it back on in the app: Profile, then Reminders.</p>`,
  )
}
