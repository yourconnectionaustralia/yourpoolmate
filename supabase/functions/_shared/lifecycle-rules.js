// Pure eligibility + allowlist rules for L1–L7 lifecycle mail.
// No network, no Deno APIs. Imported by the edge function and by node:test.
//
// S1–S3 seasonal emails are manual. They are not template keys here.

export const TEMPLATE_KEYS = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"]

export const DEFAULT_ALLOWLIST_EMAIL = "yourconnectionaustralia@gmail.com"

export const FROM_ADDRESS = "Your Pool Mate <hello@mail.yourpoolmate.com.au>"
export const REPLY_TO = "hello@yourpoolmate.com.au"

// Lookbacks are wide enough that a missed sweep still sends, and narrow
// enough that turning the feature on does not mail the existing beta base.
export const WINDOWS = {
  l1MaxDays: 7,
  l2MinDays: 2,
  l2MaxDays: 7,
  l3MinMinutes: 15,
  l3MaxDays: 7,
  l4MinDays: 13,
  l4MaxDays: 17,
  l5MinDays: 26,
  l5MaxDays: 30,
  l6MinMinutes: 10,
  l6MaxDays: 7,
  l7TestMinDays: 1,
  l7TestMaxDays: 21,
  l7PaidMinDays: 2,
  l7PaidMaxDays: 21,
  l6GapDays: 2,
  standardTrialMinDays: 28,
  standardTrialMaxDays: 40,
  pendingLockMinutes: 15,
}

export const MAX_SENDS_PER_SWEEP = 20

const DAY_MS = 24 * 60 * 60 * 1000
const PRIORITY = ["L1", "L3", "L6", "L2", "L5", "L4", "L7"]

export function ageMs(from, now) {
  if (!from) return null
  const t = new Date(from).getTime()
  if (!Number.isFinite(t)) return null
  return now.getTime() - t
}

function within(from, now, minMs, maxMs) {
  const age = ageMs(from, now)
  if (age === null) return false
  return age >= minMs && age < maxMs
}

export function isStandardTrial(candidate) {
  if (!candidate?.trial_ends_at || !candidate?.created_at) return false
  const start = new Date(candidate.created_at).getTime()
  const end = new Date(candidate.trial_ends_at).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  const days = (end - start) / DAY_MS
  return days >= WINDOWS.standardTrialMinDays && days <= WINDOWS.standardTrialMaxDays
}

function trialStillOpen(candidate, now) {
  if (candidate.is_premium) return false
  if (!candidate.trial_ends_at) return true
  const end = new Date(candidate.trial_ends_at).getTime()
  return Number.isFinite(end) && end > now.getTime()
}

function rowFor(sends, key) {
  return (sends ?? []).find((row) => row.template_key === key) ?? null
}

// sent and skipped are terminal for the sweep. skipped is NOT retried when
// the allowlist later opens, so historical rows cannot become a blast.
// failed and stale pending can be claimed again.
export function isBlocking(sends, key, now) {
  const row = rowFor(sends, key)
  if (!row) return false
  if (row.status === "sent" || row.status === "skipped") return true
  if (row.status === "pending") {
    const age = ageMs(row.created_at, now)
    return age !== null && age < WINDOWS.pendingLockMinutes * 60 * 1000
  }
  return false
}

function l6GapOk(sends, now) {
  const l6 = rowFor(sends, "L6")
  if (!l6) return true
  return within(l6.created_at, now, WINDOWS.l6GapDays * DAY_MS, Number.POSITIVE_INFINITY)
}

function isEligible(key, candidate, sends, now) {
  const age = ageMs(candidate.created_at, now)
  switch (key) {
    case "L1":
      return age !== null && age >= 0 && age < WINDOWS.l1MaxDays * DAY_MS
    case "L2": {
      // Don't stack the nudge on the same day the welcome went out.
      // Welcome catch-up (L1 still inside its 7-day window) is sent first.
      const l1 = rowFor(sends, "L1")
      const l1Age = l1 ? ageMs(l1.created_at, now) : null
      const l1Settled = Boolean(l1)
        && l1.status !== "pending"
        && l1Age !== null
        && l1Age >= DAY_MS
      return age !== null
        && age >= WINDOWS.l2MinDays * DAY_MS
        && age < WINDOWS.l2MaxDays * DAY_MS
        && Number(candidate.test_count) === 0
        && trialStillOpen(candidate, now)
        && l1Settled
    }
    case "L3":
      return Number(candidate.test_count) >= 1
        && within(
          candidate.first_test_at,
          now,
          WINDOWS.l3MinMinutes * 60 * 1000,
          WINDOWS.l3MaxDays * DAY_MS,
        )
    case "L4":
      return isStandardTrial(candidate)
        && trialStillOpen(candidate, now)
        && age !== null
        && age >= WINDOWS.l4MinDays * DAY_MS
        && age < WINDOWS.l4MaxDays * DAY_MS
    case "L5":
      return isStandardTrial(candidate)
        && trialStillOpen(candidate, now)
        && age !== null
        && age >= WINDOWS.l5MinDays * DAY_MS
        && age < WINDOWS.l5MaxDays * DAY_MS
    case "L6":
      return candidate.is_premium === true
        && within(
          candidate.premium_since,
          now,
          WINDOWS.l6MinMinutes * 60 * 1000,
          WINDOWS.l6MaxDays * DAY_MS,
        )
    case "L7": {
      if (!l6GapOk(sends, now)) return false
      const testPath = Number(candidate.test_count) >= 3
        && within(
          candidate.third_test_at,
          now,
          WINDOWS.l7TestMinDays * DAY_MS,
          WINDOWS.l7TestMaxDays * DAY_MS,
        )
      const paidPath = candidate.is_premium === true
        && within(
          candidate.premium_since,
          now,
          WINDOWS.l7PaidMinDays * DAY_MS,
          WINDOWS.l7PaidMaxDays * DAY_MS,
        )
      return testPath || paidPath
    }
    default:
      return false
  }
}

export function eligibleTemplates(candidate, sends, now) {
  const out = []
  for (const key of PRIORITY) {
    if (isBlocking(sends, key, now)) continue
    if (isEligible(key, candidate, sends, now)) out.push(key)
  }
  return out
}

export function nextTemplate(candidate, sends, now) {
  return eligibleTemplates(candidate, sends, now)[0] ?? null
}

// Blank secret → only the default inbox.
// Comma-separated addresses are added on top of that inbox.
// The whole value "*" or "ALL" is the live-send gate. A mixed list never opens it.
export function parseAllowlist(raw) {
  const text = String(raw ?? "").trim()
  if (text === "*" || text.toUpperCase() === "ALL") {
    return { allowAll: true, emails: new Set() }
  }
  const emails = new Set([DEFAULT_ALLOWLIST_EMAIL])
  for (const part of text.split(",")) {
    const email = part.trim().toLowerCase()
    if (email.includes("@")) emails.add(email)
  }
  return { allowAll: false, emails }
}

export function isAllowlisted(email, raw) {
  const parsed = parseAllowlist(raw)
  if (parsed.allowAll) return true
  return parsed.emails.has(String(email ?? "").trim().toLowerCase())
}

// Resend is called only when this is true. No key, or an address outside the
// allowlist, must not produce an API call.
export function mayCallResend(email, allowlistRaw, hasKey) {
  return Boolean(hasKey) && isAllowlisted(email, allowlistRaw)
}

export function idempotencyKey(userId, template) {
  return `lifecycle-${userId}-${template}`
}

export function isTemplateKey(value) {
  return TEMPLATE_KEYS.includes(value)
}
