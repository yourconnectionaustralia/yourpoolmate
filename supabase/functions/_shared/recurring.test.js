import assert from "node:assert/strict"
import test from "node:test"
import { renderMonthlyReport, renderWeeklyReminder, recurringPayload } from "./recurring-templates.js"
import {
  melbourneMidnight, monthlyDecision, monthlyPeriod, signUnsubscribe, unsubscribeUrl, verifyUnsubscribe, weeklyDecision,
} from "./recurring-rules.js"

const DAY = 24 * 60 * 60 * 1000

// Sunday 18 Oct 2026, 09:00 AEDT = Sat 17 Oct 22:00Z
const SUN_9AM = new Date("2026-10-17T22:00:00Z")

test("weekly: sends on the chosen day after 8am Melbourne time", () => {
  const c = { reminder_day: 0, last_test_at: new Date(SUN_9AM.getTime() - 9 * DAY).toISOString(), test_count: 3 }
  const d = weeklyDecision(c, SUN_9AM, null)
  assert.equal(d.action, "send")
  assert.equal(d.periodKey, "2026-10-18")
})

test("weekly: not on another day, before 8am or after 8pm", () => {
  const c = { reminder_day: 0, last_test_at: null, test_count: 0 }
  assert.equal(weeklyDecision({ ...c, reminder_day: 1 }, SUN_9AM, null).action, "none")
  assert.equal(weeklyDecision(c, new Date("2026-10-17T20:30:00Z"), null).action, "none") // Sun 07:30
  assert.equal(weeklyDecision(c, new Date("2026-10-18T09:30:00Z"), null).action, "none") // Sun 20:30
  assert.equal(weeklyDecision(c, new Date("2026-10-18T08:30:00Z"), null).action, "send") // Sun 19:30
})

test("weekly: nobody who tested in the last 3 days is reminded, and it is recorded as skipped", () => {
  const c = { reminder_day: 0, last_test_at: new Date(SUN_9AM.getTime() - 2 * DAY).toISOString(), test_count: 5 }
  assert.deepEqual(weeklyDecision(c, SUN_9AM, null), { action: "skip", periodKey: "2026-10-18", reason: "recent_test" })
})

test("weekly: once per day. sent and skipped rows block, failed rows retry", () => {
  const c = { reminder_day: 0, last_test_at: null, test_count: 0 }
  assert.equal(weeklyDecision(c, SUN_9AM, { status: "sent" }).action, "none")
  assert.equal(weeklyDecision(c, SUN_9AM, { status: "skipped" }).action, "none")
  assert.equal(weeklyDecision(c, SUN_9AM, { status: "failed" }).action, "send")
  const fresh = { status: "pending", created_at: new Date(SUN_9AM.getTime() - 5 * 60000).toISOString() }
  const stale = { status: "pending", created_at: new Date(SUN_9AM.getTime() - 30 * 60000).toISOString() }
  assert.equal(weeklyDecision(c, SUN_9AM, fresh).action, "none")
  assert.equal(weeklyDecision(c, SUN_9AM, stale).action, "send")
})

test("weekly: no reminder day means no reminder", () => {
  assert.equal(weeklyDecision({ reminder_day: null }, SUN_9AM, null).action, "none")
})

test("weekly: the day follows Melbourne time across daylight saving", () => {
  // Sun 4 Oct 2026 clocks go forward at 2am. 9am AEDT = Sat 3 Oct 22:00Z
  assert.equal(weeklyDecision({ reminder_day: 0, last_test_at: null }, new Date("2026-10-03T22:00:00Z"), null).periodKey, "2026-10-04")
})

test("monthly: due 9am on the 1st to the 3rd, for the month before", () => {
  // 2 Oct 07:00 AEST: the hour gate only applies on the 1st, so the 2nd is fine
  assert.equal(monthlyPeriod(new Date("2026-10-01T21:00:00Z")).key, "2026-09")
  assert.equal(monthlyPeriod(new Date("2026-10-02T14:00:00Z")).key, "2026-09") // 3 Oct 00:00 AEST
})

test("monthly: the 1st before 9am is not yet", () => {
  assert.equal(monthlyPeriod(new Date("2026-09-30T20:00:00Z")), null) // 1 Oct 07:00 AEDT
  const p = monthlyPeriod(new Date("2026-09-30T23:30:00Z")) // 1 Oct 10:30 AEDT
  assert.equal(p.key, "2026-09")
  assert.equal(p.monthName, "September")
  assert.equal(p.from, "2026-08-31T14:00:00.000Z") // 1 Sep 00:00 AEST
  assert.equal(p.to, "2026-09-30T14:00:00.000Z")   // 1 Oct 00:00 AEST (DST starts 4 Oct)
})

