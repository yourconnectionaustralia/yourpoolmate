// File: supabase/functions/ocr-water-test/index.ts
// Deno runtime — NOT Node.js
//
// OCR for pool shop water test printouts and test strips.
// Accepts a base64 image, sends it to Claude Vision, returns structured
// chemical readings ready to pre-fill the water test form.
//
// With { kind: "receipt" } it reads a pool shop receipt instead and returns
// the product lines (name, pack size, quantity, price) for My Shed. Same
// auth, same rate limit, same image rules. Nothing is saved here: the owner
// checks every line in the app before anything goes in the shed.
//
// Security:
//   - Auth required (valid Supabase JWT)
//   - Rate limited: 10 calls per user per hour (tracked in public.ocr_calls — migration 005,
//     service-role only — users can't reset their own counter)
//   - Image capped at 4MB base64 (~3MB binary)
//
// Required secrets (Supabase dashboard → Edge Functions → Secrets,
// or GitHub Actions secret ANTHROPIC_API_KEY synced by Deploy Supabase):
//   ANTHROPIC_API_KEY         — Anthropic API key (sk-ant-…)
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
//   SUPABASE_URL              — auto-provided by Supabase
// Optional:
//   OCR_MODEL — tried first when set. Otherwise DEFAULT_MODELS below, in order.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { cleanPoolVolume, cleanReadings, cleanTestDate, isBillingError, parseModelJson, sanityCheck } from "../_shared/ocr-readings.js"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" }

const MAX_BASE64_CHARS = 4 * 1024 * 1024 // ~3MB binary image
const RATE_LIMIT = 10                     // calls
const RATE_WINDOW_MINUTES = 60
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
])

// A printout is a dense page with bubbles, handwriting and show-through, so the
// strongest model comes first. A model the key can't use (404 not found, 403 no
// access) moves on to the next one, ending at the pinned Haiku snapshot.
const DEFAULT_MODELS = [
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
]

// The readings we ask Claude to extract. Keys match the water_tests columns.
const EXTRACTION_PROMPT = `You are reading a photo of a swimming pool water test result — a pool shop printout (often several pages, photographed one page at a time) or a test strip chart. Extract the MEASURED readings only.

Return ONLY a JSON object, no other text, with exactly these keys (use null for anything not on this page or not legible):

{
  "ph": number | null,
  "free_chlorine": number | null,        // ppm or mg/L
  "total_chlorine": number | null,       // ppm or mg/L
  "alkalinity": number | null,           // total alkalinity, ppm
  "cyanuric_acid": number | null,        // stabiliser, ppm
  "calcium": number | null,              // calcium hardness, ppm
  "salt": number | null,                 // ppm
  "phosphates": number | null,           // ppb or ppm as printed
  "tds": number | null,                  // total dissolved solids, ppm
  "test_date": string | null,            // the day the water was tested, as YYYY-MM-DD
  "pool_volume_l": number | null,        // pool volume in litres, as printed
  "confidence": "high" | "medium" | "low",  // your overall read confidence
  "notes": string | null                 // anything ambiguous, e.g. "salt value partially obscured"
}

Where the measured value is:
- On chart-style printouts (for example Swimart) each test has a coloured bar, and the measured value is the number inside the round marker sitting on that bar. The other numbers near it are NOT readings: "Low range", "Desired range" and "High range" are target ranges, "Previous" is the last visit's result, and "Dosage" is how much product to add.
- On table-style printouts it is the column headed Result, Reading or Your result.

Never use these as readings:
- Target ranges (e.g. "7.2-7.6", "Desired Range 2-5").
- Numbers beside the word "Previous" (the earlier test).
- Dosage amounts or product sizes (e.g. "0.36kg", "0.64L", "2.76kg").
- Handwriting or pen notes added by hand (e.g. "2k Alk", "700ml Acid"). They are instructions, not results.
- Pool volume, dates, customer numbers.
- Faint, washed-out, mirrored or reversed text that shows through from the back of the page.

Matching names to keys:
- free_chlorine: "Free Chlorine". total_chlorine: "Total Chlorine". "Combined Chlorine" is neither, leave it out.
- alkalinity: "Alkalinity" or "Total Alkalinity".
- cyanuric_acid: "Cyanuric Acid", "CYA", "Stabiliser", "Conditioner" or a brand name such as "Sunscreen (Stabiliser)".
- calcium: only a line named "Calcium Hardness" (some printouts add "(Salt)"). "Total Hardness" and "Magnesium Hardness" are different tests: do not use them for calcium. If there is no Calcium Hardness line, use null.
- salt: "Salt" or "Salt Level".

test_date and pool_volume_l:
- test_date is the day THIS test was done: the "Test date" on the printout, or the date beside the customer or pool number in the page header. It is never the "Previous test" date (e.g. "PREV TEST: 24 March 2026") and never a print date. Australian dates are day first: "15 October 2026" is 2026-10-15. If the day and month could be read either way (e.g. "04/05/2026") or the year is unclear, use null.
- pool_volume_l is the "Pool Volume" printed in the header, in litres (convert kilolitres: 39.2 kL is 39200). Use null if it is not printed.

Formatting:
- Plain numbers only, no units and no thousands separators: write 4572, not "4,572" or "4 572".
- A reading of 0 is a real reading: return 0, not null.
- Use null for any test that is not on this page. A page with only some of the tests is normal.
- If you cannot find any water test data in the image, return all readings as null with confidence "low" and explain in notes.
- Never guess a value you cannot actually read. If the number in the marker is partly hidden or blurred, use null and say so in notes.`

