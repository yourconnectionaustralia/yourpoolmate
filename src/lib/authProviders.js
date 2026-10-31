// File: src/lib/authProviders.js
//
// Pure helpers for one-tap social sign-in (Google / Apple) and for reading
// auth errors Supabase puts in the URL when a redirect comes back broken.
// No React, no Supabase, no window access — everything is passed in so it can
// be unit-tested with `node --test`.

// Display order on screen. Add a provider here (and in the Supabase dashboard)
// to offer it; nothing is shown until it is also listed in VITE_AUTH_PROVIDERS.
export const PROVIDER_ORDER = ['google', 'apple']

export const PROVIDER_LABELS = {
  google: 'Google',
  apple: 'Apple',
}

/**
 * "google, Apple ,facebook" -> ['google', 'apple'].
 * Unknown names and blanks are dropped; order follows PROVIDER_ORDER, not the
 * env var, so the screen always looks the same. Unset/empty -> [] (email only).
 */
export function parseEnabledProviders(raw) {
  if (typeof raw !== 'string') return []
  const wanted = new Set(
    raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  )
  return PROVIDER_ORDER.filter(id => wanted.has(id))
}

function readParams(str) {
  return new URLSearchParams(String(str || '').replace(/^[#?]/, ''))
}

/**
 * Supabase reports a failed redirect (user cancelled at Google, expired
 * email link, provider misconfigured) as error params in the URL hash or
 * query string:
 *   #error=access_denied&error_code=otp_expired&error_description=...
 * Returns { error, code, description } or null when the URL is clean.
 */
export function parseAuthRedirectError(hash = '', search = '') {
  for (const params of [readParams(hash), readParams(search)]) {
    const error = params.get('error')
    const code = params.get('error_code')
    if (error || code) {
      return {
        error: error || '',
        code: code || '',
        description: params.get('error_description') || '',
      }
    }
  }
  return null
}

/** Turns a parsed redirect error into one plain-English sentence ('' if none). */
export function friendlyRedirectError(parsed) {
  if (!parsed) return ''
  const code = (parsed.code || '').toLowerCase()
  const description = (parsed.description || '').toLowerCase()

  // Check expiry first: expired email links also arrive as "access_denied".
  if (code === 'otp_expired' || /expired|already.*used/.test(description)) {
    return 'That link has expired or has already been used. Try signing in, or start again and we\'ll send a fresh link.'
  }
  if (parsed.error === 'access_denied') {
    return 'Sign-in was cancelled — no worries. Pick an option to try again.'
  }
  return 'We couldn\'t finish signing you in — please try again.'
}

/**
 * Error from starting the provider redirect (before the browser leaves the
 * page). The common one is tapping a button whose provider isn't switched on
 * in the Supabase dashboard yet.
 */
export function providerErrorMessage(error, provider) {
  const raw = error?.message || ''
  const name = PROVIDER_LABELS[provider] || 'that'

  if (/not enabled|unsupported provider|provider.*disabled/i.test(raw)) {
    return `${name} sign-in isn't available just yet — please use your email below.`
  }
  if (/rate limit|too many|for security purposes/i.test(raw)) {
    return 'Too many attempts just now — wait a minute and try again.'
  }
  return `Couldn't start ${name} sign-in — please try again, or use your email below.`
}
