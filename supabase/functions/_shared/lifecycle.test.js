import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  DEFAULT_ALLOWLIST_EMAIL,
  FROM_ADDRESS,
  REPLY_TO,
  idempotencyKey,
  isAllowlisted,
  isStandardTrial,
  mayCallResend,
  nextTemplate,
} from "./lifecycle-rules.js"
import { renderTemplate, resendPayload } from "./lifecycle-templates.js"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-09-26T02:00:00.000Z")

function ago(ms) {
  return new Date(NOW.getTime() - ms).toISOString()
}

function standard(ageDays, overrides = {}) {
  const created = new Date(NOW.getTime() - ageDays * DAY)
  return {
    user_id: "11111111-1111-4111-8111-111111111111",
    created_at: created.toISOString(),
    trial_ends_at: new Date(created.getTime() + 30 * DAY).toISOString(),
    is_premium: false,
    founding_member: true,
    plan: null,
    premium_since: null,
    test_count: 0,
    first_test_at: null,
    third_test_at: null,
    ...overrides,
  }
}

test("allowlist defaults to the founder inbox and can take extras", () => {
  assert.equal(isAllowlisted(DEFAULT_ALLOWLIST_EMAIL, ""), true)
  assert.equal(isAllowlisted("YourConnectionAustralia@gmail.com", undefined), true)
  assert.equal(isAllowlisted("someone@example.com", ""), false)
  assert.equal(isAllowlisted("pool@example.com", "pool@example.com"), true)
  assert.equal(isAllowlisted(DEFAULT_ALLOWLIST_EMAIL, "pool@example.com"), true)
  assert.equal(isAllowlisted("other@example.com", "pool@example.com"), false)
})

test("only an exact * or ALL opens live sends", () => {
  assert.equal(isAllowlisted("stranger@example.com", "*"), true)
  assert.equal(isAllowlisted("stranger@example.com", " ALL "), true)
  // A mixed value is a normal list. "*" or "ALL" does not open the gate
  // unless it is the entire secret.
  assert.equal(isAllowlisted("stranger@example.com", "ALL, stranger@example.com"), true)
  assert.equal(isAllowlisted("other@example.com", "ALL, stranger@example.com"), false)
  assert.equal(isAllowlisted("other@example.com", "*, stranger@example.com"), false)
})

test("Resend is not called without a key or an allowlisted address", () => {
  assert.equal(mayCallResend(DEFAULT_ALLOWLIST_EMAIL, "", ""), false)
  assert.equal(mayCallResend(DEFAULT_ALLOWLIST_EMAIL, "", "re_test"), true)
  assert.equal(mayCallResend("stranger@example.com", "", "re_test"), false)
  assert.equal(mayCallResend("stranger@example.com", "*", "re_test"), true)
  assert.equal(mayCallResend("not-an-email", "*", ""), false)
})

test("sender source gates the Resend fetch", () => {
  const src = readFileSync(new URL("./lifecycle-email.ts", import.meta.url), "utf8")
  const gate = src.indexOf("if (!mayCallResend(")
  const fetchCall = src.indexOf('fetch("https://api.resend.com/emails"')
  assert.ok(gate > -1)
  assert.ok(fetchCall > gate)
})

test("from and reply-to are the locked addresses", () => {
  const rendered = renderTemplate("L1", { firstName: "James", foundingMember: true })
  const payload = resendPayload(DEFAULT_ALLOWLIST_EMAIL, rendered)
  assert.equal(payload.from, "Your Pool Mate <hello@mail.yourpoolmate.com.au>")
  assert.equal(payload.reply_to, "hello@yourpoolmate.com.au")
  assert.equal(FROM_ADDRESS, payload.from)
  assert.equal(REPLY_TO, payload.reply_to)
  assert.equal(payload.from.includes("hello@yourpoolmate.com.au"), false)
  assert.equal(idempotencyKey("abc", "L1"), "lifecycle-abc-L1")
})

