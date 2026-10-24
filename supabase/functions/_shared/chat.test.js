import assert from "node:assert/strict"
import test from "node:test"
import {
  DEFAULT_LIMITS, MAX_CONTEXT_CHARS, MAX_QUESTION_CHARS, SYSTEM_PROMPT,
  cleanContext, cleanQuestion, limitsFrom, monthWindow, replyText, resetLabel, takesFallbacks, titleFrom,
} from "./chat-rules.js"

test("limits default to 5 chats a month and 10 questions a chat, and take sane overrides", () => {
  assert.deepEqual(limitsFrom({}), DEFAULT_LIMITS)
  assert.deepEqual(limitsFrom({ CHAT_SESSIONS_PER_MONTH: "8", CHAT_QUESTIONS_PER_SESSION: "6" }), { chatsPerMonth: 8, questionsPerChat: 6 })
  assert.deepEqual(limitsFrom({ CHAT_SESSIONS_PER_MONTH: "0", CHAT_QUESTIONS_PER_SESSION: "lots" }), DEFAULT_LIMITS)
})

test("the month runs from midnight on the 1st, Melbourne time", () => {
  // 31 Oct 2026, 11pm in Melbourne (AEDT, UTC+11) is still October.
  const late = monthWindow(new Date("2026-10-31T12:00:00Z"))
  assert.equal(late.from.toISOString(), "2026-09-30T14:00:00.000Z") // 1 Oct 00:00 AEST
  assert.equal(late.to.toISOString(), "2026-10-31T13:00:00.000Z")   // 1 Nov 00:00 AEDT
  assert.equal(resetLabel(late.to), "1 November")
  // 1 Nov, 00:30 Melbourne is November.
  const early = monthWindow(new Date("2026-10-31T13:30:00Z"))
  assert.equal(early.from.toISOString(), "2026-10-31T13:00:00.000Z")
  const dec = monthWindow(new Date("2026-12-15T00:00:00Z"))
  assert.equal(resetLabel(dec.to), "1 January")
})

test("questions are trimmed and capped; blanks are refused", () => {
  assert.equal(cleanQuestion("   "), null)
  assert.equal(cleanQuestion(42), null)
  assert.equal(cleanQuestion("  why   is it\r\ngreen? "), "why is it\ngreen?")
  assert.equal(cleanQuestion("x".repeat(5000)).length, MAX_QUESTION_CHARS)
  assert.equal(cleanContext("y".repeat(9000)).length, MAX_CONTEXT_CHARS)
  assert.equal(cleanContext(null), "")
})

test("titles are one short line", () => {
  assert.equal(titleFrom("Why is my\npool green?"), "Why is my pool green?")
  assert.ok(titleFrom("a ".repeat(100)).endsWith("..."))
  assert.ok(titleFrom("a ".repeat(100)).length <= 60)
})

test("the reply is the text blocks only", () => {
  assert.equal(replyText([{ type: "thinking", thinking: "" }, { type: "text", text: "Add " }, { type: "text", text: "acid." }]), "Add acid.")
  assert.equal(replyText(null), "")
})

test("fallbacks only go to models that take them", () => {
  assert.equal(takesFallbacks("claude-opus-5-5"), true)
  assert.equal(takesFallbacks("claude-sonnet-5-5"), true)
  assert.equal(takesFallbacks("claude-haiku-5-5"), false)
  assert.equal(takesFallbacks("claude-haiku-4-5"), false)
})

test("the instructions carry the safety basics", () => {
  assert.match(SYSTEM_PROMPT, /13 11 26/)
  assert.match(SYSTEM_PROMPT, /Never mix pool chemicals/)
  assert.match(SYSTEM_PROMPT, /Plan tab/)
})
