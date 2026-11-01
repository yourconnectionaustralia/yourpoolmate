import assert from "node:assert/strict"
import test from "node:test"
import { COLOUR_ONLY_PADS, STRIP_PADS, STRIP_PROMPT, STRIP_STEPS, cleanStripScan, snapToStep } from "./strip-chart.js"

const pad = (value, confidence = "high") => ({ value, confidence })

// What the model sends back for a clear photo with the bottle's chart beside the strip.
const WITH_CHART = {
  strip_found: true,
  chart_in_photo: true,
  lighting: "good",
  pads: {
    free_chlorine: pad(3),
    total_chlorine: pad(3),
    ph: pad(7.6),
    alkalinity: pad(100),
    cyanuric_acid: pad(40, "medium"),
    calcium: pad(150),
  },
  confidence: "high",
  notes: null,
}

// A strip photographed on its own, no chart.
const NO_CHART = {
  strip_found: true,
  chart_in_photo: false,
  lighting: "good",
  pads: {
    free_chlorine: pad(1),
    total_chlorine: pad(1),
    ph: pad(7.8, "medium"),
    alkalinity: pad(120),
    cyanuric_acid: pad(50),
    calcium: pad(250),
  },
  confidence: "high",
  notes: null,
}

test("snapToStep picks the nearest typical step, lower on a tie", () => {
  assert.equal(snapToStep("ph", 7.4), 7.2)
  assert.equal(snapToStep("ph", 7.6), 7.8)
  assert.equal(snapToStep("ph", 7.5), 7.2)
  assert.equal(snapToStep("free_chlorine", 2), 1)
  assert.equal(snapToStep("free_chlorine", 2.1), 3)
  assert.equal(snapToStep("free_chlorine", 0), 0)
  assert.equal(snapToStep("alkalinity", 95), 80)
  assert.equal(snapToStep("alkalinity", 100), 80)
  assert.equal(snapToStep("alkalinity", 101), 120)
  assert.equal(snapToStep("ph", 3), 6.2)
  assert.equal(snapToStep("ph", 12), 8.4)
  assert.equal(snapToStep("ph", null), null)
  assert.equal(snapToStep("not_a_pad", 5), 5)
})

test("with the chart in the photo, the chart's own numbers are kept as printed", () => {
  const out = cleanStripScan(WITH_CHART)
  assert.equal(out.chart_in_photo, true)
  // 7.6 and 150 are not typical steps: they came off this bottle's chart.
  assert.equal(out.readings.ph, 7.6)
  assert.equal(out.readings.calcium, 150)
  assert.equal(out.readings.cyanuric_acid, 40)
  assert.equal(out.readings.alkalinity, 100)
  assert.equal(out.readings.free_chlorine, 3)
})

test("with the chart in the photo and good light, confidence can be high, but never above the weakest pad", () => {
  const out = cleanStripScan(WITH_CHART)
  // Cyanuric acid was only medium, so the whole read is medium.
  assert.equal(out.pad_confidence.ph, "high")
  assert.equal(out.pad_confidence.cyanuric_acid, "medium")
  assert.equal(out.confidence, "medium")
  const clean = cleanStripScan({ ...WITH_CHART, pads: { ...WITH_CHART.pads, cyanuric_acid: pad(40) } })
  assert.equal(clean.confidence, "high")
})

test("with no chart, readings snap to typical steps and confidence tops out at medium", () => {
  const out = cleanStripScan({
    ...NO_CHART,
    pads: { ...NO_CHART.pads, ph: pad(7.4), free_chlorine: pad(2), alkalinity: pad(95) },
  })
  assert.equal(out.chart_in_photo, false)
  assert.equal(out.readings.ph, 7.2)
  assert.equal(out.readings.free_chlorine, 1)
  assert.equal(out.readings.alkalinity, 80)
  assert.equal(out.pad_confidence.alkalinity, "medium")
  assert.equal(out.confidence, "medium")
})

test("with no chart, cyanuric acid and hardness are left blank even if the model gave a number", () => {
  const out = cleanStripScan(NO_CHART)
  assert.equal(out.readings.cyanuric_acid, null)
  assert.equal(out.readings.calcium, null)
  assert.equal("cyanuric_acid" in out.pad_confidence, false)
  assert.match(out.notes, /No colour chart was in the photo/)
  assert.match(out.notes, /Cyanuric acid and hardness need the chart/)
  // The four brand-independent pads still come through.
  for (const key of COLOUR_ONLY_PADS) assert.notEqual(out.readings[key], null, key)
})

test("poor light drops everything to low and says so", () => {
  const out = cleanStripScan({ ...WITH_CHART, lighting: "poor" })
  assert.equal(out.confidence, "low")
  for (const level of Object.values(out.pad_confidence)) assert.equal(level, "low")
  assert.match(out.notes, /light was poor/)
})

