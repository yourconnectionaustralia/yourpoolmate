// File: supabase/functions/stripe-checkout/index.ts
// Deno runtime — NOT Node.js
//
// In-app paywall checkout for Your Pool Mate.
//
// Model (Sep 2026): everyone gets a 30-day free trial. When it ends the user
// pays inside the app to keep access.
//   • First 300 users (founding_member = true)  → $79 AUD once, lifetime  (Stripe mode: payment)
//   • Everyone after that                        → $49 AUD / year          (Stripe mode: subscription)
//
// The caller is ALWAYS an authenticated app user (their trial just expired),
// so this function requires a valid Supabase JWT. Price + plan are decided
// SERVER-SIDE from the user's founding_member flag — never trusted from the
// client — so nobody can talk themselves into the founding rate.
//
// Actions (POST JSON body):
//   { "action": "get_pricing" }
//     → { plan, price_aud, interval, founding, is_premium, trial_ends_at }
//       Drives the paywall screen copy before the user commits.
//
//   { "action": "create_session", "successUrl"?, "cancelUrl"? }
//     → { url }  — Stripe-hosted Checkout URL. The app redirects the browser
//                  there (window.location = url). On success Stripe returns to
//                  successUrl; the stripe-webhook function grants access.
//
// Required secrets (Supabase dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY          — sk_live_… (or sk_test_… while testing)
//   SUPABASE_URL               — auto-provided
//   SUPABASE_ANON_KEY          — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY  — auto-provided
// Optional:
//   APP_URL                    — default success/cancel return target
//                                (default https://app.yourpoolmate.com.au)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" }

// ── Pricing (server-authoritative) ───────────────────────────
const FOUNDING = {
  plan: "founding_lifetime",
  price_aud: 79,
  unit_amount: 7900, // cents
  interval: null as string | null,
  mode: "payment" as const,
  product_name: "Your Pool Mate — Founding Member (Lifetime)",
}
const STANDARD = {
  plan: "annual",
  price_aud: 49,
  unit_amount: 4900, // cents
  interval: "year" as string | null,
  mode: "subscription" as const,
  product_name: "Your Pool Mate — Annual",
}

const DEFAULT_APP_URL = "https://app.yourpoolmate.com.au"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

// Stripe wants application/x-www-form-urlencoded with bracketed nested keys.
function form(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) p.append(k, String(v))
  }
  return p.toString()
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405)
  }

  try {
    // ── 1. Auth — the paywall is only ever hit by a signed-in user ──
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return jsonResponse({ error: "Unauthorised", code: "AUTH_REQUIRED" }, 401)

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: "Unauthorised", code: "INVALID_TOKEN" }, 401)

    // ── 2. Read the user's plan eligibility (service role) ──────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    const { data: profile, error: profileErr } = await admin
      .from("user_profiles")
      .select("is_premium, plan, founding_member, trial_ends_at, stripe_customer_id")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      console.error("stripe-checkout: profile lookup failed:", profileErr)
      return jsonResponse({ error: "Profile not found", code: "NO_PROFILE" }, 404)
    }

    const tier = profile.founding_member ? FOUNDING : STANDARD

    // ── 3. Parse action ────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const action: string = body?.action ?? ""

    if (action === "get_pricing") {
      return jsonResponse({
        plan: tier.plan,
        price_aud: tier.price_aud,
        interval: tier.interval,           // 'year' for standard, null for lifetime
        founding: profile.founding_member,
        is_premium: profile.is_premium,
        trial_ends_at: profile.trial_ends_at,
      })
    }

    if (action !== "create_session") {
      return jsonResponse({ error: "Unknown action", code: "BAD_ACTION" }, 400)
    }

    // Already paid — nothing to sell.
    if (profile.is_premium) {
      return jsonResponse({ error: "Already premium", code: "ALREADY_PREMIUM" }, 409)
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY secret is not set")
      return jsonResponse({ error: "Payments not configured", code: "NOT_CONFIGURED" }, 503)
    }

    const appUrl = Deno.env.get("APP_URL") ?? DEFAULT_APP_URL
    // Only accept a same-app return URL from the client; otherwise fall back.
    const rawSuccess = typeof body?.successUrl === "string" ? body.successUrl : ""
    const rawCancel = typeof body?.cancelUrl === "string" ? body.cancelUrl : ""
    const successUrl = rawSuccess.startsWith(appUrl) ? rawSuccess : appUrl
    const cancelUrl = rawCancel.startsWith(appUrl) ? rawCancel : appUrl

    // ── 4. Build the Checkout Session ──────────────────────────────
    const params: Record<string, string | number | undefined | null> = {
      "mode": tier.mode,
      "success_url": `${successUrl}${successUrl.includes("?") ? "&" : "?"}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": `${cancelUrl}${cancelUrl.includes("?") ? "&" : "?"}checkout=cancelled`,
      "client_reference_id": user.id,
      "allow_promotion_codes": "true",
      // Carry the user id on the session so the webhook knows who paid.
      "metadata[user_id]": user.id,
      "metadata[plan]": tier.plan,
      // Line item — inline price so no Stripe Product/Price setup is required.
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "aud",
      "line_items[0][price_data][unit_amount]": tier.unit_amount,
      "line_items[0][price_data][product_data][name]": tier.product_name,
    }

    // Reuse an existing Stripe customer if we have one; else create by email.
    if (profile.stripe_customer_id) {
      params["customer"] = profile.stripe_customer_id
    } else if (user.email) {
      params["customer_email"] = user.email
    }

    if (tier.mode === "subscription") {
      params["line_items[0][price_data][recurring][interval]"] = tier.interval!
      // Copy the user id onto the subscription so lifecycle events
      // (renewals, cancellations) can be mapped back to the account.
      params["subscription_data[metadata][user_id]"] = user.id
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form(params),
    })
    const session = await stripeRes.json()

    if (!stripeRes.ok) {
      console.error("Stripe session error:", session?.error?.message ?? session)
      return jsonResponse({ error: "Could not start checkout", code: "STRIPE_ERROR" }, 502)
    }

    return jsonResponse({ url: session.url })
  } catch (err) {
    console.error("stripe-checkout unhandled error:", err)
    return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
  }
})
