import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  checkoutErrorMessage,
  createCheckoutSession,
  fetchCheckoutPricing,
  isStripeCheckoutUrl,
  offerCopy,
} from './stripeCheckout.js'

const STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3'

function fakeClient(handler) {
  const calls = []
  return {
    calls,
    functions: {
      invoke: async (name, options) => {
        calls.push({ name, options })
        return handler(name, options)
      },
    },
  }
}

test('isStripeCheckoutUrl accepts only https checkout.stripe.com', () => {
  assert.equal(isStripeCheckoutUrl(STRIPE_URL), true)
  assert.equal(isStripeCheckoutUrl('https://checkout.stripe.com/pay/cs_test_x'), true)
  assert.equal(isStripeCheckoutUrl('https://yourpoolmate.com.au/#checkout'), false)
  assert.equal(isStripeCheckoutUrl('http://checkout.stripe.com/c/pay/cs_test_x'), false)
  assert.equal(isStripeCheckoutUrl('https://evil.example/checkout.stripe.com'), false)
  assert.equal(isStripeCheckoutUrl('https://checkout.stripe.com.evil.test/c/pay/cs_test_x'), false)
  assert.equal(isStripeCheckoutUrl(''), false)
  assert.equal(isStripeCheckoutUrl(null), false)
})

test('create_session sends no plan or price id and returns the Stripe URL', async () => {
  const client = fakeClient(async () => ({ data: { url: STRIPE_URL }, error: null }))
  const url = await createCheckoutSession(client, {
    successUrl: 'https://app.yourpoolmate.com.au',
    cancelUrl: 'https://app.yourpoolmate.com.au',
  })
  assert.equal(url, STRIPE_URL)
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].name, 'stripe-checkout')
  const body = client.calls[0].options.body
  assert.deepEqual(Object.keys(body).sort(), ['action', 'cancelUrl', 'successUrl'])
  assert.equal(body.action, 'create_session')
  assert.equal('plan' in body, false)
  assert.equal('price' in body, false)
  assert.equal(JSON.stringify(body).includes('price_'), false)
})

test('create_session rejects a marketing-site URL from the function', async () => {
  const client = fakeClient(async () => ({
    data: { url: 'https://yourpoolmate.com.au/#checkout' },
    error: null,
  }))
  await assert.rejects(
    () => createCheckoutSession(client),
    (err) => err.code === 'BAD_CHECKOUT_URL',
  )
})

test('create_session maps edge error codes and does not leak Stripe text', async () => {
  const body = JSON.stringify({
    error: 'No such price: price_secret_from_stripe',
    code: 'NOT_CONFIGURED',
  })
  const client = fakeClient(async () => ({
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(body, { status: 503, headers: { 'Content-Type': 'application/json' } }),
    },
  }))
  await assert.rejects(
    () => createCheckoutSession(client),
    (err) => {
      assert.equal(err.code, 'NOT_CONFIGURED')
      assert.equal(err.message, checkoutErrorMessage({ code: 'NOT_CONFIGURED' }))
      assert.equal(err.message.includes('price_'), false)
      return true
    },
  )
})

test('get_pricing result drives founding vs annual copy without a client plan', async () => {
  const founding = fakeClient(async () => ({
    data: { plan: 'founding_lifetime', price_aud: 79, interval: null, founding: true },
    error: null,
  }))
  const foundingPricing = await fetchCheckoutPricing(founding)
  assert.equal(founding.calls[0].options.body.action, 'get_pricing')
  assert.equal(founding.calls[0].options.body.plan, undefined)
  const foundingCopy = offerCopy(foundingPricing)
  assert.equal(foundingCopy.claimLabel, 'Claim founding access')
  assert.equal(foundingCopy.profileLabel, 'Claim founding access — $79')
  assert.equal(foundingCopy.priceLabel, '$79')

  const annual = fakeClient(async () => ({
    data: { plan: 'annual', price_aud: 49, interval: 'year', founding: false },
    error: null,
  }))
  const annualCopy = offerCopy(await fetchCheckoutPricing(annual))
  assert.equal(annualCopy.founding, false)
  assert.equal(annualCopy.claimLabel, 'Continue for $49 a year')
  assert.equal(annualCopy.profileLabel, 'Continue — $49 a year')
  assert.equal(annualCopy.claimLabel.includes('founding'), false)
})

test('pricing failure stays price-neutral so checkout can still start', async () => {
  const client = fakeClient(async () => ({
    data: null,
    error: { message: 'network' },
  }))
  assert.equal(await fetchCheckoutPricing(client), null)
  const copy = offerCopy(null)
  assert.equal(copy.known, false)
  assert.equal(copy.priceLabel, null)
  assert.equal(copy.claimLabel, 'Continue to checkout')
})

test('live App.jsx founding CTAs call create_session, not the marketing hash', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
  assert.equal(app.includes('yourpoolmate.com.au/#checkout'), false)
  assert.equal(app.includes('yourpoolmate.com.au/#join'), false)
  assert.equal(app.includes('createCheckoutSession'), true)
  assert.equal(app.includes("action: 'create_session'") || app.includes('createCheckoutSession'), true)
  assert.equal(app.includes('price_'), false)
})
