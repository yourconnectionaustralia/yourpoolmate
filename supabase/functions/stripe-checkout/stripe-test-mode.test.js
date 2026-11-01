import assert from "node:assert/strict"
import test from "node:test"
import { stripeSecretIsTestMode } from "./stripe-test-mode.js"

test("test mode is true for sk_test_ and rk_test_ only", () => {
  assert.equal(stripeSecretIsTestMode("sk_test_51abc"), true)
  assert.equal(stripeSecretIsTestMode("rk_test_51abc"), true)
  assert.equal(stripeSecretIsTestMode("sk_live_51abc"), false)
  assert.equal(stripeSecretIsTestMode("rk_live_51abc"), false)
  assert.equal(stripeSecretIsTestMode(""), false)
})
