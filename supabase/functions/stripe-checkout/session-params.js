// Pure Checkout Session parameter builder for stripe-checkout.
// No network, no Deno APIs. Imported by the edge function and by node:test.
//
// Stripe line items take one of `price` or `price_data`, never both
// (https://docs.stripe.com/api/checkout/sessions/create). A catalog Price
// already carries currency, amount, and — for the annual plan — the interval.

export const FOUNDING = {
  plan: "founding_lifetime",
  price_aud: 79,
  unit_amount: 7900, // cents
  interval: null,
  mode: "payment",
  product_name: "Your Pool Mate — Founding Member (Lifetime)",
  price_env: "STRIPE_PRICE_FOUNDING",
  // Proposal, awaiting James: no promo codes on the $79 founding payment.
  allow_promotion_codes: false,
}

export const STANDARD = {
  plan: "annual",
  price_aud: 49,
  unit_amount: 4900, // cents
  interval: "year",
  mode: "subscription",
  product_name: "Your Pool Mate — Annual",
  price_env: "STRIPE_PRICE_ANNUAL",
  // Proposal, awaiting James: promo codes allowed on the $49 annual plan.
  allow_promotion_codes: true,
}

/**
 * @param {typeof FOUNDING | typeof STANDARD} tier
 * @param {{
 *   priceId: string | null,
 *   successUrl: string,
 *   cancelUrl: string,
 *   userId: string,
 *   stripeCustomerId?: string | null,
 *   email?: string | null,
 * }} opts
 * @returns {Record<string, string | number>}
 */
export function buildSessionParams(tier, opts) {
  const { successUrl, cancelUrl, userId, priceId, stripeCustomerId, email } = opts

  /** @type {Record<string, string | number>} */
  const params = {
    mode: tier.mode,
    success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${cancelUrl}${cancelUrl.includes("?") ? "&" : "?"}checkout=cancelled`,
    client_reference_id: userId,
    // Checkout Studio settings (hosted page look + fields collected).
    // ui_mode hosted_page is the documented default; kept explicitly.
    ui_mode: "hosted_page",
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false",
    "automatic_tax[enabled]": "false",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
    "branding_settings[background_color]": "#ffffff",
    "branding_settings[button_color]": "#0b7799",
    "branding_settings[font_family]": "default",
    "branding_settings[border_style]": "rounded",
    "metadata[user_id]": userId,
    "metadata[plan]": tier.plan,
    "line_items[0][quantity]": 1,
  }

  // Omit the key when the tier does not allow codes. Stripe treats a missing
  // allow_promotion_codes as off.
  if (tier.allow_promotion_codes === true) {
    params.allow_promotion_codes = "true"
  }

  if (priceId) {
    // Catalog Price already carries currency, amount, and (for annual) interval.
    params["line_items[0][price]"] = priceId
  } else {
    // No catalog Price configured — inline amounts so a deploy without the
    // price secrets still checks out at $79 once / $49 per year.
    params["line_items[0][price_data][currency]"] = "aud"
    params["line_items[0][price_data][unit_amount]"] = tier.unit_amount
    params["line_items[0][price_data][product_data][name]"] = tier.product_name
    if (tier.mode === "subscription") {
      params["line_items[0][price_data][recurring][interval]"] = tier.interval
    }
  }

  if (stripeCustomerId) {
    params.customer = stripeCustomerId
  } else if (email) {
    params.customer_email = email
  }

  // Payment mode only. Subscription sessions omit submit_type so Stripe
  // uses its subscribe label.
  if (tier.mode === "payment") {
    params.submit_type = "pay"
  }

  if (tier.mode === "subscription") {
    params.payment_method_collection = "always"
    // Do not set price_data recurring interval here. That belongs only on
    // the inline fallback above. A catalog price line that also carries
    // price_data is rejected by Stripe.
    // Copy the user id onto the subscription so lifecycle events
    // (renewals, cancellations) can be mapped back to the account.
    params["subscription_data[metadata][user_id]"] = userId
  }

  return params
}
