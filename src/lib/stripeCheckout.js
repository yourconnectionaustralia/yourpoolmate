// In-app Stripe Checkout for signed-in trial users.
//
// The edge function `stripe-checkout` chooses the plan from
// user_profiles.founding_member. The client never sends a plan or a Price ID.
// create_session returns a Stripe-hosted URL; the app navigates there.

const CHECKOUT_HOST = 'checkout.stripe.com'

export function isStripeCheckoutUrl(url) {
  if (typeof url !== 'string' || !url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === CHECKOUT_HOST
  } catch {
    return false
  }
}

// Map edge-function error codes to short Australian English.
// Do not surface Stripe's own message — it can include account detail.
export function checkoutErrorMessage(detail) {
  switch (detail?.code) {
    case 'ALREADY_PREMIUM':
      return "You're already on a paid plan."
    case 'NOT_CONFIGURED':
      return "Payments aren't available just yet. Try again shortly."
    case 'AUTH_REQUIRED':
    case 'INVALID_TOKEN':
      return 'Please sign in again, then try claiming access.'
    case 'NO_PROFILE':
      return "We couldn't find your account. Sign in again and retry."
    default:
      return "Couldn't open checkout. Check your connection and try again."
  }
}

async function readInvokeError(error) {
  if (!error) return null
  const ctx = error.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = typeof ctx.clone === 'function' ? await ctx.clone().json() : await ctx.json()
      if (body && typeof body === 'object') return body
    } catch {
      /* non-JSON error body */
    }
  }
  if (ctx && typeof ctx === 'object' && (ctx.code || ctx.error)) return ctx
  return null
}

/**
 * Ask stripe-checkout which plan this signed-in user can buy.
 * Returns null when the request fails — the paywall can still call
 * create_session, and the server will pick the plan.
 */
export async function fetchCheckoutPricing(client) {
  const { data, error } = await client.functions.invoke('stripe-checkout', {
    body: { action: 'get_pricing' },
  })
  if (error || !data || typeof data.price_aud !== 'number' || !data.plan) return null
  return {
    plan: data.plan,
    price_aud: data.price_aud,
    interval: data.interval ?? null,
    founding: data.founding === true || data.plan === 'founding_lifetime',
  }
}

/**
 * Create a Checkout Session and return its URL.
 * Sends only action + optional return URLs. Plan and price stay server-side.
 */
export async function createCheckoutSession(client, { successUrl, cancelUrl } = {}) {
  const body = { action: 'create_session' }
  if (typeof successUrl === 'string' && successUrl) body.successUrl = successUrl
  if (typeof cancelUrl === 'string' && cancelUrl) body.cancelUrl = cancelUrl

  const { data, error } = await client.functions.invoke('stripe-checkout', { body })
  if (error) {
    const detail = await readInvokeError(error)
    const err = new Error(checkoutErrorMessage(detail))
    err.code = detail?.code || 'CHECKOUT_FAILED'
    throw err
  }
  if (data?.error) {
    const err = new Error(checkoutErrorMessage(data))
    err.code = data.code || 'CHECKOUT_FAILED'
    throw err
  }
  const url = data?.url
  if (!isStripeCheckoutUrl(url)) {
    const err = new Error("Checkout didn't return a payment link. Try again in a moment.")
    err.code = 'BAD_CHECKOUT_URL'
    throw err
  }
  return url
}

/** Paywall / profile copy driven by get_pricing. Unknown plan stays price-neutral. */
export function offerCopy(pricing) {
  if (!pricing) {
    return {
      known: false,
      founding: false,
      priceLabel: null,
      priceNote: 'Checking the price on your account…',
      expiredBody:
        "You've had 30 days to see what Your Pool Mate can do. Keep your Health Score, dosing guide, and warranty record.",
      claimLabel: 'Continue to checkout',
      profileLabel: 'Continue to checkout',
      profileDetail: null,
      footnote: 'First 300 members: $79 AUD lifetime · then $49/year AUD',
    }
  }

  const price = pricing.price_aud
  if (pricing.founding) {
    return {
      known: true,
      founding: true,
      priceLabel: `$${price}`,
      priceNote: 'AUD · one-off · yours forever',
      expiredBody:
        "You've had 30 days to see what Your Pool Mate can do. Keep going — claim founding access at the lowest price we'll ever offer.",
      claimLabel: 'Claim founding access',
      profileLabel: `Claim founding access — $${price}`,
      profileDetail: `Your founding place is $${price} AUD, once — lifetime access.`,
      footnote: 'Founding access is a one-off payment, locked to your account at signup.',
    }
  }

  return {
    known: true,
    founding: false,
    priceLabel: `$${price}`,
    priceNote: 'AUD · per year · cancel any time',
    expiredBody:
      "You've had 30 days to see what Your Pool Mate can do. Keep your Health Score, dosing guide, and warranty record.",
    claimLabel: `Continue for $${price} a year`,
    profileLabel: `Continue — $${price} a year`,
    profileDetail: `When your trial ends, access continues at $${price} AUD a year.`,
    footnote: `Your account continues at $${price} AUD a year. Founding lifetime places are the first 300 members only.`,
  }
}
