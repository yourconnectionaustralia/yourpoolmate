import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { cleanPoolVolume, cleanReadings, cleanTestDate, isBillingError, parseModelJson, parseReading, sanityCheck } from "./ocr-readings.js"

// What a correct read of the two Swimart printout pages looks like.
const PAGE_1 = '{"ph":7.9,"free_chlorine":0.61,"total_chlorine":0.68,"alkalinity":83,"cyanuric_acid":null,"calcium":null,"salt":4572,"phosphates":null,"tds":null,"confidence":"high","notes":null}'
const PAGE_2 = '{"ph":null,"free_chlorine":null,"total_chlorine":null,"alkalinity":null,"cyanuric_acid":7,"calcium":143,"salt":null,"phosphates":0,"tds":null,"confidence":"medium","notes":null}'

test("numbers are read the way a printout writes them", () => {
  assert.equal(parseReading(4572), 4572)
  assert.equal(parseReading("4,572"), 4572)
  assert.equal(parseReading("4 572"), 4572)
  assert.equal(parseReading("12,345.5"), 12345.5)
  assert.equal(parseReading("0.61 ppm"), 0.61)
  assert.equal(parseReading("0,61"), 0.61)
  assert.equal(parseReading("7.9"), 7.9)
  assert.equal(parseReading(0), 0)
  assert.equal(parseReading("0"), 0)
  assert.equal(parseReading("<0.1"), null)
  assert.equal(parseReading("n/a"), null)
  assert.equal(parseReading(""), null)
  assert.equal(parseReading(null), null)
  assert.equal(parseReading(Number.NaN), null)
})

test("the two Swimart pages come out as the readings on the paper", () => {
  const one = cleanReadings(parseModelJson(PAGE_1))
  assert.equal(one.free_chlorine, 0.61)
  assert.equal(one.total_chlorine, 0.68)
  assert.equal(one.alkalinity, 83)
  assert.equal(one.ph, 7.9)
  assert.equal(one.salt, 4572)
  assert.equal(one.cyanuric_acid, null)
  const two = cleanReadings(parseModelJson(PAGE_2))
  assert.equal(two.cyanuric_acid, 7)
  assert.equal(two.calcium, 143)
  // A 0 reading is a reading, not "missing".
  assert.equal(two.phosphates, 0)
  assert.equal(two.salt, null)
})

test('salt written as "4,572" is not read as 4 ppm, as a string or a bare number', () => {
  assert.equal(cleanReadings(parseModelJson('{"salt":"4,572"}')).salt, 4572)
  // Bare 4,572 is not valid JSON; it used to fail the whole scan.
  assert.equal(cleanReadings(parseModelJson('{"ph":7.9,"salt":4,572,"confidence":"high"}')).salt, 4572)
  assert.equal(cleanReadings(parseModelJson('{\n  "salt": 4,572\n}')).salt, 4572)
})

test("fences and chatter around the JSON are tolerated; real nonsense still fails", () => {
  assert.equal(parseModelJson("```json\n" + PAGE_1 + "\n```").ph, 7.9)
  assert.equal(parseModelJson("Here you go:\n" + PAGE_1 + "\nHope that helps").ph, 7.9)
  assert.throws(() => parseModelJson("I can't read this photo."))
})

test("values outside plausible bounds are dropped, not clamped", () => {
  const r = cleanReadings({ ph: 79, free_chlorine: 61, salt: -3, alkalinity: 83 })
  assert.equal(r.ph, null)
  assert.equal(r.free_chlorine, null)
  assert.equal(r.salt, null)
  assert.equal(r.alkalinity, 83)
})

test("free chlorine above total chlorine lowers confidence and says why", () => {
  // The "Previous: 7.1" trap: last visit's free chlorine read in place of today's.
  const bad = sanityCheck({ free_chlorine: 7.1, total_chlorine: 0.68 }, "high", null)
  assert.equal(bad.confidence, "low")
  assert.match(bad.notes, /Free chlorine \(7\.1\) reads higher than total chlorine \(0\.68\)/)
  const fine = sanityCheck({ free_chlorine: 0.61, total_chlorine: 0.68 }, "high", "ok")
  assert.deepEqual(fine, { confidence: "high", notes: "ok" })
  // A hair of rounding between free and total is not a fault.
  assert.equal(sanityCheck({ free_chlorine: 2.05, total_chlorine: 2.0 }, "high", null).confidence, "high")
  // Only one of the two on the page: nothing to compare.
  assert.equal(sanityCheck({ free_chlorine: 7.1, total_chlorine: null }, "high", null).confidence, "high")
})

