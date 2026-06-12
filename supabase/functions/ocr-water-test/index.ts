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
// Required secrets (Supabase dashboard → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY        — Anthropic API key
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
//   SUPABASE_URL              — auto-provided by Supabase
// Optional:
//   OCR_MODEL — defaults to claude-haiku-4-5-20251001 (fast + cheap; fine for OCR)

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
    // Strip a data-URL prefix if the client sent one
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")

    // ── 4. Call Claude Vision ─────────────────────────────────
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY secret is not set")
      return jsonResponse({ error: "OCR not configured", code: "NOT_CONFIGURED" }, 503)
    }
    const model = Deno.env.get("OCR_MODEL") ?? "claude-haiku-4-5-20251001"

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error("Anthropic API error:", anthropicRes.status, errText)
      await admin.from("ocr_calls").insert({ user_id: user.id, status: "error" })
      return jsonResponse({
        error: "Couldn't read the image right now — please try again",
        code: "OCR_UPSTREAM_ERROR",
      }, 502)
    }

    const anthropicData = await anthropicRes.json()
    const rawText: string = anthropicData?.content?.[0]?.text ?? ""

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
