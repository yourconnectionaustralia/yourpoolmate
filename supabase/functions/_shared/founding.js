// Founding offer: the first 300 PAID members get $79 lifetime, then $49/year.
// Places are counted on payment, not signup order (decided 31 Oct 2026).
//
// paidCount is the number of profiles with plan = 'founding_lifetime'. Only
// the Stripe webhook sets that plan, so it counts real purchases.
// Anything that isn't a clean count closes the offer: callers must handle a
// failed count themselves (stripe-checkout answers 503) and never pass a guess.

export const FOUNDING_CAP = 300

export function foundingOpen(paidCount, cap = FOUNDING_CAP) {
  return Number.isInteger(paidCount) && paidCount >= 0 && paidCount < cap
}