test("every template stays inside the style rules", () => {
  const keys = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"]
  for (const founding of [true, false]) {
    for (const key of keys) {
      const rendered = renderTemplate(key, {
        firstName: "James",
        foundingMember: founding,
        plan: key === "L6" ? (founding ? "founding_lifetime" : "annual") : null,
        amountCents: founding ? 7900 : 4900,
        currency: "aud",
        receiptUrl: key === "L6" && founding ? "https://pay.stripe.com/receipts/example" : null,
      })
      const blob = `${rendered.subject}\n${rendered.preview}\n${rendered.text}\n${rendered.html}`
      assert.equal(blob.includes("\u2014"), false, key)
      assert.equal(blob.includes("\u2013"), false, key)
      assert.equal(/\blog\b/i.test(blob), false, `${key} log`)
      assert.equal(/photo/i.test(blob), false, `${key} photo`)
      assert.equal(/\bscan\b/i.test(blob), false, `${key} scan`)
      assert.equal(blob.includes("{{"), false, key)
      assert.match(rendered.html, /lang="en-AU"/)
      assert.match(rendered.text, /Hi James,/)
    }
  }
})

test("founding copy follows the recipient flag", () => {
  const founding = renderTemplate("L5", { firstName: "James", foundingMember: true })
  const yearly = renderTemplate("L5", { firstName: "James", foundingMember: false })
  assert.match(founding.text, /\$79/)
  assert.match(founding.text, /\$49\/year/)
  assert.equal(yearly.text.includes("$79"), false)
  assert.match(yearly.text, /\$49\/year/)

  const welcome = renderTemplate("L1", { firstName: "James", foundingMember: false })
  assert.equal(welcome.text.includes("$79"), false)
  const mid = renderTemplate("L4", { firstName: "James", foundingMember: false })
  assert.equal(mid.text.includes("$79"), false)
  assert.match(renderTemplate("L7", { firstName: "James", foundingMember: false }).text, /\$79/)
})

test("L6 omits the receipt line when there is no https url", () => {
  const withReceipt = renderTemplate("L6", {
    firstName: "James",
    foundingMember: true,
    plan: "founding_lifetime",
    amountCents: 7900,
    currency: "aud",
    receiptUrl: "https://pay.stripe.com/receipts/example",
  })
  assert.match(withReceipt.text, /Founding lifetime \(\$79\)/)
  assert.match(withReceipt.text, /\$79\.00 AUD/)
  assert.match(withReceipt.text, /Receipt: https:\/\/pay\.stripe\.com\/receipts\/example/)
  assert.match(withReceipt.html, /href="https:\/\/pay\.stripe\.com\/receipts\/example"/)

  const bare = renderTemplate("L6", {
    firstName: "James",
    foundingMember: false,
    plan: "annual",
    amountCents: 4900,
    currency: "aud",
    receiptUrl: "javascript:alert(1)",
  })
  assert.equal(bare.text.includes("Receipt:"), false)
  assert.equal(bare.html.includes("javascript:"), false)
  assert.match(bare.text, /Yearly \(\$49\/year\)/)
  assert.match(bare.text, /\$49\.00 AUD/)
})

