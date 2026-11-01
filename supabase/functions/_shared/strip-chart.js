// File: supabase/functions/_shared/strip-chart.js
// Pure helpers for reading a dipped test strip from a photo: no Deno or network,
// so node can test them. Used by ocr-water-test when the app sends { kind: "strip" }.
//
// Why this is stricter than the printout reader: a printout has the number
// printed on it. A strip only has a colour, and colours shift with the light.
// So the model is asked for the closest chart step per pad, and everything it
// returns is capped and checked here before the owner sees it. The owner still
// confirms every value in the app before anything is saved.
//
// STRIP_STEPS are the typical steps on common pool test strips. They are not one
// brand's chart. When the bottle's own chart is in the photo, the model reads that
// chart instead and its numbers are used as printed (see cleanStripScan).

import { BOUNDS, parseReading, sanityCheck } from "./ocr-readings.js"

// Keys match the water_tests columns and the printout reader.
export const STRIP_STEPS = {
  free_chlorine: [0, 0.5, 1, 3, 5, 10],
  total_chlorine: [0, 0.5, 1, 3, 5, 10],
  ph: [6.2, 6.8, 7.2, 7.8, 8.4],
  alkalinity: [0, 40, 80, 120, 180, 240],
  cyanuric_acid: [0, 30, 50, 100, 150, 300],
  calcium: [0, 100, 250, 500, 1000],
}

export const STRIP_PADS = Object.keys(STRIP_STEPS)

// Pads whose colour scale is much the same on every brand. With no chart in the
// photo these can still be matched to typical colours. The other two (cyanuric
// acid, hardness) differ too much between brands to read without the chart.
export const COLOUR_ONLY_PADS = ["free_chlorine", "total_chlorine", "ph", "alkalinity"]

const RANK = { high: 2, medium: 1, low: 0 }
const NAME = { 2: "high", 1: "medium", 0: "low" }
const levelOf = (v) => (v in RANK ? v : "low")
const lowest = (...levels) => NAME[Math.min(...levels.map((l) => RANK[levelOf(l)]))]

// Nearest typical step. A tie goes to the lower step.
export function snapToStep(key, n) {
  const steps = STRIP_STEPS[key]
  if (!steps || n === null || n === undefined) return n ?? null
  let best = steps[0]
  for (const s of steps) if (Math.abs(s - n) < Math.abs(best - n)) best = s
  return best
}

const stepsText = (key) => STRIP_STEPS[key].join(", ")

export const STRIP_PROMPT = `You are reading a photo of a swimming pool test strip that has been dipped in pool water, so its colour pads have changed colour. For each pad, work out which step of the colour chart it matches. The owner checks your answers before anything is saved, but you must be honest about what you can and cannot tell from a photo.

Return ONLY a JSON object, no other text, in exactly this shape:

{
  "strip_found": boolean,
  "chart_in_photo": boolean,
  "lighting": "good" | "fair" | "poor",
  "pads": {
    "free_chlorine":  { "value": number | null, "confidence": "high" | "medium" | "low" },
    "total_chlorine": { "value": number | null, "confidence": "high" | "medium" | "low" },
    "ph":             { "value": number | null, "confidence": "high" | "medium" | "low" },
    "alkalinity":     { "value": number | null, "confidence": "high" | "medium" | "low" },
    "cyanuric_acid":  { "value": number | null, "confidence": "high" | "medium" | "low" },
    "calcium":        { "value": number | null, "confidence": "high" | "medium" | "low" }
  },
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}

Step 1, is there a dipped strip?
- strip_found is true only when a test strip with colour pads is visible and the pads have clearly changed colour from being dipped.
- If there is no strip, or EVERY pad still looks plain white or unchanged (not dipped yet), or the photo is too dark or blurred to judge colour, set strip_found to false and every pad value to null.

Step 2, is the bottle's colour chart in the photo?
- Strip bottles have a printed colour chart: rows of coloured blocks, each with a number. chart_in_photo is true only when that chart is clearly visible in the same photo as the strip.
- If it is, match each pad to the closest block in that pad's row and report the number printed under that block. Same photo means same light, so this is by far the most accurate method. Use the numbers printed on the chart, even when they differ from the typical steps below.

Step 3, no chart in the photo.
- Typical steps (use these only when there is no chart in the photo):
  free_chlorine and total_chlorine (ppm): ${stepsText("free_chlorine")}
  ph: ${stepsText("ph")}
  alkalinity (total alkalinity, ppm): ${stepsText("alkalinity")}
  cyanuric_acid (ppm): ${stepsText("cyanuric_acid")}
  calcium (calcium or total hardness, ppm): ${stepsText("calcium")}
- Choose exactly one typical step per pad. Never give an in-between number.
- Colour direction that is much the same on every brand: a chlorine pad goes from white or pale (low) to deep pink or purple (high); a pH pad goes from yellow or orange (low) to red or pink (high); an alkalinity pad goes from yellow-green (low) through green to blue (high).
- Colour scales for cyanuric acid and hardness differ a lot between brands. With no chart in the photo, return null for those two.

Identifying pads:
- Work out which pad is which from the labels printed on the chart, bottle or strip. If nothing in the photo tells you which pad is which, return null for the pads you cannot identify and say so in notes. Never guess which pad is which.
- Only report pads that are on the strip. A strip with only one chlorine pad: report it as free_chlorine. Ignore pads that are not in the list (bromine, copper, iron, salt, phosphates).
- A chlorine pad that is still white or very pale while the other pads have clearly changed colour is a real 0. Return 0, not null.

lighting:
- "good": even daylight or a white background, white parts look white.
- "fair": a slight warm or cool tint, or a mild shadow.
- "poor": strong colour cast (yellow indoor light, coloured light), torch glare on the pads, deep shadow, or a blurred strip. When lighting is "poor", give every pad confidence "low".

confidence (for each pad, and overall):
- "high": the pad clearly matches one step.
- "medium": it sits between two steps, or the match is reasonable but the light is not ideal.
- "low": it is a best guess.
- Use null instead of guessing a pad you cannot see or cannot identify.

notes: at most two short plain-English sentences about anything that affects accuracy, for example "Warm indoor light, so colours look yellower than they are." or "The pH pad sits between 7.2 and 7.8."`

