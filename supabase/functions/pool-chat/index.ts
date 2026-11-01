// File: supabase/functions/pool-chat/index.ts
// Deno runtime — NOT Node.js
//
// Ask Mate: the in-app pool chat. The app sends a question (and a short
// summary of the owner's pool); this function answers with Claude and saves
// the question and answer to chat_sessions / chat_messages (migration 022).
//
// Requests (POST, JSON):
//   { action: "status" }                          → allowance for this month
//   { message, context?, session_id? }            → answer; no session_id starts a new chat
//
// Limits (service role counts them, so owners can't reset their own):
//   - CHAT_SESSIONS_PER_MONTH new chats a month (default 5), reset on the 1st, Melbourne time
//   - CHAT_QUESTIONS_PER_SESSION questions per chat (default 10)
//   - A failed answer is not saved, so it never uses up a chat or a question.
//
// Who: members, and owners whose free trial is still running.
//
// Secrets: ANTHROPIC_API_KEY (shared with ocr-water-test). Optional CHAT_MODEL
// is tried first, then DEFAULT_MODELS (Haiku: quick and cheap for chat).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { isBillingError } from "../_shared/ocr-readings.js"
import {
  SYSTEM_PROMPT,
  cleanContext,
  cleanQuestion,
  limitsFrom,
  monthWindow,
  replyText,
  resetLabel,
  takesFallbacks,
  titleFrom,
} from "../_shared/chat-rules.js"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" }

// A model the key can't use (404 not found, 403 no access) moves on to the next.
const DEFAULT_MODELS = ["claude-haiku-5-5"]
const FALLBACK_BETA = "server-side-fallback-2026-07-01"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function modelCandidates(): string[] {
  const preferred = (Deno.env.get("CHAT_MODEL") ?? "").trim()
  return [...new Set([preferred, ...DEFAULT_MODELS].filter(Boolean))]
}

type Turn = { role: "user" | "assistant"; content: string }

async function callClaude(apiKey: string, model: string, context: string, turns: Turn[]) {
  const system: Record<string, unknown>[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ]
  if (context) {
    system.push({ type: "text", text: `The owner's pool, from the app:\n${context}` })
  }
  const body: Record<string, unknown> = {
    model,
    max_tokens: 4000,
    // Chat answers are short; low effort keeps them quick and cheap.
    output_config: { effort: "low" },
    system,
    messages: turns,
  }
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  }
  if (takesFallbacks(model)) {
    // If a safety check declines the question, the API retries on another model.
    body.fallbacks = "default"
    headers["anthropic-beta"] = FALLBACK_BETA
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) return { ok: false as const, status: res.status, errText: await res.text() }
  const data = await res.json()
  return { ok: true as const, stopReason: String(data?.stop_reason ?? ""), text: replyText(data?.content) }
}

