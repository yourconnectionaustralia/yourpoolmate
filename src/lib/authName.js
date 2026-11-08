// Names that arrive with a new account, from either place they can come from:
//   - the sign-up form, which sends first_name / last_name as user metadata
//   - Google sign-in, which supplies given_name / family_name, or just full_name / name
// Returns what to store on user_profiles, or null when there is no usable name.

import { MEMBER_LIMITS } from './memberProfile.js'

function clean(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function nameFromAuthUser(user) {
  const meta = user?.user_metadata ?? {}
  let first = clean(meta.first_name ?? meta.given_name, MEMBER_LIMITS.firstName)
  let last = clean(meta.last_name ?? meta.family_name, MEMBER_LIMITS.lastName)

  if (!first) {
    // Only a single full name to go on: first word is the first name, the rest the last.
    const full = clean(meta.full_name ?? meta.name, MEMBER_LIMITS.firstName + MEMBER_LIMITS.lastName + 1)
    if (full) {
      const space = full.indexOf(' ')
      first = clean(space === -1 ? full : full.slice(0, space), MEMBER_LIMITS.firstName)
      if (!last && space !== -1) last = clean(full.slice(space + 1), MEMBER_LIMITS.lastName)
    }
  }

  if (!first && !last) return null
  return { firstName: first || null, lastName: last || null }
}

// Fill the profile's blank name from sign-up details, but only for a new account.
// An older account that has cleared its name keeps it cleared.
export const NAME_SYNC_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export function shouldSyncName({ user, profile, now = Date.now() }) {
  if (!user || profile?.first_name || profile?.last_name) return null
  const created = Date.parse(user.created_at)
  if (!Number.isFinite(created) || now - created > NAME_SYNC_WINDOW_MS) return null
  return nameFromAuthUser(user)
}
