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
//
// Allowlist and once-only rules live in _shared/lifecycle-email.ts.
// S1–S3 are not accepted.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { isTemplateKey } from "../_shared/lifecycle-rules.js"
import { deliverLifecycleEmail, sweepLifecycleEmails } from "../_shared/lifecycle-email.ts"

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

serve(async (req) => {
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

    return json({ error: "Unknown action", code: "BAD_ACTION" }, 400)
  } catch (err) {
    console.error("send-lifecycle-email failed:", err)
    return json({ error: "Internal error", code: "SERVER_ERROR" }, 500)
  }
})