test("a hostile first name falls back to there", () => {
  const rendered = renderTemplate("L1", {
    firstName: "<img src=x onerror=alert(1)>",
    foundingMember: true,
  })
  assert.match(rendered.text, /Hi there,/)
  assert.equal(rendered.html.includes("<img"), false)
  const named = renderTemplate("L2", { firstName: "O'Brien", foundingMember: false })
  assert.match(named.text, /Hi O'Brien,/)
})

test("open beta does not get the 30-day trial-ending copy", () => {
  const beta = standard(27, { trial_ends_at: "2027-03-31T12:59:59.000Z" })
  assert.equal(isStandardTrial(beta), false)
  assert.equal(nextTemplate(beta, [], NOW), null)

  const day14 = standard(14, { trial_ends_at: "2027-03-31T12:59:59.000Z" })
  assert.equal(nextTemplate(day14, [], NOW), null)
})

test("sweep picks one template in lifecycle order", () => {
  assert.equal(nextTemplate(standard(0.1), [], NOW), "L1")

  const tested = standard(0.1, { test_count: 1, first_test_at: ago(20 * 60 * 1000) })
  assert.equal(nextTemplate(tested, [], NOW), "L1")
  assert.equal(nextTemplate(tested, [{ template_key: "L1", status: "sent", created_at: ago(1000) }], NOW), "L3")

  assert.equal(nextTemplate(standard(0.1, { first_test_at: ago(5 * 60 * 1000), test_count: 1 }), [
    { template_key: "L1", status: "sent", created_at: ago(1000) },
  ], NOW), null)

  // Welcome still wins during the first week. The nudge waits a day after L1.
  assert.equal(nextTemplate(standard(3), [], NOW), "L1")
  assert.equal(nextTemplate(standard(3), [{ template_key: "L1", status: "sent", created_at: ago(60 * 60 * 1000) }], NOW), null)
  assert.equal(nextTemplate(standard(3), [{ template_key: "L1", status: "sent", created_at: ago(DAY) }], NOW), "L2")
  assert.equal(nextTemplate(standard(8, { test_count: 1, first_test_at: ago(1 * DAY) }), [], NOW), "L3")

  assert.equal(nextTemplate(standard(14), [], NOW), "L4")
  assert.equal(nextTemplate(standard(27), [], NOW), "L5")
  assert.equal(nextTemplate(standard(27, { is_premium: true, plan: "annual", premium_since: ago(3 * DAY) }), [], NOW), "L6")

  const paidToday = standard(10, {
    is_premium: true,
    plan: "founding_lifetime",
    premium_since: ago(5 * 60 * 1000),
  })
  assert.equal(nextTemplate(paidToday, [], NOW), null)

  const third = standard(20, {
    test_count: 3,
    first_test_at: ago(10 * DAY),
    third_test_at: ago(2 * DAY),
  })
  assert.equal(nextTemplate(third, [], NOW), "L7")
  assert.equal(nextTemplate(third, [{ template_key: "L6", status: "sent", created_at: ago(1 * DAY) }], NOW), null)
  assert.equal(nextTemplate(third, [{ template_key: "L6", status: "sent", created_at: ago(3 * DAY) }], NOW), "L7")

  const skipped = standard(0.2)
  assert.equal(nextTemplate(skipped, [{ template_key: "L1", status: "skipped", created_at: ago(1000) }], NOW), null)

  const failed = standard(4)
  assert.equal(nextTemplate(failed, [
    { template_key: "L1", status: "sent", created_at: ago(3 * DAY) },
    { template_key: "L2", status: "failed", created_at: ago(1000) },
  ], NOW), "L2")

  const inflight = standard(0.2)
  assert.equal(nextTemplate(inflight, [{ template_key: "L1", status: "pending", created_at: ago(60 * 1000) }], NOW), null)
  assert.equal(nextTemplate(inflight, [{ template_key: "L1", status: "pending", created_at: ago(20 * 60 * 1000) }], NOW), "L1")
})

test("subjects stay on the locked lines", () => {
  assert.equal(renderTemplate("L1", { foundingMember: true }).subject, "Welcome - let's get your pool sorted")
  assert.equal(renderTemplate("L2", {}).subject, "Your pool's Health Score starts with one test")
  assert.equal(renderTemplate("L3", {}).subject, "First test done - here's what to do next")
  assert.equal(renderTemplate("L4", { foundingMember: true }).subject, "Halfway through your trial - how's the water looking?")
  assert.equal(renderTemplate("L5", { foundingMember: true }).subject, "Your trial ends in a few days - here's the choice")
  assert.equal(renderTemplate("L6", { plan: "annual" }).subject, "Welcome aboard - here's what happens next")
  assert.equal(renderTemplate("L7", {}).subject, "Know another pool owner?")
})
