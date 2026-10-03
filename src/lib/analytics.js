// File: src/lib/analytics.js
//
// Page views for the PWA. There is no URL router. App.jsx picks the
// screen: loading, the auth gate, the trial-ended paywall, or one
// activeView inside the signed-in shell (health, tests, history,
// setup, equipment, schedule, profile). The address bar stays on "/".
//
// index.html loads gtag.js once and turns off the automatic page_view.
// This module sends one page_view per screen, with a virtual path, and
// leaves the query string and hash off the hit so a Stripe return
// (?session_id=) or a recovery link (#access_token=) is never sent.

const SCREENS = {
  health: { path: '/health', title: 'Health Score' },
  tests: { path: '/tests', title: 'Water Tests' },
  history: { path: '/history', title: 'Chemistry log' },
  setup: { path: '/setup', title: 'Setup' },
  equipment: { path: '/equipment', title: 'Equipment' },
  schedule: { path: '/schedule', title: 'Seasonal Tips' },
  profile: { path: '/profile', title: 'Profile' },
  'sign-in': { path: '/sign-in', title: 'Sign in' },
  'reset-password': { path: '/reset-password', title: 'Reset password' },
  'trial-ended': { path: '/trial-ended', title: 'Trial ended' },
};

const shared = { last: null };

/**
 * The screen App.jsx is actually rendering. Null while a spinner is up,
 * so a loading flash is not a page view. Mirrors the early returns in App.
 */
export function analyticsScreen({
  loading,
  recoveryMode,
  signedIn,
  trialExpired,
  isPremium,
  dataReady,
  activeView,
}) {
  if (loading) return null;
  if (recoveryMode) return 'reset-password';
  if (!signedIn) return 'sign-in';
  if (trialExpired && !isPremium) return 'trial-ended';
  if (!dataReady) return null;
  return activeView;
}

export function pageViewParams(screen, origin) {
  const known = SCREENS[screen];
  if (!known || !origin) return null;
  return {
    page_title: known.title,
    page_location: `${origin}${known.path}`,
    page_path: known.path,
  };
}

function defaultGtag() {
  if (typeof window === 'undefined') return undefined;
  return window.gtag;
}

function defaultOrigin() {
  if (typeof window === 'undefined' || !window.location) return '';
  return window.location.origin;
}

/**
 * Queue one page_view for this screen. Repeating the same screen (React
 * StrictMode's double effect, or a re-render) does not send again.
 * Returns true when a hit was queued.
 */
export function trackPageView(screen, options = {}) {
  const state = options.state || shared;
  if (!screen || screen === state.last) return false;
  const params = pageViewParams(screen, options.origin ?? defaultOrigin());
  if (!params) return false;
  const gtag = options.gtag || defaultGtag();
  if (typeof gtag !== 'function') return false;
  state.last = screen;
  gtag('event', 'page_view', params);
  return true;
}
