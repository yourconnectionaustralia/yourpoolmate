// File: supabase/functions/send-lifecycle-email/index.ts
// Deno runtime — NOT Node.js
//
// Scheduled + manual entry point for L1–L7 lifecycle mail.
// Deploy WITHOUT JWT verification. Callers authenticate with
// LIFECYCLE_CRON_SECRET (GitHub Actions sweep, or a manual test POST).
// The Supabase anon key must not be enough to send mail.
//
//   POST { "action": "sweep" }
//   POST { "action": "send", "template": "L1", "user_id": "<uuid>" }
//   POST { "action": "recurring_sweep" }   weekly test reminder + monthly pool report
//   GET/POST ?u=<signed token>             one-click unsubscribe, no bearer secret
//                                          (the signed token is the credential)
//   POST { "action": "test_series", "email": "<address>" }
//     Sends L1–L7, then a sample weekly reminder and monthly report, to one test
//     account straight away, ignoring timing.
//     The address must be named in EMAIL_ALLOWLIST ("*" does not count).
//
// Allowlist and once-only rules live in _shared/lifecycle-email.ts.
// S1–S3 are not accepted.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { TEMPLATE_KEYS, isExplicitTestRecipient, isTemplateKey } from "../_shared/lifecycle-rules.js"
import { deliverLifecycleEmail, sweepLifecycleEmails } from "../_shared/lifecycle-email.ts"
import { handleUnsubscribe, recurringSweep, sendRecurringSamples } from "../_shared/recurring-email.ts"

const JSON_HEADERS = { "Content-Type": "application/json" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function secretsMatch(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given)
  const b = new TextEncoder().encode(expected)
  if (a.length === 0 || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function authorized(req: Request): boolean {
  const expected = Deno.env.get("LIFECYCLE_CRON_SECRET") ?? ""
  if (!expected) return false
  const header = req.headers.get("authorization") ?? ""
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : ""
  return secretsMatch(token, expected)
}

// Auth users have no email index in the API, so page through. The beta
// base is small; stop after 10,000 accounts.
// deno-lint-ignore no-explicit-any
async function findUserIdByEmail(db: any, email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    // deno-lint-ignore no-explicit-any
    const match = users.find((u: any) => String(u.email ?? "").toLowerCase() === email)
    if (match) return match.id
    if (users.length < 1000) return null
  }
  return null
}

serve(async (req) => {
  // Unsubscribe links come from members' inboxes, so no bearer secret. The
  // HMAC-signed token in ?u= is checked inside handleUnsubscribe.
  if (new URL(req.url).searchParams.has("u") && (req.method === "GET" || req.method === "POST")) {
    if (!(Deno.env.get("LIFECYCLE_CRON_SECRET") ?? "")) return json({ error: "Not configured" }, 503)
    const udb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    try {
      return await handleUnsubscribe(udb, req)
    } catch (err) {
      console.error("unsubscribe failed:", err)
      return json({ error: "Internal error" }, 500)
    }
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }
  if (!(Deno.env.get("LIFECYCLE_CRON_SECRET") ?? "")) {
    console.error("LIFECYCLE_CRON_SECRET is not set")
    return json({ error: "Lifecycle mail is not configured", code: "NOT_CONFIGURED" }, 503)
  }
  if (!authorized(req)) {
    return json({ error: "Unauthorized" }, 401)
  }

  const raw = await req.text()
  if (raw.length > 8000) return json({ error: "Body too large" }, 400)
  let body: Record<string, unknown> = {}
  if (raw.trim()) {
    try {
      body = JSON.parse(raw)
    } catch {
      return json({ error: "Bad JSON" }, 400)
    }
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  try {
    if (body.action === "sweep") {
      const result = await sweepLifecycleEmails(db)
      const status = result.code === "SWEEP_FAILED" ? 500 : 200
      return json(result, status)
    }

    if (body.action === "recurring_sweep") {
      const result = await recurringSweep(db)
      const status = result.code === "SWEEP_FAILED" ? 500 : 200
      return json(result, status)
    }

    if (body.action === "send") {
      const template = body.template
      const userId = body.user_id
      if (!isTemplateKey(template)) {
        return json({ error: "Unknown template", code: "BAD_TEMPLATE" }, 400)
      }
      if (typeof userId !== "string" || !UUID.test(userId)) {
        return json({ error: "user_id must be a uuid", code: "BAD_USER" }, 400)
      }
      const result = await deliverLifecycleEmail(db, {
        userId,
        template,
        source: "manual",
        reclaimSkipped: true,
        l6: template === "L6"
          ? {
            plan: typeof body.plan === "string" ? body.plan : undefined,
            amountCents: typeof body.amount_cents === "number" ? body.amount_cents : undefined,
            currency: typeof body.currency === "string" ? body.currency : undefined,
            receiptUrl: typeof body.receipt_url === "string" ? body.receipt_url : undefined,
          }
          : undefined,
      })
      const status = result.code === "USER_NOT_FOUND"
        ? 404
        : result.code === "MIGRATION_PENDING"
        ? 503
        : 200
      return json({
        ok: result.status === "sent" || result.status === "skipped" || result.status === "already",
        ...result,
      }, status)
    }

    if (body.action === "test_series") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
      if (!isExplicitTestRecipient(email, Deno.env.get("EMAIL_ALLOWLIST"))) {
        return json({
          error: "Test series only goes to an address named in EMAIL_ALLOWLIST",
          code: "NOT_TEST_RECIPIENT",
        }, 403)
      }
      const userId = await findUserIdByEmail(db, email)
      if (!userId) {
        return json({ error: "No account with that email. Sign up in the app first.", code: "USER_NOT_FOUND" }, 404)
      }
      const results = []
      for (const template of TEMPLATE_KEYS) {
        const result = await deliverLifecycleEmail(db, {
          userId,
          template,
          source: "test_series",
          reclaimSkipped: true,
          // L6 is the paid thank-you; show the founding receipt version.
          l6: template === "L6"
            ? { plan: "founding_lifetime", amountCents: 7900, currency: "aud" }
            : undefined,
        })
        results.push(result)
        // Stay well under Resend's 10 requests a second.
        await new Promise((resolve) => setTimeout(resolve, 600))
      }
      await new Promise((resolve) => setTimeout(resolve, 600))
      const samples = await sendRecurringSamples(db, userId)
      for (const sample of samples) results.push({ template: sample.template, status: sample.status })
      return json({ ok: results.every((r) => r.status === "sent" || r.status === "already"), user_id: userId, results })
    }

    return json({ error: "Unknown action", code: "BAD_ACTION" }, 400)
  } catch (err) {
    console.error("send-lifecycle-email failed:", err)
    return json({ error: "Internal error", code: "SERVER_ERROR" }, 500)
  }
})
