// File: supabase/functions/stripe-webhook/index.ts
// Deno runtime — NOT Node.js
//
// Stripe webhook → grants / revokes Your Pool Mate access.
//
// This is the ONLY place is_premium is turned on. It runs as the service
// role (which bypasses RLS and the protect_premium_fields trigger), so a
// user can never grant themselves premium via the API.
//
// Deploy WITHOUT JWT verification (Stripe does not send a Supabase JWT):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Security instead comes from verifying Stripe's signature on every request.
//
// Events handled:
//   checkout.session.completed   → founding lifetime OR first subscription payment: grant premium
//   customer.subscription.updated→ sync status + period end; revoke if no longer active
//   customer.subscription.deleted→ revoke premium
//   invoice.paid                 → renewal: keep premium, extend period end
//   invoice.payment_failed       → mark past_due (kept premium until Stripe cancels)
//
// After a paid checkout, L6 (paid thanks) is sent best-effort. Mail failure
// does not change the premium grant and does not fail the webhook.
//
// Required secrets (Supabase dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY          — sk_live_… / sk_test_…
//   STRIPE_WEBHOOK_SECRET      — whsec_… (from the Stripe webhook endpoint you create)
//   SUPABASE_URL               — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY  — auto-provided

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendPaidThanks } from "../_shared/lifecycle-email.ts"

const SIGNATURE_TOLERANCE_SECONDS = 60 * 5 // reject events older than 5 min

// ── Verify Stripe's signature (Web Crypto — Deno-safe) ───────
// Implements the same scheme as stripe.webhooks.constructEvent:
// signed_payload = `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret,
// compared constant-time against the v1 signature, with a timestamp window.
async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!sigHeader) return false

  const parts: Record<string, string> = {}
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=")
    if (k && v) (parts[k.trim()] ??= v.trim())
  }
  const t = parts["t"]
  const v1 = parts["v1"]
  if (!t || !v1) return false

  // Replay window
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t))
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`))
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")

  // Constant-time compare
  if (expected.length !== v1.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i)
  return diff === 0
}

const admin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

// Resolve the app user id for a subscription-lifecycle event:
// prefer the metadata we stamped at checkout, else look up by customer id.
async function resolveUserId(
  db: ReturnType<typeof admin>,
  metadataUserId: string | undefined,
  customerId: string | undefined,
): Promise<string | null> {
  if (metadataUserId) return metadataUserId
  if (!customerId) return null
  const { data } = await db
    .from("user_profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  return data?.id ?? null
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not set")
    return new Response(JSON.stringify({ error: "not configured" }), { status: 503 })
  }

  const rawBody = await req.text()
  const ok = await verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secret)
  if (!ok) {
    console.warn("stripe-webhook: signature verification failed")
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: "bad payload" }), { status: 400 })
  }

  const db = admin()

  try {
    switch (event.type) {
      // ── Initial purchase (lifetime or first subscription payment) ──
      case "checkout.session.completed": {
        const s = event.data.object
        const userId: string | undefined = s.metadata?.user_id ?? s.client_reference_id
        const plan: string = s.metadata?.plan ?? (s.mode === "subscription" ? "annual" : "founding_lifetime")
        if (!userId) { console.warn("checkout.session.completed with no user_id"); break }

        const update: Record<string, unknown> = {
          is_premium: true,
          plan,
          premium_since: new Date().toISOString(),
          stripe_customer_id: s.customer ?? null,
        }
        if (s.mode === "subscription") {
          update.stripe_subscription_id = s.subscription ?? null
          update.subscription_status = "active"
        }
        const { error } = await db.from("user_profiles").update(update).eq("id", userId)
        if (error) throw error
        console.log(`Granted premium (${plan}) to ${userId}`)
        // L6 is best-effort. A mail failure must not make Stripe retry the grant.
        await sendPaidThanks(db, {
          userId,
          plan,
          amountCents: typeof s.amount_total === "number" ? s.amount_total : null,
          currency: typeof s.currency === "string" ? s.currency : null,
          sessionId: typeof s.id === "string" ? s.id : null,
          paymentStatus: typeof s.payment_status === "string" ? s.payment_status : null,
        })
        break
      }

      // ── Subscription status changes (renew intent, cancel, past_due) ──
      case "customer.subscription.updated": {
        const sub = event.data.object
        const userId = await resolveUserId(db, sub.metadata?.user_id, sub.customer)
        if (!userId) { console.warn("subscription.updated: user unresolved"); break }

        // active/trialing → keep premium; anything else → revoke access.
        const active = sub.status === "active" || sub.status === "trialing"
        const { error } = await db.from("user_profiles").update({
          is_premium: active,
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        }).eq("id", userId)
        if (error) throw error
        console.log(`Subscription ${sub.id} → ${sub.status} (premium=${active}) for ${userId}`)
        break
      }

      // ── Subscription fully ended ──
      case "customer.subscription.deleted": {
        const sub = event.data.object
        const userId = await resolveUserId(db, sub.metadata?.user_id, sub.customer)
        if (!userId) { console.warn("subscription.deleted: user unresolved"); break }
        const { error } = await db.from("user_profiles").update({
          is_premium: false,
          subscription_status: "canceled",
        }).eq("id", userId)
        if (error) throw error
        console.log(`Revoked premium (sub deleted) for ${userId}`)
        break
      }

      // ── Renewal payment succeeded — extend the paid period ──
      case "invoice.paid": {
        const inv = event.data.object
        const customerId: string | undefined = inv.customer
        const userId = await resolveUserId(db, inv.subscription_details?.metadata?.user_id, customerId)
        if (!userId) break
        const periodEnd = inv.lines?.data?.[0]?.period?.end
        const { error } = await db.from("user_profiles").update({
          is_premium: true,
          subscription_status: "active",
          ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
        }).eq("id", userId)
        if (error) throw error
        // First subscription invoice only. Renewals (subscription_cycle) must
        // not send another thanks email. Once-only also blocks a second L6
        // if checkout.session.completed already sent it.
        if (inv.billing_reason === "subscription_create") {
          const hosted = inv.hosted_invoice_url
          await sendPaidThanks(db, {
            userId,
            plan: "annual",
            amountCents: typeof inv.amount_paid === "number" ? inv.amount_paid : null,
            currency: typeof inv.currency === "string" ? inv.currency : null,
            receiptUrl: typeof hosted === "string" ? hosted : null,
            paymentStatus: "paid",
          })
        }
        break
      }

      // ── Renewal payment failed — flag it; Stripe retries then cancels ──
      case "invoice.payment_failed": {
        const inv = event.data.object
        const userId = await resolveUserId(db, inv.subscription_details?.metadata?.user_id, inv.customer)
        if (!userId) break
        const { error } = await db.from("user_profiles")
          .update({ subscription_status: "past_due" }).eq("id", userId)
        if (error) throw error
        break
      }

      default:
        // Unhandled event types are fine — just acknowledge them.
        break
    }
  } catch (err) {
    console.error(`stripe-webhook error handling ${event.type}:`, err)
    // 500 tells Stripe to retry — safe because every handler is idempotent.
    return new Response(JSON.stringify({ error: "handler failed" }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})
