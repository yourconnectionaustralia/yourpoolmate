// File: supabase/functions/delete-account/index.ts
// Deno runtime — NOT Node.js
//
// "Delete my account" from Profile. Requires a signed-in member (Supabase
// verifies the JWT; the function checks it again). The member can only ever
// delete their own account: the user id comes from the token, never the body.
//
//   POST { "confirm": "DELETE" }  ->  { ok: true }
//
// Secrets: STRIPE_SECRET_KEY (used only to cancel a live subscription),
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto-provided).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { deleteAccount } from "../_shared/delete-account.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const token = (req.headers.get("authorization") ?? "").replace(/^bearer\s+/i, "").trim()
  if (!token) return json({ error: "Please sign in again.", code: "NO_AUTH" }, 401)

  let body: Record<string, unknown> = {}
  try {
    const raw = await req.text()
    if (raw.length > 2000) return json({ error: "Body too large" }, 400)
    body = raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return json({ error: "Bad JSON" }, 400)
  }
  if (body.confirm !== "DELETE") {
    return json({ error: "Confirmation missing.", code: "NOT_CONFIRMED" }, 400)
  }

  const url = Deno.env.get("SUPABASE_URL")!
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await asUser.auth.getUser(token)
  if (error || !data?.user) return json({ error: "Please sign in again.", code: "NO_AUTH" }, 401)

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  try {
    const result = await deleteAccount(admin, { id: data.user.id, email: data.user.email }, {
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? null,
    })
    if (!result.ok) return json({ error: result.message, code: result.code }, 500)
    console.log(`delete-account: deleted ${data.user.id}`)
    return json({ ok: true })
  } catch (err) {
    console.error("delete-account failed:", err)
    return json({ error: "Something went wrong. Nothing more was deleted. Please try again.", code: "SERVER_ERROR" }, 500)
  }
})