const RECEIPT_PROMPT = `You are reading a photo of a receipt from a pool shop or hardware store. List the pool chemical products on it.

Return ONLY a JSON object, no other text, in this shape:

{
  "store": string | null,               // shop name as printed
  "date": string | null,                // purchase date as YYYY-MM-DD, null if not printed
  "lines": [
    {
      "name": string,                   // product description as printed, e.g. "LIQUID CHLORINE 15L"
      "pack_amount": number | null,     // size of one pack, e.g. 15
      "pack_unit": "g" | "kg" | "mL" | "L" | null,
      "quantity": number | null,        // how many packs, default 1 if not shown
      "price": number | null            // line total in dollars, as printed
    }
  ],
  "confidence": "high" | "medium" | "low",
  "notes": string | null
}

Rules:
- Only pool and spa chemicals (chlorine, acid, buffer, soda ash, stabiliser, salt, calcium, clarifier, algaecide and similar). Skip toys, parts, services, bags and discounts.
- Never guess a number you cannot read. Use null.
- If there is no receipt in the image, return an empty lines array with confidence "low" and say why in notes.`

const RECEIPT_UNITS = new Set(["g", "kg", "mL", "L"])

function cleanReceipt(parsed: Record<string, unknown>) {
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)
  const num = (v: unknown, lo: number, hi: number) => {
    const n = typeof v === "number" ? v : parseFloat(String(v))
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null
  }
  const rawLines = Array.isArray(parsed.lines) ? parsed.lines.slice(0, 20) : []
  const lines = rawLines
    .map((l: Record<string, unknown>) => {
      const unit = String(l?.pack_unit ?? "")
      const fixedUnit = unit.toLowerCase() === "ml" ? "mL" : unit.toLowerCase() === "l" ? "L" : unit.toLowerCase()
      return {
        name: text(l?.name, 120),
        pack_amount: num(l?.pack_amount, 0.01, 100000),
        pack_unit: RECEIPT_UNITS.has(fixedUnit) ? fixedUnit : null,
        quantity: num(l?.quantity, 1, 100) ?? 1,
        price: num(l?.price, 0, 10000),
      }
    })
    .filter((l) => l.name)
  const date = text(parsed.date, 10)
  return {
    store: text(parsed.store, 80),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    lines,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function modelCandidates(): string[] {
  const preferred = (Deno.env.get("OCR_MODEL") ?? "").trim()
  const list = preferred ? [preferred, ...DEFAULT_MODELS] : [...DEFAULT_MODELS]
  // de-dupe, keep order
  return [...new Set(list.filter(Boolean))]
}

async function callAnthropic(opts: {
  apiKey: string
  model: string
  mediaType: string
  base64Data: string
  prompt: string
}): Promise<{ ok: true; rawText: string } | { ok: false; status: number; errText: string }> {
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.base64Data } },
          { type: "text", text: opts.prompt },
        ],
      }],
    }),
  })

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    return { ok: false, status: anthropicRes.status, errText }
  }

  const anthropicData = await anthropicRes.json()
  const rawText: string = anthropicData?.content?.[0]?.text ?? ""
  return { ok: true, rawText }
}

