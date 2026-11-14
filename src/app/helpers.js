import { calculateScore } from '../lib/healthScore.js';
import { displayNameFromUser, homeGreeting } from '../lib/greeting.js';

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOGIC HELPERS
// ─────────────────────────────────────────────────────────────────
// Health Score lives in src/lib/healthScore.js (mirrors the
// calculate-health-score edge function). A stored score is preferred so
// history stays as recorded. Surface is used only when a score is calculated
// fresh: a new test, or a row with no stored score. No history rewrite.
// saltRange (from the owner's chlorinator) overrides the default salt band.
// A cover makes stabiliser optional, so hasCover is passed through too.
export const scoreFor = (test, sanitiser, saltRange, surface, hasCover = false) =>
  test?.healthScore ?? calculateScore(test, sanitiser, saltRange, surface, { hasCover });

// Reading display — untested values render as a dash, never "null ppm".
export function fmtReading(v, unit) {
  if (v === null || v === undefined || v === '') return '—';
  return unit ? `${v} ${unit}` : `${v}`;
}

// The dose plan (order, amounts, notes, safety, swim call) is in
// src/lib/plan.js; dose factors are in src/lib/dosing.js, which the
// marketing chlorine calculator imports too.

export function hasVolume(pool) {
  return !!(pool && pool.volumeL && pool.volumeL > 0);
}

export function formatRelative(iso) {
  if (!iso) return 'unknown';
  const diff = (Date.now() - new Date(iso)) / 60000;
  if (diff < 2) return 'just now';
  if (diff < 60) return `${Math.round(diff)} min ago`;
  if (diff < 1440) return `${Math.round(diff / 60)} hr ago`;
  return `${Math.round(diff / 1440)} day${Math.round(diff / 1440) > 1 ? 's' : ''} ago`;
}

// Health Score header. Australia/Melbourne civil time from the device clock.
// First word of display_name, first_name, or full_name. No name: the phrase alone.
export function melbourneGreeting(user, date = new Date()) {
  return homeGreeting(date, displayNameFromUser(user));
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
