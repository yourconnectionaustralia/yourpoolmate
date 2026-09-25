// File: supabase/functions/ocr-water-test/index.ts
// Deno runtime — NOT Node.js
//
// OCR for pool shop water test printouts and test strips.
// Accepts a base64 image, sends it to Claude Vision, returns structured
// chemical readings ready to pre-fill the water test form.
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
//   OCR_MODEL — defaults to claude-haiku-4-5 (alias → current Haiku 4.5 snapshot)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

// Prefer the alias; fall back to the pinned snapshot if the alias fails.
const DEFAULT_MODELS = [
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
]

// The readings we ask Claude to extract. Keys match the water_tests columns.
const EXTRACTION_PROMPT = `You are reading a photo of a swimming pool water test result — either a pool shop printout or a test strip chart. Extract the chemical readings.

Return ONLY a JSON object, no other text, with exactly these keys (use null for anything not visible or not legible):

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
  "confidence": "high" | "medium" | "low",  // your overall read confidence
  "notes": string | null                 // anything ambiguous, e.g. "salt value partially obscured"
}

Rules:
- Numbers only — strip units.
- If the printout shows a range (e.g. "7.2-7.6"), that is a TARGET range, not the reading. Only extract actual measured values.
- If you cannot find any water test data in the image, return all readings as null with confidence "low" and explain in notes.
- Never guess a value you cannot actually read.`

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
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.base64Data } },
          { type: "text", text: EXTRACTION_PROMPT },
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
        const result = await callAnthropic({ apiKey, model, mediaType, base64Data })
        if (result.ok) {
          rawText = result.rawText
          lastFail = null
          console.log("OCR Anthropic ok model=", model, "attempt=", attempt + 1)
          break
        }
        lastFail = { status: result.status, errText: result.errText }
        console.error("OCR Anthropic fail model=", model, "attempt=", attempt + 1, "status=", result.status)

        // Bad key / bad model — don't burn retries on the same model
        if (result.status === 401 || result.status === 403) {
          await admin.from("ocr_calls").insert({ user_id: user.id, status: "error" })
          return providerErrorResponse(result.status, result.errText)
        }
        if (result.status === 404) {
          // try next model candidate
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
      // 401 already returned; 404 tries next model; others stop after exhausting retries
      if (lastFail.status !== 404) break
    }

    if (lastFail) {
      await admin.from("ocr_calls").insert({ user_id: user.id, status: "error" })
      return providerErrorResponse(lastFail.status, lastFail.errText)
    }

    // ── 5. Parse + sanitise the model's JSON ──────────────────
    let parsed: Record<string, unknown>
    try {
      // Tolerate accidental markdown fencing
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error("OCR returned unparseable output:", rawText.slice(0, 200))
      await admin.from("ocr_calls").insert({ user_id: user.id, status: "error" })
      return jsonResponse({
        error: "Couldn't read values from that photo — try a clearer shot",
        code: "OCR_PARSE_ERROR",
      }, 422)
    }

    // Clamp to plausible physical bounds; junk → null
    const bounds: Record<string, [number, number]> = {
      ph: [0, 14], free_chlorine: [0, 20], total_chlorine: [0, 20],
      alkalinity: [0, 500], cyanuric_acid: [0, 300], calcium: [0, 1500],
      salt: [0, 20000], phosphates: [0, 10000], tds: [0, 50000],
    }
    const readings: Record<string, number | null> = {}
    for (const [key, [lo, hi]] of Object.entries(bounds)) {
      const v = parsed[key]
      const n = typeof v === "number" ? v : parseFloat(String(v))
      readings[key] = Number.isFinite(n) && n >= lo && n <= hi ? n : null
    }

    const confidence = ["high", "medium", "low"].includes(String(parsed.confidence))
      ? String(parsed.confidence) : "low"
    const notes = typeof parsed.notes === "string" ? parsed.notes.slice(0, 500) : null

    // ── 6. Log the successful call ────────────────────────────
    await admin.from("ocr_calls").insert({ user_id: user.id, status: "ok" })

    return jsonResponse({
      readings,
      confidence,
      notes,
      source: "ocr",
      scans_remaining_this_hour: Math.max(0, RATE_LIMIT - (count ?? 0) - 1),
    })

  } catch (err) {
    console.error("ocr-water-test error:", err)
    return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
  }
})