function providerError(status: number, errText: string): Response {
  console.error("pool-chat Anthropic error:", status, errText.slice(0, 300))
  if (isBillingError(status, errText) || status === 401 || status === 403 || status === 404) {
    return jsonResponse({
      error: "Mate is having a break right now. Try again later, or use the Problem fixer.",
      code: "CHAT_UNAVAILABLE",
    }, 503)
  }
  if (status === 429 || status === 529) {
    return jsonResponse({ error: "Mate is busy right now. Give it a minute and ask again.", code: "CHAT_BUSY" }, 503)
  }
  return jsonResponse({ error: "That didn't go through. Please try again.", code: "CHAT_UPSTREAM_ERROR" }, 502)
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405)

  try {
    // ── 1. Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return jsonResponse({ error: "Unauthorised", code: "AUTH_REQUIRED" }, 401)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: "Unauthorised", code: "INVALID_TOKEN" }, 401)

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    // ── 2. Members and live trials only ──────────────────────
    const prof = await admin.from("user_profiles")
      .select("is_premium, trial_ends_at")
      .eq("id", user.id)
      .maybeSingle()
    if (prof.error) {
      console.error("pool-chat profile lookup failed:", prof.error.message)
      return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
    }
    const trialOpen = prof.data?.trial_ends_at && new Date(prof.data.trial_ends_at).getTime() > Date.now()
    if (!prof.data?.is_premium && !trialOpen) {
      return jsonResponse({ error: "Ask Mate comes with membership.", code: "NOT_ENTITLED" }, 403)
    }

    // ── 3. Allowance this month ──────────────────────────────
    const limits = limitsFrom({
      CHAT_SESSIONS_PER_MONTH: Deno.env.get("CHAT_SESSIONS_PER_MONTH"),
      CHAT_QUESTIONS_PER_SESSION: Deno.env.get("CHAT_QUESTIONS_PER_SESSION"),
    })
    const win = monthWindow(new Date())
    const used = await admin.from("chat_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", win.from.toISOString())
      .lt("created_at", win.to.toISOString())
    if (used.error) {
      console.error("pool-chat count failed:", used.error.message)
      return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
    }
    const chatsUsed = used.count ?? 0
    const allowance = {
      chats_used: chatsUsed,
      chats_per_month: limits.chatsPerMonth,
      questions_per_chat: limits.questionsPerChat,
      resets_on: resetLabel(win.to),
    }

    const body = await req.json().catch(() => null)
    if (body?.action === "status") return jsonResponse(allowance)

    // ── 4. Validate ──────────────────────────────────────────
    const question = cleanQuestion(body?.message)
    if (!question) return jsonResponse({ error: "Type a question first.", code: "BAD_REQUEST" }, 400)
    const context = cleanContext(body?.context)
    const sessionId = typeof body?.session_id === "string" && body.session_id ? body.session_id : null

    let history: Turn[] = []
    if (sessionId) {
      const owned = await admin.from("chat_sessions").select("id").eq("id", sessionId).eq("user_id", user.id).maybeSingle()
      if (owned.error || !owned.data) return jsonResponse({ error: "That chat wasn't found.", code: "CHAT_NOT_FOUND" }, 404)
      const msgs = await admin.from("chat_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
      if (msgs.error) {
        console.error("pool-chat history failed:", msgs.error.message)
        return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
      }
      history = (msgs.data ?? []) as Turn[]
      const asked = history.filter((m) => m.role === "user").length
      if (asked >= limits.questionsPerChat) {
        return jsonResponse({
          ...allowance,
          error: `That chat has had its ${limits.questionsPerChat} questions. Start a new chat to keep going.`,
          code: "CHAT_FULL",
        }, 429)
      }
    } else if (chatsUsed >= limits.chatsPerMonth) {
      return jsonResponse({
        ...allowance,
        error: `You've used your ${limits.chatsPerMonth} chats for this month. More on ${allowance.resets_on}.`,
        code: "CHAT_LIMIT",
      }, 429)
    }

    // ── 5. Ask Claude ────────────────────────────────────────
    const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim()
    if (!apiKey.startsWith("sk-ant-")) {
      console.error("pool-chat: ANTHROPIC_API_KEY is missing or malformed")
      return jsonResponse({ error: "Mate is having a break right now. Try again later.", code: "CHAT_UNAVAILABLE" }, 503)
    }
    const turns: Turn[] = [...history, { role: "user", content: question }]
    let answer = ""
    let lastFail: { status: number; errText: string } | null = null
    for (const model of modelCandidates()) {
      const result = await callClaude(apiKey, model, context, turns)
      if (result.ok) {
        lastFail = null
        answer = result.stopReason === "refusal" || !result.text
          ? "Sorry, I can't help with that one. Ask me anything about your pool water, equipment or this app."
          : result.text
        break
      }
      lastFail = { status: result.status, errText: result.errText }
      if (result.status !== 404 && result.status !== 403) break
    }
    if (lastFail) return providerError(lastFail.status, lastFail.errText)

    // ── 6. Save (only after a good answer) ───────────────────
    let sid = sessionId
    if (!sid) {
      const created = await admin.from("chat_sessions")
        .insert({ user_id: user.id, title: titleFrom(question) })
        .select("id")
        .single()
      if (created.error) {
        console.error("pool-chat session insert failed:", created.error.message)
        return jsonResponse({ error: "Internal error", code: "SERVER_ERROR" }, 500)
      }
      sid = created.data.id
    }
    const now = Date.now()
    const saved = await admin.from("chat_messages").insert([
      { session_id: sid, user_id: user.id, role: "user", content: question, created_at: new Date(now).toISOString() },
      { session_id: sid, user_id: user.id, role: "assistant", content: answer.slice(0, 8000), created_at: new Date(now + 1).toISOString() },
    ])
    if (saved.error) console.error("pool-chat message insert failed:", saved.error.message)
    await admin.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sid)

    const asked = history.filter((m) => m.role === "user").length + 1
    return jsonResponse({
      session_id: sid,
      reply: answer,
      questions_left: Math.max(0, limits.questionsPerChat - asked),
      ...allowance,
      chats_used: sessionId ? chatsUsed : chatsUsed + 1,
    })
  } catch (err) {
    console.error("pool-chat error:", err)
    return jsonResponse({ error: "That didn't go through. Please try again.", code: "SERVER_ERROR" }, 500)
  }
})
