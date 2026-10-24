// File: supabase/functions/_shared/ocr-readings.js
// Pure helpers for the water-test OCR: no Deno or network, so node can test them.
//
// Pool shop printouts write numbers the way people do: "4,572" for salt,
// "<0.1", "0,61". The model passes some of those through, and JSON and
// parseFloat do not cope: parseFloat("4,572") is 4, and a bare 4,572 in the
// JSON makes the whole reply unparseable. These helpers read them properly.

// Plausible physical bounds. Anything outside is bad input, not a reading.
export const BOUNDS = {
  ph: [0, 14],
  free_chlorine: [0, 20],
  total_chlorine: [0, 20],
  alkalinity: [0, 500],
  cyanuric_acid: [0, 300],
  calcium: [0, 1500],
  salt: [0, 20000],
  phosphates: [0, 10000],
  tds: [0, 50000],
}

// A number from whatever the model wrote. Null when it is not a plain measured
// value ("<0.1", "n/a", "").
export function parseReading(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v !== "string") return null
  let s = v.trim()
  if (!s || /^[<>≤≥~]/.test(s)) return null
  // "4,572" and "4 572" are thousands; "0,61" is a decimal comma.
  s = s.replace(/(\d)[,\s](?=\d{3}(?!\d))/g, "$1")
  s = s.replace(/^(\d+),(\d{1,2})(?!\d)/, "$1.$2")
  const m = s.match(/^-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) ? n : null
}

// JSON.parse that survives fences, chatter around the object and
// thousands separators in bare numbers ("salt": 4,572).
export function parseModelJson(raw) {
  const text = String(raw ?? "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
  const attempt = (s) => {
    try { return JSON.parse(s) } catch { return undefined }
  }
  let out = attempt(text)
  if (out !== undefined) return out
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  const body = start >= 0 && end > start ? text.slice(start, end + 1) : text
  const fixed = body.replace(/(:\s*)(\d{1,3}(?:,\d{3})+(?:\.\d+)?)(?=\s*[,}\n])/g, (_, lead, num) => lead + num.replace(/,/g, ""))
  out = attempt(fixed)
  if (out !== undefined) return out
  throw new Error("unparseable")
}

export function cleanReadings(parsed) {
  const readings = {}
  for (const [key, [lo, hi]] of Object.entries(BOUNDS)) {
    const n = parseReading(parsed?.[key])
    readings[key] = n !== null && n >= lo && n <= hi ? n : null
  }
  return readings
}

// The date the water was tested, as YYYY-MM-DD, or null. A date that cannot be
// right is dropped rather than saved: a misread year would put the test in the
// wrong place in the owner's record.
//   - must be a real calendar date
//   - not in the future (2 days of slack: Australia is ahead of UTC)
//   - not more than 2 years old
export function cleanTestDate(v, now = new Date()) {
  if (typeof v !== "string") return null
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  const dayMs = 24 * 60 * 60 * 1000
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (date.getTime() > today + 2 * dayMs) return null
  if (date.getTime() < today - 730 * dayMs) return null
  return v.trim()
}

// Pool volume in litres as printed on the printout, or null. A pool outside
// 1,000 to 500,000 L is a misread (a kL figure left unconverted, say).
export function cleanPoolVolume(v) {
  const n = parseReading(v)
  return n !== null && n >= 1000 && n <= 500000 ? Math.round(n) : null
}

const RANK = { high: 2, medium: 1, low: 0 }

// Cross-checks a printout cannot get wrong. A failed check lowers confidence
// and says why, so the owner looks at the number instead of trusting it.
export function sanityCheck(readings, confidence, notes) {
  const found = []
  const free = readings.free_chlorine
  const total = readings.total_chlorine
  if (free !== null && total !== null && free > total + 0.1) {
    found.push(`Free chlorine (${free}) reads higher than total chlorine (${total}), which can't be right. Check both against the printout.`)
  }
  if (!found.length) return { confidence, notes }
  const capped = (RANK[confidence] ?? 0) > RANK.low ? "low" : confidence
  return { confidence: capped, notes: [...found, notes].filter(Boolean).join(" ").slice(0, 500) }
}
