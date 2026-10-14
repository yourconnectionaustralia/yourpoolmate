// Pure test-mode check for STRIPE_SECRET_KEY.
// No Deno APIs and no logging, so node:test can call it. The edge
// function passes the secret in and never returns it.

export function stripeSecretIsTestMode(key) {
  if (typeof key !== "string" || key.length === 0) return false
  return key.startsWith("sk_test_") || key.startsWith("rk_test_")
}