function providerErrorResponse(status: number, errText: string): Response {
  const snippet = errText.slice(0, 300)
  console.error("Anthropic API error:", status, snippet)

  if (isBillingError(status, errText)) {
    return jsonResponse({
      error: "Scanning is paused right now — you can still type the readings in.",
      code: "OCR_PROVIDER_BILLING",
      detail: "The Anthropic account has no credit. Add credit at console.anthropic.com → Plans & Billing.",
    }, 503)
  }
  if (status === 401 || status === 403) {
    return jsonResponse({
      error: "Scanning isn't available right now — you can still type the readings in.",
      code: "OCR_PROVIDER_AUTH",
      detail: "Anthropic rejected the API key (check GitHub Actions secret ANTHROPIC_API_KEY and Supabase secrets).",
    }, 503)
  }
  if (status === 404) {
    return jsonResponse({
      error: "Scanning isn't available right now — you can still type the readings in.",
      code: "OCR_MODEL_NOT_FOUND",
      detail: "Anthropic model not found — set OCR_MODEL or update DEFAULT_MODELS.",
    }, 503)
  }
  if (status === 429) {
    return jsonResponse({
      error: "Scan limit reached — try again in a little while.",
      code: "OCR_PROVIDER_RATE",
    }, 429)
  }
  if (status === 400) {
    return jsonResponse({
      error: "Couldn't read that photo — try a flatter, well-lit shot.",
      code: "OCR_BAD_IMAGE",
      detail: snippet,
    }, 400)
  }
  return jsonResponse({
    error: "Couldn't read the image right now — please try again",
    code: "OCR_UPSTREAM_ERROR",
  }, 502)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405)
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorised", code: "AUTH_REQUIRED" }, 401)
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return jsonResponse({ error: "Unauthorised", code: "INVALID_TOKEN" }, 401)
    }

    // ── 2. Rate limit (service role — tamper-proof) ──────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString()
    const { count, error: countError } = await admin
      .from("ocr_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart)

    if (countError) {
      console.error("ocr rate-limit count error:", countError)
      return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
    }
    if ((count ?? 0) >= RATE_LIMIT) {
      await admin.from("ocr_calls").insert({ user_id: user.id, status: "rejected" })
      return jsonResponse({
        error: `Scan limit reached (${RATE_LIMIT}/hour). Try again in a little while.`,
        code: "RATE_LIMITED",
      }, 429)
    }

    // ── 3. Validate input ─────────────────────────────────────
    const body = await req.json().catch(() => null)
    const imageBase64: unknown = body?.image_base64
    const mediaType: string = body?.media_type ?? "image/jpeg"
    const kind: "test" | "receipt" = body?.kind === "receipt" ? "receipt" : "test"

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      return jsonResponse({ error: "image_base64 is required", code: "BAD_REQUEST" }, 400)
    }
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return jsonResponse({
        error: "Image too large — please use a photo under 3MB",
        code: "IMAGE_TOO_LARGE",
      }, 413)
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return jsonResponse({ error: "Unsupported image type", code: "BAD_MEDIA_TYPE" }, 400)
    }
    // Strip a data-URL prefix and any whitespace the client may have left in
    const base64Data = imageBase64
      .replace(/^data:image\/\w+;base64,/, "")
      .replace(/\s+/g, "")

    if (!base64Data) {
      return jsonResponse({ error: "image_base64 is required", code: "BAD_REQUEST" }, 400)
    }

    // ── 4. Call Claude Vision ─────────────────────────────────
    const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim()
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY secret is not set")
      return jsonResponse({ error: "OCR not configured", code: "NOT_CONFIGURED" }, 503)
    }
    if (!apiKey.startsWith("sk-ant-")) {
      console.error("ANTHROPIC_API_KEY does not look like an Anthropic key (expected sk-ant-…)")
      return jsonResponse({
        error: "Scanning isn't available right now — you can still type the readings in.",
        code: "OCR_PROVIDER_AUTH",
        detail: "ANTHROPIC_API_KEY format looks wrong — replace the GitHub Actions / Supabase secret.",
      }, 503)
    }

    const models = modelCandidates()
    let lastFail: { status: number; errText: string } | null = null
    let rawText = ""

    for (const model of models) {
      // One retry on transient overload / rate limit for this model
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await callAnthropic({
          apiKey, model, mediaType, base64Data,
          prompt: kind === "receipt" ? RECEIPT_PROMPT : EXTRACTION_PROMPT,
        })
        if (result.ok) {
          rawText = result.rawText
          lastFail = null
          console.log("OCR Anthropic ok model=", model, "attempt=", attempt + 1)
          break
        }
        lastFail = { status: result.status, errText: result.errText }
        console.error("OCR Anthropic fail model=", model, "attempt=", attempt + 1, "status=", result.status)

        // Bad key: no other model will work either.
        if (result.status === 401) {
          return providerErrorResponse(result.status, result.errText)
        }
        if (result.status === 404 || result.status === 403) {
          // This model isn't available to the key: try the next candidate
          break
        }
        if ((result.status === 429 || result.status === 529) && attempt === 0) {
          await sleep(600)
          continue
        }
        // Non-retryable for this model
        break
      }
      if (!lastFail) break // success
      // 401 already returned; 404 and 403 try the next model; others stop after exhausting retries
      if (lastFail.status !== 404 && lastFail.status !== 403) break
    }

    if (lastFail) {
      // A billing or key failure is ours, not theirs: it must not use up one of
      // the owner's scans for the hour.
      if (!isBillingError(lastFail.status, lastFail.errText) && lastFail.status !== 401) {
        await admin.from("ocr_calls").insert({ user_id: user.id, status: "error" })
      }
      return providerErrorResponse(lastFail.status, lastFail.errText)
    }

    // ── 5. Parse + sanitise the model's JSON ──────────────────
    let parsed: Record<string, unknown>
    try {
      // Tolerates markdown fences, chatter around the object, and "4,572"-style numbers
      parsed = parseModelJson(rawText)
    } catch {
      console.error("OCR returned unparseable output:", rawText.slice(0, 200))
      await admin.from("ocr_calls").insert({ user_id: user.id, status: "error" })
      return jsonResponse({
        error: "Couldn't read values from that photo — try a clearer shot",
        code: "OCR_PARSE_ERROR",
      }, 422)
    }

    const confidenceOf = (v: unknown) => ["high", "medium", "low"].includes(String(v)) ? String(v) : "low"
    const remaining = Math.max(0, RATE_LIMIT - (count ?? 0) - 1)

    if (kind === "receipt") {
      await admin.from("ocr_calls").insert({ user_id: user.id, status: "ok" })
      return jsonResponse({
        receipt: cleanReceipt(parsed),
        confidence: confidenceOf(parsed.confidence),
        notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 500) : null,
        source: "ocr",
        scans_remaining_this_hour: remaining,
      })
    }

    // Clamp to plausible physical bounds; junk → null. Reads "4,572" as 4572.
    const readings = cleanReadings(parsed)

    const checked = sanityCheck(
      readings,
      ["high", "medium", "low"].includes(String(parsed.confidence)) ? String(parsed.confidence) : "low",
      typeof parsed.notes === "string" ? parsed.notes.slice(0, 500) : null,
    )
    const confidence = checked.confidence
    const notes = checked.notes
    const testDate = cleanTestDate(parsed.test_date)
    const poolVolumeL = cleanPoolVolume(parsed.pool_volume_l)

    // ── 6. Log the successful call ────────────────────────────
    await admin.from("ocr_calls").insert({ user_id: user.id, status: "ok" })

    return jsonResponse({
      readings,
      test_date: testDate,
      pool_volume_l: poolVolumeL,
      confidence,
      notes,
      source: "ocr",
      scans_remaining_this_hour: remaining,
    })

  } catch (err) {
    console.error("ocr-water-test error:", err)
    return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
  }
})
