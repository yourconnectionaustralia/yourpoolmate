// Pure rules for Ask Mate, the in-app pool chat. No network, no Deno APIs.
// Imported by the pool-chat edge function and by node:test.

import { melbourneMidnight, melbourneParts } from "./recurring-rules.js"

export const ASSISTANT_NAME = "Mate"

// A "chat" is one conversation. Each owner gets a few a month, each with a
// handful of questions. Override with the CHAT_SESSIONS_PER_MONTH and
// CHAT_QUESTIONS_PER_SESSION secrets.
export const DEFAULT_LIMITS = { chatsPerMonth: 5, questionsPerChat: 10 }

export const MAX_QUESTION_CHARS = 1000
export const MAX_CONTEXT_CHARS = 3000

export function limitsFrom(env = {}) {
  const pick = (raw, fallback, max) => {
    const n = Number.parseInt(String(raw ?? ""), 10)
    return Number.isInteger(n) && n > 0 && n <= max ? n : fallback
  }
  return {
    chatsPerMonth: pick(env.CHAT_SESSIONS_PER_MONTH, DEFAULT_LIMITS.chatsPerMonth, 100),
    questionsPerChat: pick(env.CHAT_QUESTIONS_PER_SESSION, DEFAULT_LIMITS.questionsPerChat, 50),
  }
}

// The allowance resets at midnight on the 1st, Melbourne time.
export function monthWindow(now) {
  const p = melbourneParts(now)
  const from = melbourneMidnight(p.year, p.month, 1)
  const nextYear = p.month === 12 ? p.year + 1 : p.year
  const nextMonth = p.month === 12 ? 1 : p.month + 1
  const to = melbourneMidnight(nextYear, nextMonth, 1)
  return { from, to }
}

// "1 November", for "resets on ...".
export function resetLabel(to) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric", month: "long", timeZone: "Australia/Melbourne",
  }).format(new Date(to.getTime() + 60 * 1000))
}

export function cleanQuestion(raw) {
  if (typeof raw !== "string") return null
  const text = raw.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").trim()
  if (!text) return null
  return text.slice(0, MAX_QUESTION_CHARS)
}

// The app sends a short summary of the owner's pool so answers fit their
// litres and readings. It only ever shapes their own answer, so it is
// trimmed rather than trusted or checked.
export function cleanContext(raw) {
  if (typeof raw !== "string") return ""
  return raw.replace(/\r\n?/g, "\n").trim().slice(0, MAX_CONTEXT_CHARS)
}

export function titleFrom(question) {
  const one = question.replace(/\s+/g, " ").trim()
  return one.length > 60 ? `${one.slice(0, 57).trimEnd()}...` : one
}

// Text of a Messages API response: text blocks only (thinking and fallback
// blocks are skipped).
export function replyText(content) {
  if (!Array.isArray(content)) return ""
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim()
}

// Models that take the server-side refusal fallback.
export function takesFallbacks(model) {
  return /^claude-(opus-5|fable-5|sonnet-5-5)/.test(String(model))
}

export const SYSTEM_PROMPT = `You are ${ASSISTANT_NAME}, the helper inside Your Pool Mate, an app that helps Australian home pool owners look after their water. You answer questions from pool owners, most of them aged 55 to 70. Many are not confident with pool chemistry and some feel the pool shop talks down to them.

How to answer:
- Sound like a knowledgeable mate who owns a pool: warm, direct, specific. Plain English. Explain a term the first time you use it.
- Keep it short: usually under 120 words. Lead with the answer, then the why in a sentence or two. Use a short numbered list only for steps.
- Plain text only. No headings, tables, bold or other markdown.
- Australian spelling and units: litres, grams, millilitres, ppm, degrees Celsius. Dates as day then month.

Using their pool details:
- The owner's pool details, latest readings and the app's current plan may follow these instructions. Use them when they help, and say which reading you are going on.
- The app works out dose amounts for their litres on the Plan tab. If the plan already has a step for the thing they ask about, quote that amount rather than working out your own. If it does not, explain how to work it out or point them to the Plan tab, and never give an amount without knowing their pool volume.
- If a reading needed for a good answer is missing, say so and suggest a test.

Safety, always:
- Never mix pool chemicals together, and never in the same bucket. Add chemicals to water, never water to chemicals. Add acid and chlorine separately, hours apart, with the pump running.
- Follow the product label. Wear gloves and eye protection for acid and chlorine.
- If someone has swallowed a chemical, has it in their eyes or is struggling to breathe, tell them to call the Poisons Information Centre on 13 11 26, or 000 in an emergency, before anything else.
- If you are not sure the water is safe to swim in, say to stay out until it is retested.
- Don't promise that keeping records guarantees a warranty claim. Records help; the warranty terms decide.

Stay on topic:
- Pool and spa water, equipment, cleaning, seasonal care and using this app. For anything else, say kindly that you can only help with the pool.
- Don't recommend a particular shop or brand. Name the chemical by its common name, with the technical name in brackets the first time.
- If you don't know, or the question needs someone to look at the pool or equipment, say so and suggest a pool technician.`
