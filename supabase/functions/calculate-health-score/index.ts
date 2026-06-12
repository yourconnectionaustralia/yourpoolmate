// File: supabase/functions/calculate-health-score/index.ts
// Deno runtime — NOT Node.js
// Calculates the Pool Health Score (0–100) from water test readings.
// Called server-side to ensure consistent scoring logic.
//
// June 2026 fixes:
//   - Saltwater pools: salt is now scored (most AU pools are salt chlorinators).
//     Pass sanitiser_type in the request body to activate the saltwater weights.
//   - Input validation: readings are clamped to plausible physical bounds;
//     non-numeric values are treated as "not tested".
//   - Removed dead "neutral 50" branch (nulls were already skipped).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── Scoring config ──────────────────────────────────────────

// Standard (non-salt) pools
const WEIGHTS_DEFAULT: Record<string, number> = {
  free_chlorine: 0.35,
  ph:            0.25,
  alkalinity:    0.20,
  cyanuric_acid: 0.10,
  calcium:       0.10,
}

// Saltwater chlorinator pools — salt level matters: too low and the
// chlorinator stops producing chlorine, too high and equipment corrodes.
const WEIGHTS_SALTWATER: Record<string, number> = {
  free_chlorine: 0.30,
  ph:            0.225,
  salt:          0.15,
  alkalinity:    0.175,
  cyanuric_acid: 0.075,
  calcium:       0.075,
}

// Target ranges (AU residential)
const RANGES: Record<string, { min: number; max: number }> = {
  free_chlorine: { min: 1.0,  max: 3.0  },
  ph:            { min: 7.2,  max: 7.6  },
  alkalinity:    { min: 80,   max: 120  },
  cyanuric_acid: { min: 30,   max: 50   },
  calcium:       { min: 200,  max: 400  },
  salt:          { min: 3000, max: 6000 }, // typical AU chlorinator spec
}

// Plausible physical bounds — anything outside is treated as bad input,
// not a catastrophic reading.
const BOUNDS: Record<string, { lo: number; hi: number }> = {
  free_chlorine: { lo: 0, hi: 20 },
  ph:            { lo: 0, hi: 14 },
  alkalinity:    { lo: 0, hi: 500 },
  cyanuric_acid: { lo: 0, hi: 300 },
  calcium:       { lo: 0, hi: 1500 },
  salt:          { lo: 0, hi: 20000 },
}

// The app stores human-readable sanitiser labels (e.g. "Saltwater chlorinator",
// "Mineral / magnesium" — see migration 003_pool_setup_fields). Match by substring.
function isSaltwater(sanitiserType?: string): boolean {
  const s = (sanitiserType ?? "").toLowerCase()
  return s.includes("salt") || s.includes("mineral") || s.includes("magnesium")
}

function sanitise(param: string, raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw))
  if (!Number.isFinite(n)) return null
  const b = BOUNDS[param]
  if (!b || n < b.lo || n > b.hi) return null
  return n
}

function scoreParam(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100
  const mid = (min + max) / 2
  const spread = (max - min) / 2
  const dist = Math.abs(value - mid) - spread
  // Penalise proportional to distance from range (score hits 0 at 2× spread)
  const penalty = Math.min(1, dist / spread)
  return Math.round(Math.max(0, 100 * (1 - penalty)))
}

export function calculateScore(
  readings: Record<string, unknown>,
  sanitiserType?: string,
): number {
  const weights = isSaltwater(sanitiserType) ? WEIGHTS_SALTWATER : WEIGHTS_DEFAULT

  let total = 0
  let weightSum = 0

  for (const [param, weight] of Object.entries(weights)) {
    const range = RANGES[param]
    const value = sanitise(param, readings[param])
    if (value !== null) {
      total += scoreParam(value, range.min, range.max) * weight
      weightSum += weight
    }
  }

  if (weightSum === 0) return 0
  return Math.round(total / weightSum)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorised", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorised", code: "INVALID_TOKEN" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()
    const { sanitiser_type, ...readings } = body ?? {}
    const score = calculateScore(readings, sanitiser_type)

    return new Response(
      JSON.stringify({ health_score: score }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("calculate-health-score error:", err)
    return new Response(
      JSON.stringify({ error: "Internal error", code: "SERVER_ERROR" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }
})
