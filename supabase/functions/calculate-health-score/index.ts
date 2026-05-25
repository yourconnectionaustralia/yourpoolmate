// File: supabase/functions/calculate-health-score/index.ts
// Deno runtime — NOT Node.js
// Calculates the Pool Health Score (0–100) from water test readings.
// Called server-side to ensure consistent scoring logic.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Health Score weighting (matches SKILL.md spec)
const WEIGHTS = {
  free_chlorine: 0.35,
  ph:            0.25,
  alkalinity:    0.20,
  cyanuric_acid: 0.10,
  calcium:       0.10,
}

// Target ranges
const RANGES = {
  free_chlorine: { min: 1.0, max: 3.0 },
  ph:            { min: 7.2, max: 7.6 },
  alkalinity:    { min: 80,  max: 120  },
  cyanuric_acid: { min: 30,  max: 50   },
  calcium:       { min: 200, max: 400  },
}

function scoreParam(value: number | null, min: number, max: number): number {
  if (value === null || value === undefined) return 50 // neutral when unknown
  if (value >= min && value <= max) return 100
  const mid = (min + max) / 2
  const spread = (max - min) / 2
  const dist = Math.abs(value - mid) - spread
  // Penalise proportional to distance from range (max penalty = 0 at 2× spread)
  const penalty = Math.min(1, dist / spread)
  return Math.round(Math.max(0, 100 * (1 - penalty)))
}

function calculateScore(readings: Record<string, number | null>): number {
  let total = 0
  let weightSum = 0

  for (const [param, weight] of Object.entries(WEIGHTS)) {
    const range = RANGES[param as keyof typeof RANGES]
    const value = readings[param] ?? null
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
    const score = calculateScore(body)

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