test("fair light caps at medium and warns about a step either way", () => {
  const out = cleanStripScan({ ...WITH_CHART, lighting: "fair", pads: { ...WITH_CHART.pads, cyanuric_acid: pad(40) } })
  assert.equal(out.confidence, "medium")
  assert.match(out.notes, /not ideal/)
})

test("an unknown lighting value is treated as fair, not good", () => {
  const out = cleanStripScan({ ...WITH_CHART, lighting: "great" })
  assert.equal(out.lighting, "fair")
  assert.notEqual(out.confidence, "high")
})

test("no strip in the photo gives no readings and a plain message", () => {
  const out = cleanStripScan({ strip_found: false, chart_in_photo: false, lighting: "good", pads: {}, confidence: "high", notes: null })
  assert.equal(out.strip_found, false)
  assert.deepEqual(Object.values(out.readings).filter((v) => v !== null), [])
  assert.equal(out.confidence, "low")
  assert.match(out.notes, /No dipped test strip/)
})

test("a model that says strip_found is false cannot smuggle readings through", () => {
  const out = cleanStripScan({ ...WITH_CHART, strip_found: false })
  assert.deepEqual(Object.values(out.readings).filter((v) => v !== null), [])
  assert.equal(out.chart_in_photo, false)
})

test("a white chlorine pad that is a real zero stays 0, not blank", () => {
  const out = cleanStripScan({ ...NO_CHART, pads: { ...NO_CHART.pads, free_chlorine: pad(0), total_chlorine: pad(0) } })
  assert.equal(out.readings.free_chlorine, 0)
  assert.equal(out.readings.total_chlorine, 0)
})

test("values outside what a pool can have are dropped", () => {
  const out = cleanStripScan({ ...WITH_CHART, pads: { ...WITH_CHART.pads, ph: pad(70), alkalinity: pad(-5), calcium: pad(5000) } })
  assert.equal(out.readings.ph, null)
  assert.equal(out.readings.alkalinity, null)
  assert.equal(out.readings.calcium, null)
  assert.equal(out.readings.free_chlorine, 3)
})

test("a missing confidence counts as low, and plain numbers instead of { value } objects are tolerated", () => {
  const out = cleanStripScan({
    strip_found: true, chart_in_photo: true, lighting: "good",
    pads: { ph: 7.2, free_chlorine: { value: 1 } },
    confidence: "high",
  })
  assert.equal(out.readings.ph, 7.2)
  assert.equal(out.readings.free_chlorine, 1)
  assert.equal(out.pad_confidence.ph, "low")
  assert.equal(out.pad_confidence.free_chlorine, "low")
  assert.equal(out.confidence, "low")
})

test("numbers written as text are read", () => {
  const out = cleanStripScan({ ...WITH_CHART, pads: { ...WITH_CHART.pads, ph: pad("7.2"), alkalinity: pad("80 ppm") } })
  assert.equal(out.readings.ph, 7.2)
  assert.equal(out.readings.alkalinity, 80)
})

test("free chlorine above total chlorine lowers confidence and says why", () => {
  const out = cleanStripScan({ ...WITH_CHART, pads: { ...WITH_CHART.pads, free_chlorine: pad(5), total_chlorine: pad(1), cyanuric_acid: pad(40) } })
  assert.equal(out.confidence, "low")
  assert.match(out.notes, /Free chlorine \(5\) reads higher than total chlorine \(1\)/)
})

test("the model's own note is kept, after ours, and notes stay short", () => {
  const out = cleanStripScan({ ...NO_CHART, notes: "The pH pad sits between 7.2 and 7.8." })
  assert.match(out.notes, /The pH pad sits between 7.2 and 7.8\./)
  assert.ok(out.notes.indexOf("No colour chart") < out.notes.indexOf("The pH pad"))
  const long = cleanStripScan({ ...NO_CHART, notes: "x".repeat(2000) })
  assert.ok(long.notes.length <= 500)
})

test("garbage in, nothing out", () => {
  for (const bad of [null, undefined, "text", 5, [], {}]) {
    const out = cleanStripScan(bad)
    assert.deepEqual(Object.values(out.readings).filter((v) => v !== null), [])
    assert.equal(out.confidence, "low")
  }
})

test("the prompt lists every pad and every typical step, so it cannot drift from the code", () => {
  for (const key of STRIP_PADS) assert.ok(STRIP_PROMPT.includes(`"${key}"`), key)
  for (const key of ["free_chlorine", "ph", "alkalinity", "cyanuric_acid", "calcium"]) {
    assert.ok(STRIP_PROMPT.includes(STRIP_STEPS[key].join(", ")), key)
  }
  assert.match(STRIP_PROMPT, /Never guess which pad is which/)
  assert.match(STRIP_PROMPT, /a real 0/)
})

test("typical steps are sorted and inside the bounds the printout reader accepts", () => {
  for (const [key, steps] of Object.entries(STRIP_STEPS)) {
    assert.deepEqual([...steps].sort((a, b) => a - b), steps, key)
  }
})