// parsed: the model's JSON. Returns what the app needs to show the review screen.
//   readings        { free_chlorine, total_chlorine, ph, alkalinity, cyanuric_acid, calcium }
//   pad_confidence  confidence for each pad that has a reading
//   confidence      overall, never higher than the weakest reading
export function cleanStripScan(parsed) {
  const stripFound = parsed?.strip_found === true
  const chartInPhoto = stripFound && parsed?.chart_in_photo === true
  const lighting = ["good", "fair", "poor"].includes(parsed?.lighting) ? parsed.lighting : "fair"

  // The most any reading can be trusted, given the photo.
  let cap = "high"
  if (!chartInPhoto) cap = lowest(cap, "medium")
  if (lighting === "fair") cap = lowest(cap, "medium")
  if (lighting === "poor") cap = "low"

  const readings = Object.fromEntries(STRIP_PADS.map((k) => [k, null]))
  const padConfidence = {}
  const pads = parsed?.pads && typeof parsed.pads === "object" ? parsed.pads : {}

  if (stripFound) {
    for (const key of STRIP_PADS) {
      // Without the chart, only the pads that read the same on every brand count.
      if (!chartInPhoto && !COLOUR_ONLY_PADS.includes(key)) continue
      const pad = pads[key] ?? parsed?.[key]
      const raw = pad && typeof pad === "object" ? pad.value : pad
      let n = parseReading(raw)
      if (n === null) continue
      const [lo, hi] = BOUNDS[key]
      if (n < lo || n > hi) continue
      // Typical steps apply only when the model was matching to typical colours.
      if (!chartInPhoto) n = snapToStep(key, n)
      readings[key] = n
      padConfidence[key] = lowest(pad && typeof pad === "object" ? pad.confidence : "low", cap)
    }
  }

  const found = Object.values(readings).some((v) => v !== null)
  const weakest = Object.values(padConfidence)
  const confidence = found ? lowest(parsed?.confidence, cap, ...weakest) : "low"

  const messages = []
  if (!stripFound) {
    messages.push("No dipped test strip could be seen in that photo.")
  } else {
    if (!chartInPhoto) {
      messages.push("No colour chart was in the photo, so the strip was matched to typical colours. Cyanuric acid and hardness need the chart in the photo to be read.")
    }
    if (lighting === "poor") messages.push("The light was poor, so colours may be well off.")
    else if (lighting === "fair") messages.push("The light was not ideal, so colours may be a step off.")
  }
  const modelNotes = typeof parsed?.notes === "string" ? parsed.notes.trim() : ""
  if (modelNotes) messages.push(modelNotes)

  const checked = sanityCheck(readings, confidence, messages.join(" ").slice(0, 500) || null)

  return {
    strip_found: stripFound,
    chart_in_photo: chartInPhoto,
    lighting,
    readings,
    pad_confidence: padConfidence,
    confidence: checked.confidence,
    notes: checked.notes ? checked.notes.slice(0, 500) : null,
  }
}
