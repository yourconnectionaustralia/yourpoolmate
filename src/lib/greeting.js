// File: src/lib/greeting.js
// Home-header greeting for the Health Score page.
//
// Time of day is Australia/Melbourne civil time, taken from the device clock
// via Intl (not a fixed UTC offset, so daylight saving is handled).
// The first name is the first word of a display / profile name when one
// exists. There is no "there", and the email address is never used.

export const MELBOURNE_TZ = 'Australia/Melbourne';

// user_profiles has no name column. These are the auth metadata fields only.
const DISPLAY_NAME_KEYS = ['display_name', 'first_name', 'full_name'];

export function melbourneHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TZ,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const raw = parts.find((p) => p.type === 'hour')?.value;
  let hour = Number(raw);
  if (!Number.isFinite(hour)) return 0;
  // Some engines report midnight as 24 under hourCycle h23.
  if (hour === 24) hour = 0;
  return hour;
}

export function greetingPhrase(date = new Date()) {
  const hour = melbourneHour(date);
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// First word of a display name. Rejects blanks and anything that looks like
// an email so we never greet someone with their address local-part.
export function firstNameFromDisplayName(displayName) {
  if (typeof displayName !== 'string') return '';
  const first = displayName.trim().split(/\s+/)[0] || '';
  if (!first || first.includes('@')) return '';
  if (!/\p{L}/u.test(first)) return '';
  return first;
}

function nameFromRecord(meta) {
  if (!meta || typeof meta !== 'object') return '';
  for (const key of DISPLAY_NAME_KEYS) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim() && !value.includes('@')) {
      return value.trim();
    }
  }
  return '';
}

// First available display name on user_metadata. Email and pool name are ignored.
export function displayNameFromUser(user) {
  return nameFromRecord(user?.user_metadata);
}

export function homeGreeting(date = new Date(), displayName = '') {
  const phrase = greetingPhrase(date);
  const first = firstNameFromDisplayName(displayName);
  return first ? `${phrase}, ${first}` : phrase;
}
