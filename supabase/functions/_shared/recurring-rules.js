// Pure rules for the weekly test reminder and the monthly pool report.
// No network, no Deno APIs. Imported by the edge function and by node:test.
//
// Both emails go through the same EMAIL_ALLOWLIST gate as L1-L7
// (isAllowlisted in lifecycle-rules.js), and each is sent once per period.

export const TZ = "Australia/Melbourne"

export const WEEKLY = {
  fromHour: 8,               // Melbourne time. The sweep runs every 15 minutes.
  untilHour: 20,             // a late sweep still sends that day, never at night
  skipIfTestedWithinDays: 3, // someone who just tested does not need a reminder
}

export const MONTHLY = {
  fromHour: 9,
  firstDays: 3,              // sent on the 1st to the 3rd, for the month just ended
}

export const MAX_RECURRING_SENDS_PER_SWEEP = 20
export const PENDING_LOCK_MINUTES = 15

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export const dayName = (n) => WEEKDAYS[n] ?? ""
export const monthName = (n) => MONTHS[n - 1] ?? ""

export function melbourneParts(date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", hourCycle: "h23", weekday: "short",
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  const hour = Number(get("hour"))
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: hour === 24 ? 0 : hour,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  }
}

const pad = (n) => String(n).padStart(2, "0")
export const melbourneDateKey = (date) => {
  const p = melbourneParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

// The UTC instant at which Melbourne's clock reads 00:00 on the given date.
export function melbourneMidnight(year, month, day) {
  let guess = Date.UTC(year, month - 1, day, 0, 0, 0) - 11 * 3600000
  for (let i = 0; i < 3; i++) {
    const p = melbourneParts(new Date(guess))
    const shownMinutes = Date.UTC(p.year, p.month - 1, p.day, p.hour, 0, 0)
    const wantedMinutes = Date.UTC(year, month - 1, day, 0, 0, 0)
    const diff = wantedMinutes - shownMinutes
    if (diff === 0) break
    guess += diff
  }
  return new Date(guess)
}

function ageMs(from, now) {
  if (!from) return null
  const t = new Date(from).getTime()
  return Number.isFinite(t) ? now.getTime() - t : null
}

function rowStatus(row, now) {
  if (!row) return null
  if (row.status === "sent" || row.status === "skipped") return "done"
  if (row.status === "pending") {
    const age = ageMs(row.created_at, now)
    return age !== null && age < PENDING_LOCK_MINUTES * 60 * 1000 ? "done" : null
  }
  return null // failed rows can be tried again
}

// candidate: { reminder_day, last_test_at, test_count }
// existing: the ledger row for (user, 'weekly_reminder', today) or null.
// Returns { action: "none" | "skip" | "send", periodKey, reason? }
export function weeklyDecision(candidate, now, existing) {
  const p = melbourneParts(now)
  const periodKey = melbourneDateKey(now)
  if (candidate.reminder_day === null || candidate.reminder_day === undefined) return { action: "none", periodKey }
  if (Number(candidate.reminder_day) !== p.weekday) return { action: "none", periodKey }
  if (p.hour < WEEKLY.fromHour || p.hour >= WEEKLY.untilHour) return { action: "none", periodKey }
  if (rowStatus(existing, now) === "done") return { action: "none", periodKey }

  const since = ageMs(candidate.last_test_at, now)
  if (since !== null && since < WEEKLY.skipIfTestedWithinDays * DAY_MS) {
    return { action: "skip", periodKey, reason: "recent_test" }
  }
  return { action: "send", periodKey }
}

// The month a report is due for, or null when it is not report time.
// Sent from 9am Melbourne on the 1st to the 3rd, for the month before.
export function monthlyPeriod(now) {
  const p = melbourneParts(now)
  if (p.day > MONTHLY.firstDays) return null
  if (p.day === 1 && p.hour < MONTHLY.fromHour) return null
  const prevYear = p.month === 1 ? p.year - 1 : p.year
  const prevMonth = p.month === 1 ? 12 : p.month - 1
  const from = melbourneMidnight(prevYear, prevMonth, 1)
  const to = melbourneMidnight(p.year, p.month, 1)
  return {
    key: `${prevYear}-${pad(prevMonth)}`,
    from: from.toISOString(),
    to: to.toISOString(),
    monthName: monthName(prevMonth),
    year: prevYear,
  }
}

export function monthlyDecision(now, existing) {
  const period = monthlyPeriod(now)
  if (!period) return { action: "none", periodKey: null, period: null }
  if (rowStatus(existing, now) === "done") return { action: "none", periodKey: period.key, period }
  return { action: "send", periodKey: period.key, period }
}

// ── One-click unsubscribe ────────────────────────────────────
// The link in each email carries userId.kind.signature. The signature is an
// HMAC-SHA256 of "userId.kind" with the sweep secret, so a link cannot be
// forged or reused for another member.

export const KINDS = ["weekly_reminder", "monthly_report"]

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)))
}

export async function signUnsubscribe(secret, userId, kind) {
  if (!secret) throw new Error("secret required")
  return `${userId}.${kind}.${await hmac(secret, `${userId}.${kind}`)}`
}

export async function verifyUnsubscribe(secret, token) {
  if (!secret || typeof token !== "string") return null
  const [userId, kind, sig, extra] = token.split(".")
  if (extra !== undefined || !userId || !sig || !KINDS.includes(kind)) return null
  const want = await hmac(secret, `${userId}.${kind}`)
  if (want.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0 ? { userId, kind } : null
}

export function unsubscribeUrl(baseUrl, token) {
  return `${baseUrl}?u=${encodeURIComponent(token)}`
}