test("monthly: not after the 3rd, and January reports December", () => {
  assert.equal(monthlyPeriod(new Date("2026-10-04T02:00:00Z")), null)
  const p = monthlyPeriod(new Date("2027-01-01T23:00:00Z")) // 2 Jan 10:00 AEDT
  assert.equal(p.key, "2026-12")
  assert.equal(p.from, "2026-11-30T13:00:00.000Z")
})

test("monthly: a sent report blocks a repeat in the same window", () => {
  const now = new Date("2026-10-01T23:30:00Z")
  assert.equal(monthlyDecision(now, null).action, "send")
  assert.equal(monthlyDecision(now, { status: "sent" }).action, "none")
})

test("melbourne midnight handles the daylight saving changeover", () => {
  assert.equal(melbourneMidnight(2026, 10, 4).toISOString(), "2026-10-03T14:00:00.000Z") // still AEST at 00:00
  assert.equal(melbourneMidnight(2026, 10, 5).toISOString(), "2026-10-04T13:00:00.000Z") // AEDT
})

test("unsubscribe tokens verify, and cannot be forged or moved to another member", async () => {
  const secret = "s3cret"
  const id = "11111111-1111-4111-8111-111111111111"
  const token = await signUnsubscribe(secret, id, "weekly_reminder")
  assert.deepEqual(await verifyUnsubscribe(secret, token), { userId: id, kind: "weekly_reminder" })
  assert.equal(await verifyUnsubscribe("other", token), null)
  assert.equal(await verifyUnsubscribe(secret, token.replace(id, "22222222-2222-4222-8222-222222222222")), null)
  assert.equal(await verifyUnsubscribe(secret, token.replace("weekly_reminder", "monthly_report")), null)
  assert.equal(await verifyUnsubscribe(secret, `${token}.x`), null)
  assert.equal(await verifyUnsubscribe(secret, "nope"), null)
  assert.equal(await verifyUnsubscribe("", token), null)
})

const UNSUB = "https://example.supabase.co/functions/v1/send-lifecycle-email?u=abc"

test("weekly email: one button, the day, last score, an unsubscribe link", () => {
  const e = renderWeeklyReminder({ firstName: "Margaret", reminderDay: 0, daysSinceTest: 9, lastScore: 84, unsubscribeUrl: UNSUB })
  assert.equal(e.subject, "Time to test your pool water")
  assert.match(e.text, /It's Sunday, your weekly water test day\./)
  assert.match(e.text, /Your last test was 9 days ago and your Health Score was 84\./)
  assert.match(e.text, /https:\/\/app\.yourpoolmate\.com\.au\/\?test=1/)
  assert.match(e.html, /Hi Margaret,/)
  assert.ok(e.text.includes(UNSUB) && e.html.includes(UNSUB))
})

test("weekly email: a member with no test yet is asked for the first one", () => {
  const e = renderWeeklyReminder({ firstName: null, reminderDay: 6, daysSinceTest: NaN, lastScore: NaN, unsubscribeUrl: UNSUB })
  assert.match(e.text, /Hi there,/)
  assert.match(e.text, /You haven't added a test yet\./)
})

test("monthly email: counts, score movement, doses and latest readings", () => {
  const e = renderMonthlyReport({
    firstName: "Margaret", monthName: "September", tests: 4, firstScore: 61, lastScore: 92, bestScore: 92, lowestScore: 61,
    doses: 3, lastReadings: { free_chlorine: 2, ph: 7.4, alkalinity: 100, cyanuric_acid: null, calcium: 300, salt: null }, unsubscribeUrl: UNSUB,
  })
  assert.equal(e.subject, "Your pool in September: Health Score 92")
  assert.match(e.text, /Water tests: 4\./)
  assert.match(e.text, /started at 61, finished at 92 \(up 31\)/)
  assert.match(e.text, /Best score 92, lowest 61\./)
  assert.match(e.text, /Doses you added: 3\./)
  assert.match(e.text, /free chlorine 2 ppm, pH 7\.4, alkalinity 100 ppm, calcium 300 ppm/)
  assert.ok(e.html.includes(UNSUB))
})

test("monthly email: one test, no doses, no score", () => {
  const e = renderMonthlyReport({ firstName: "x", monthName: "March", tests: 1, firstScore: null, lastScore: null, bestScore: null, lowestScore: null, doses: 0, lastReadings: null, unsubscribeUrl: UNSUB })
  assert.equal(e.subject, "Your pool in March")
  assert.match(e.text, /Water tests: 1\./)
  assert.doesNotMatch(e.text, /Doses/)
})

test("payload carries one-click unsubscribe headers", () => {
  const e = renderWeeklyReminder({ firstName: "a", reminderDay: 1, daysSinceTest: 8, lastScore: 70, unsubscribeUrl: UNSUB })
  const p = recurringPayload("a@example.com", e, UNSUB)
  assert.equal(p.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")
  assert.match(p.headers["List-Unsubscribe"], /^<https:\/\/example\.supabase\.co/)
  assert.deepEqual(p.tags, [{ name: "template", value: "weekly_reminder" }])
})
