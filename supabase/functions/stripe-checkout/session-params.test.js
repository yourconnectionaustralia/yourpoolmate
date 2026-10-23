import assert from "node:assert/strict"
import test from "node:test"
import { FOUNDING, STANDARD, buildSessionParams } from "./session-params.js"

const PRICE_KEY = "line_items[0][price]"
const INTERVAL_KEY = "line_items[0][price_data][recurring][interval]"

function opts(priceId) {
  return {
    priceId,
    successUrl: "https://app.yourpoolmate.com.au",
    cancelUrl: "https://app.yourpoolmate.com.au",
    userId: "11111111-1111-4111-8111-111111111111",
    stripeCustomerId: null,
    email: "owner@example.com",
  }
}

function priceDataKeys(params) {
  return Object.keys(params).filter((key) => key.startsWith("line_items[0][price_data]"))
}

test("founding omits promo codes and annual allows them", () => {
  assert.equal(FOUNDING.allow_promotion_codes, false)
  assert.equal(FOUNDING.mode, "payment")
  assert.equal(STANDARD.allow_promotion_codes, true)
  assert.equal(STANDARD.mode, "subscription")
  assert.equal(STANDARD.interval, "year")
})

test("both tiers, with and without a catalog price, build an exclusive line item", () => {
  const cases = [
    { name: "founding catalog", tier: FOUNDING, priceId: "price_founding" },
    { name: "founding inline", tier: FOUNDING, priceId: null },
    { name: "annual catalog", tier: STANDARD, priceId: "price_annual" },
    { name: "annual inline", tier: STANDARD, priceId: null },
  ]

  for (const { name, tier, priceId } of cases) {
    const params = buildSessionParams(tier, opts(priceId))
    const dataKeys = priceDataKeys(params)
    const hasPrice = Object.prototype.hasOwnProperty.call(params, PRICE_KEY)
    const hasPriceData = dataKeys.length > 0

    assert.equal(hasPrice && hasPriceData, false, `${name}: line has both price and price_data`)
    assert.equal(hasPrice || hasPriceData, true, `${name}: line has neither price nor price_data`)

    const inlineSubscription = !priceId && tier.mode === "subscription"
    assert.equal(
      Object.prototype.hasOwnProperty.call(params, INTERVAL_KEY),
      inlineSubscription,
      `${name}: recurring interval only on the inline subscription line`,
    )
    if (inlineSubscription) {
      assert.equal(params[INTERVAL_KEY], "year", name)
    }

    if (priceId) {
      assert.equal(params[PRICE_KEY], priceId, name)
      assert.equal(dataKeys.length, 0, `${name}: catalog price must not send price_data`)
    }

    if (tier === STANDARD) {
      assert.equal(params.allow_promotion_codes, "true", name)
    } else {
      assert.equal(
        Object.prototype.hasOwnProperty.call(params, "allow_promotion_codes"),
        false,
        `${name}: founding checkout must not send allow_promotion_codes`,
      )
    }

    if (tier.mode === "payment") {
      assert.equal(params.submit_type, "pay", name)
    } else {
      assert.equal(
        Object.prototype.hasOwnProperty.call(params, "submit_type"),
        false,
        `${name}: submit_type is payment mode only`,
      )
    }
  }
})
