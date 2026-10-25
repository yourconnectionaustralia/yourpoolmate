import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  DEFAULT_ALLOWLIST_EMAIL,
  FROM_ADDRESS,
  REPLY_TO,
  TEMPLATE_KEYS,
  idempotencyKey,
  isAllowlisted,
  isStandardTrial,
  isTemplateKey,
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
    fifth_test_at: null,
    last_test_at: null,
    // Set up by default, so older cases do not pick up the setup reminder.
    has_pool_size: true,
    has_equipment: true,
    ...overrides,
  }
}

function sent(key, agoMs) {
  return { template_key: key, status: "sent", created_at: ago(agoMs) }
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

test("L1 to L8 are the template keys", () => {
  assert.deepEqual(TEMPLATE_KEYS, ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"])
  assert.equal(isTemplateKey("L8"), true)
  assert.equal(isTemplateKey("L9"), false)
  assert.equal(idempotencyKey("abc", "L8"), "lifecycle-abc-L8")
})

test("every template stays inside the style rules", () => {
  const keys = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"]
  for (const founding of [true, false]) {
    for (const key of keys) {
      const rendered = renderTemplate(key, {
        firstName: "James",
        foundingMember: founding,
        plan: key === "L6" ? (founding ? "founding_lifetime" : "annual") : null,
        amountCents: founding ? 7900 : 4900,
        currency: "aud",
        receiptUrl: key === "L6" && founding ? "https://pay.stripe.com/receipts/example" : null,
        testCount: 6,
        missingSize: true,
        missingEquipment: true,
      })
      const blob = `${rendered.subject}\n${rendered.preview}\n${rendered.text}\n${rendered.html}`
      assert.equal(blob.includes("—"), false, key)
      assert.equal(blob.includes("–"), false, key)
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
  // L7 goes to people who may share it after the 300 founding places are gone,
  // so it makes no price promise to the friend. L8 is about setup, not price.
  assert.equal(renderTemplate("L7", { firstName: "James", foundingMember: true }).text.includes("$79"), false)
  assert.equal(renderTemplate("L8", { firstName: "James", foundingMember: true }).text.includes("$79"), false)
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

// ── L7: the referral ask ──────────────────────────────────────

function regular(overrides = {}) {
  return standard(20, {
    test_count: 5,
    first_test_at: ago(15 * DAY),
    third_test_at: ago(9 * DAY),
    fifth_test_at: ago(2 * DAY),
    last_test_at: ago(1 * DAY),
    ...overrides,
  })
}

test("referral ask goes to regular users: five tests, one recent", () => {
  assert.equal(nextTemplate(regular(), [], NOW), "L7")
  // Seven tests and a test this morning is the same person, still using it.
  assert.equal(nextTemplate(regular({ test_count: 7, last_test_at: ago(2 * 60 * 60 * 1000) }), [], NOW), "L7")

  // Four tests is not yet "regular".
  assert.equal(nextTemplate(regular({ test_count: 4, fifth_test_at: null }), [], NOW), null)
  // Three tests used to be enough. It no longer is.
  assert.equal(nextTemplate(regular({ test_count: 3, fifth_test_at: null }), [], NOW), null)
  // The fifth test went in today: let them enjoy it first.
  assert.equal(nextTemplate(regular({ fifth_test_at: ago(3 * 60 * 60 * 1000) }), [], NOW), null)
  // The fifth test is over a month old: too late for the "just got going" moment.
  assert.equal(nextTemplate(regular({ fifth_test_at: ago(40 * DAY) }), [], NOW), null)
  // Five tests, but nothing for over two weeks: not engaged right now.
  assert.equal(nextTemplate(regular({ last_test_at: ago(16 * DAY) }), [], NOW), null)
  // An older database function does not say when the fifth test was.
  assert.equal(nextTemplate(regular({ fifth_test_at: null, last_test_at: null }), [], NOW), null)
})

test("referral ask waits after other mail and after a payment thank-you", () => {
  assert.equal(nextTemplate(regular(), [sent("L6", 1 * DAY)], NOW), null)
  assert.equal(nextTemplate(regular(), [sent("L6", 3 * DAY)], NOW), "L7")
  // Any recent email holds it back for two days.
  assert.equal(nextTemplate(regular(), [sent("L3", 1 * DAY)], NOW), null)
  assert.equal(nextTemplate(regular(), [sent("L3", 3 * DAY)], NOW), "L7")
  // A skipped or failed row never reached the person, so it does not count.
  assert.equal(nextTemplate(regular(), [
    { template_key: "L8", status: "skipped", created_at: ago(1 * DAY) },
    { template_key: "L2", status: "failed", created_at: ago(1 * DAY) },
  ], NOW), "L7")
  // Once only.
  assert.equal(nextTemplate(regular(), [sent("L7", 10 * DAY)], NOW), null)
  assert.equal(nextTemplate(regular(), [{ template_key: "L7", status: "skipped", created_at: ago(10 * DAY) }], NOW), null)
})

test("paid members keep the referral ask, whatever their test count", () => {
  const paid = standard(40, {
    is_premium: true,
    plan: "annual",
    premium_since: ago(3 * DAY),
    test_count: 0,
  })
  assert.equal(nextTemplate(paid, [sent("L6", 3 * DAY)], NOW), "L7")
  // Too soon after paying (under 2 days), or too long ago (over 21 days).
  assert.equal(nextTemplate({ ...paid, premium_since: ago(1 * DAY) }, [sent("L6", 1 * DAY)], NOW), null)
  assert.equal(nextTemplate({ ...paid, premium_since: ago(25 * DAY) }, [sent("L6", 25 * DAY)], NOW), null)
})

// ── L8: the pool setup reminder ───────────────────────────────

test("setup reminder goes out 3 to 10 days in, once, to anyone with something empty", () => {
  const l1 = sent("L1", 4 * DAY)
  const l2 = sent("L2", 3 * DAY)
  const empty = (age, o = {}) => standard(age, { has_pool_size: false, has_equipment: false, ...o })

  // The first-test nudge goes first. L8 follows once that has been handled.
  assert.equal(nextTemplate(empty(4), [l1], NOW), "L2")
  assert.equal(nextTemplate(empty(4), [l1, l2], NOW), "L8")

  // Window: not before day 3, not after day 10. (L2 is marked skipped so it is
  // out of the way and only the window decides.)
  const l2Done = { template_key: "L2", status: "skipped", created_at: ago(1 * DAY) }
  assert.equal(nextTemplate(empty(2), [sent("L1", 2 * DAY), l2Done], NOW), null)
  assert.equal(nextTemplate(empty(3), [sent("L1", 3 * DAY), l2Done], NOW), "L8")
  assert.equal(nextTemplate(empty(9.9), [sent("L1", 9.9 * DAY), l2Done], NOW), "L8")
  assert.equal(nextTemplate(empty(11), [sent("L1", 11 * DAY), l2Done], NOW), null)

  // Either half missing is enough. Both present is nothing to remind about.
  assert.equal(nextTemplate(empty(4, { has_pool_size: false, has_equipment: true }), [l1, l2], NOW), "L8")
  assert.equal(nextTemplate(empty(4, { has_pool_size: true, has_equipment: false }), [l1, l2], NOW), "L8")
  assert.equal(nextTemplate(empty(4, { has_pool_size: true, has_equipment: true }), [l1, l2], NOW), null)

  // Someone who has tested follows L3 and then gets L8.
  const tested = empty(5, { test_count: 1, first_test_at: ago(4 * DAY), has_equipment: true })
  assert.equal(nextTemplate(tested, [sent("L1", 5 * DAY), sent("L3", 4 * DAY)], NOW), "L8")

  // Once only, and a skipped row is final.
  assert.equal(nextTemplate(empty(4), [l1, l2, sent("L8", 1 * DAY)], NOW), null)
  assert.equal(nextTemplate(empty(4), [l1, l2, { template_key: "L8", status: "skipped", created_at: ago(1 * DAY) }], NOW), null)
})

test("setup reminder never goes on a guess, to a lapsed trial, or right after another email", () => {
  const l1 = sent("L1", 5 * DAY)
  const l2 = sent("L2", 4 * DAY)
  const empty = (o = {}) => standard(5, { has_pool_size: false, has_equipment: false, ...o })

  // The database did not say (function not updated, or the member-triggered path).
  assert.equal(nextTemplate(empty({ has_pool_size: null, has_equipment: null }), [l1, l2], NOW), null)
  assert.equal(nextTemplate(empty({ has_pool_size: undefined, has_equipment: undefined }), [l1, l2], NOW), null)

  // Trial over and not a member: no reminder.
  assert.equal(nextTemplate(empty({ trial_ends_at: ago(1 * DAY) }), [l1, l2], NOW), null)

  // A member who never filled it in still gets it.
  const member = empty({ is_premium: true, plan: "annual", premium_since: ago(4 * DAY) })
  assert.equal(nextTemplate(member, [l1, sent("L6", 3 * DAY)], NOW), "L8")

  // Two days of quiet after any other email.
  assert.equal(nextTemplate(empty(), [l1, sent("L2", 1 * DAY)], NOW), null)
  assert.equal(nextTemplate(empty(), [l1, sent("L2", 3 * DAY)], NOW), "L8")
})

test("member-triggered sweep source cannot send L8 or L7", () => {
  const src = readFileSync(new URL("./lifecycle-email.ts", import.meta.url), "utf8")
  assert.match(src, /const MEMBER_TEMPLATES = \["L1", "L3"\]/)
})

test("sender hands the setup flags to the template, and reads missing flags as unknown", () => {
  const src = readFileSync(new URL("./lifecycle-email.ts", import.meta.url), "utf8")
  assert.match(src, /missingSize: candidate\.has_pool_size === false/)
  assert.match(src, /missingEquipment: candidate\.has_equipment === false/)
  assert.match(src, /has_pool_size: typeof row\.has_pool_size === "boolean" \? row\.has_pool_size : null/)
  assert.match(src, /has_equipment: typeof row\.has_equipment === "boolean" \? row\.has_equipment : null/)
})

test("migration 023 gives the sweep the columns the rules read", () => {
  const sql = readFileSync(new URL("../../migrations/023_lifecycle_setup_referral.sql", import.meta.url), "utf8")
  for (const col of ["fifth_test_at", "last_test_at", "has_pool_size", "has_equipment"]) {
    assert.ok(sql.includes(col), col)
  }
  assert.match(sql, /'L7', 'L8'/)
  assert.match(sql, /grant execute on function public\.lifecycle_email_candidates\(timestamptz\) to service_role/)
  assert.match(sql, /revoke execute on function public\.lifecycle_email_candidates\(timestamptz\) from public, anon, authenticated/)
})

test("subjects stay on the locked lines", () => {
  assert.equal(renderTemplate("L1", { foundingMember: true }).subject, "Welcome - your first step takes about 2 minutes")
  assert.equal(renderTemplate("L2", {}).subject, "Got a pool shop printout? That's all you need")
  assert.equal(renderTemplate("L3", {}).subject, "Nice work - your first test is in")
  assert.equal(renderTemplate("L4", { foundingMember: true }).subject, "Two weeks in - how's it going?")
  assert.equal(renderTemplate("L5", { foundingMember: true }).subject, "Your free trial ends this week")
  assert.equal(renderTemplate("L6", { plan: "annual" }).subject, "Welcome aboard - you're all set")
  assert.equal(renderTemplate("L7", {}).subject, "Share this to a mate with a pool")
  assert.equal(renderTemplate("L8", {}).subject, "Set up your pool so the advice fits it")
})

test("L5 names the trial end date in Melbourne time, or falls back", () => {
  const dated = renderTemplate("L5", { firstName: "James", foundingMember: true, trialEndsAt: "2026-11-19T14:00:00.000Z" }) // 1am 20 Nov in Melbourne
  assert.match(dated.text, /ends on Friday 20 November\./)
  const undated = renderTemplate("L5", { firstName: "James", foundingMember: false, trialEndsAt: "not a date" })
  assert.match(undated.text, /ends in a few days\./)
})

test("footer carries the ABN, and priced emails say AUD once", () => {
  const l5 = renderTemplate("L5", { firstName: "James", foundingMember: true })
  assert.match(l5.html, /ABN 61 264 129 127/)
  assert.match(l5.text, /All prices are in Australian dollars\./)
  const l2 = renderTemplate("L2", { firstName: "James" })
  assert.equal(l2.text.includes("Australian dollars"), false)
})

test("test buttons open the test form; L4 and L5 show the record so far", () => {
  for (const key of ["L1", "L2", "L4"]) {
    assert.ok(renderTemplate(key, {}).html.includes("https://app.yourpoolmate.com.au/?test=1"), key)
  }
  const l4 = renderTemplate("L4", { foundingMember: false, testCount: 3 })
  assert.ok(l4.text.includes("you've added 3 tests so far"))
  assert.ok(l4.preview.includes("3 tests"))
  const none = renderTemplate("L4", { foundingMember: false, testCount: 0 })
  assert.ok(none.text.includes("You haven't added a test yet"))
  const unknown = renderTemplate("L4", { foundingMember: false })
  assert.ok(unknown.text.includes("Once you've added a few tests"))
  assert.ok(renderTemplate("L5", { foundingMember: true, testCount: 1 }).text.includes("your 1 test, each with its date, stays saved"))
  assert.ok(renderTemplate("L5", { foundingMember: true }).text.includes("your test history stays saved"))
})

test("the welcome, halfway and ending emails introduce Ask Mate as AI", () => {
  for (const key of ["L1", "L3", "L4", "L5"]) {
    const rendered = renderTemplate(key, { foundingMember: true })
    assert.match(rendered.text, /Mate/, key)
    assert.match(rendered.text, /AI/, key)
  }
  // The warranty is a mention, not the pitch.
  const welcome = renderTemplate("L1", { foundingMember: true }).text
  assert.equal(welcome.includes("WARRANTY"), false)
  assert.match(welcome, /built this for pool owners, not just pool shops/)
})

test("the first-test email congratulates and does not repeat the score", () => {
  const l3 = renderTemplate("L3", { firstName: "James" })
  assert.match(l3.text, /Congratulations on adding your first water test/)
  assert.equal(/Health Score/i.test(l3.text), false)
})

test("referral email: new subject and headline, test count only when it is a regular user", () => {
  const regularUser = renderTemplate("L7", { firstName: "James", testCount: 6 })
  assert.equal(regularUser.subject, "Share this to a mate with a pool")
  assert.match(regularUser.text, /You've added 6 tests now/)
  assert.ok(regularUser.html.includes("Share this to a mate with "))
  assert.equal(regularUser.html.includes("Know a mate with"), false)

  // A paid member with a handful of tests, or no count at all, gets the plain ask.
  for (const input of [{ testCount: 2 }, {}]) {
    const plain = renderTemplate("L7", { firstName: "James", ...input })
    assert.equal(/You've added/.test(plain.text), false)
    assert.match(plain.text, /I'll only ask this once\./)
  }
  assert.match(regularUser.text, /https:\/\/yourpoolmate\.com\.au/)
})

test("setup reminder asks only for what is missing and says where to go", () => {
  const both = renderTemplate("L8", { firstName: "James", missingSize: true, missingEquipment: true })
  assert.match(both.text, /missing your pool size and your equipment/)
  assert.match(both.text, /Your pool size/)
  assert.match(both.text, /Your equipment/)
  assert.match(both.text, /Not sure of your litres\?/)
  assert.match(both.text, /go to Pool setup/)
  assert.ok(both.html.includes('href="https://app.yourpoolmate.com.au"'))

  const sizeOnly = renderTemplate("L8", { firstName: "James", missingSize: true, missingEquipment: false })
  assert.match(sizeOnly.text, /missing your pool size\./)
  assert.match(sizeOnly.text, /Your pool size/)
  assert.equal(sizeOnly.text.includes("Your equipment"), false)
  assert.match(sizeOnly.text, /Not sure of your litres\?/)

  const equipmentOnly = renderTemplate("L8", { firstName: "James", missingSize: false, missingEquipment: true })
  assert.match(equipmentOnly.text, /missing your equipment\./)
  assert.match(equipmentOnly.text, /Your equipment/)
  assert.equal(equipmentOnly.text.includes("Your pool size"), false)
  assert.equal(equipmentOnly.text.includes("Not sure of your litres?"), false)
  assert.match(equipmentOnly.text, /go to Pool setup/)

  // A manual send with no flags asks for both rather than for nothing.
  const manual = renderTemplate("L8", { firstName: "James" })
  assert.match(manual.text, /missing your pool size and your equipment/)
})