test("the function keeps the guards that stop the known misreads", () => {
  const src = readFileSync(new URL("../ocr-water-test/index.ts", import.meta.url), "utf8")
  const prompt = src.slice(src.indexOf("const EXTRACTION_PROMPT"), src.indexOf("const RECEIPT_PROMPT"))
  assert.match(prompt, /round marker/)
  assert.match(prompt, /"Previous"/)
  assert.match(prompt, /Dosage/)
  assert.match(prompt, /Handwriting/)
  assert.match(prompt, /show[s]? through/)
  assert.match(prompt, /Sunscreen \(Stabiliser\)/)
  assert.match(prompt, /"Total Hardness" and "Magnesium Hardness"/)
  assert.match(prompt, /no thousands separators/)
  assert.match(prompt, /reading of 0 is a real reading/)
  assert.match(prompt, /"test_date"/)
  assert.match(prompt, /"pool_volume_l"/)
  assert.match(prompt, /PREV TEST/)
  // The reply is parsed and cleaned by the shared helpers, not ad hoc.
  assert.match(src, /parseModelJson\(rawText\)/)
  assert.match(src, /cleanReadings\(parsed\)/)
  // A model the key can't use must fall through to the next one, not stop scanning.
  assert.match(src, /result\.status === 404 \|\| result\.status === 403/)
  assert.match(src, /"claude-haiku-4-5-20251001"/)
})

const NOW = new Date("2026-10-24T02:00:00Z")

test("the test date is kept only when it can be right", () => {
  assert.equal(cleanTestDate("2026-10-15", NOW), "2026-10-15")
  // Today, and tomorrow in UTC (it is already tomorrow in Melbourne).
  assert.equal(cleanTestDate("2026-10-24", NOW), "2026-10-24")
  assert.equal(cleanTestDate("2026-10-25", NOW), "2026-10-25")
  assert.equal(cleanTestDate("2026-10-27", NOW), null)
  assert.equal(cleanTestDate("2027-10-15", NOW), null)
  assert.equal(cleanTestDate("2024-10-01", NOW), null)
  assert.equal(cleanTestDate("2024-11-01", NOW), "2024-11-01")
  assert.equal(cleanTestDate("2026-02-30", NOW), null)
  assert.equal(cleanTestDate("15 October 2026", NOW), null)
  assert.equal(cleanTestDate("15/10/2026", NOW), null)
  assert.equal(cleanTestDate(null, NOW), null)
  assert.equal(cleanTestDate(20261015, NOW), null)
})

test("pool volume reads 39,200 Litres and drops misreads", () => {
  assert.equal(cleanPoolVolume(39200), 39200)
  assert.equal(cleanPoolVolume("39,200"), 39200)
  assert.equal(cleanPoolVolume("39,200 Litres"), 39200)
  assert.equal(cleanPoolVolume(39.2), null)
  assert.equal(cleanPoolVolume(4000000), null)
  assert.equal(cleanPoolVolume(null), null)
})

test("an Anthropic account with no credit is not reported as a bad photo", () => {
  const body = '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}'
  assert.equal(isBillingError(400, body), true)
  assert.equal(isBillingError(400, '{"error":{"message":"image: could not process image"}}'), false)
  assert.equal(isBillingError(429, body), false)
  assert.equal(isBillingError(400, undefined), false)
})

test("a billing failure costs the owner nothing and says scanning is paused", () => {
  const src = readFileSync(new URL("../ocr-water-test/index.ts", import.meta.url), "utf8")
  assert.match(src, /isBillingError\(status, errText\)/)
  assert.match(src, /code: "OCR_PROVIDER_BILLING"/)
  // Neither a billing nor a key failure uses up one of the owner's 10 scans an hour.
  assert.match(src, /!isBillingError\(lastFail\.status, lastFail\.errText\) && lastFail\.status !== 401/)
})
