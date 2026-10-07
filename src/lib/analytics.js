// File: src/lib/analytics.js
//
// Analytics for the PWA. There is no URL router. App.jsx picks the
// screen: loading, the auth gate, the trial-ended paywall, or one
// activeView inside the signed-in shell (health, tests, history,
// setup, equipment, schedule, profile). The address bar stays on "/".
//
// index.html loads gtag.js once and turns off the automatic page_view.
// This module sends one page_view per screen, with a virtual path.
// The first page_view keeps campaign params (utm_* and gclid) on
// page_location so attribution survives the virtual path. Every later
// page_view, and every custom event, uses the clean virtual path:
// no query string and no hash. That keeps Stripe ?session_id= and a
// recovery #access_token= out of Analytics.
//
// Custom events are a no-op when window.gtag is missing (a blocker,
// or a test that did not pass a fake gtag).

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

// Campaign params kept on the first page_view only. Anything else in
// the query (checkout, session_id, email, tokens) is dropped.
const ATTRIBUTION_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
];

const PLANS = new Set(['founding_lifetime', 'annual']);
const ENTRIES = new Set(['manual', 'voice', 'ocr']);

// Written onto the auth user's user_metadata. One flag per account,
// so a second sign-in (or a second device) does not send trial_start
// again. Not a database column — no migration.
export const TRIAL_START_META_KEY = 'ypm_trial_start';

// Pre-existing beta accounts must not emit trial_start the first time
// they open the app after this ships. Email confirmation is normally
// the same day; seven days still covers a delayed first open.
export const TRIAL_START_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const CHECKOUT_OFFER_KEY = 'ypm_checkout_offer';
export const CHECKOUT_COMPLETED_KEY = 'ypm_ga_checkout_completed';

const shared = { last: null, attributionSent: false };
const trialStartAttempted = new Set();
const trialStartInflight = new Map();
const checkoutCompletedMemory = new Set();

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

export function attributionQuery(search) {
  if (typeof search !== 'string' || !search) return '';
  const withoutHash = search.split('#')[0];
  const q = withoutHash.startsWith('?') ? withoutHash.slice(1) : withoutHash;
  let params;
  try {
    params = new URLSearchParams(q);
  } catch {
    return '';
  }
  const kept = new URLSearchParams();
  for (const key of ATTRIBUTION_PARAMS) {
    const value = params.get(key);
    if (typeof value === 'string' && value.length > 0) kept.append(key, value);
  }
  const qs = kept.toString();
  return qs ? `?${qs}` : '';
}

export function pageViewParams(screen, origin, search = '') {
  const known = SCREENS[screen];
  if (!known || !origin) return null;
  const query = attributionQuery(search);
  return {
    page_title: known.title,
    page_location: `${origin}${known.path}${query}`,
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

function defaultSearch() {
  if (typeof window === 'undefined' || !window.location) return '';
  return window.location.search || '';
}

function defaultSessionStorage() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Queue one page_view for this screen. Repeating the same screen (React
 * StrictMode's double effect, or a re-render) does not send again.
 * The first hit in this page load may carry utm_* and gclid. Later hits
 * use the clean virtual path. Returns true when a hit was queued.
 */
export function trackPageView(screen, options = {}) {
  const state = options.state || shared;
  if (!screen || screen === state.last) return false;
  const includeAttribution = !state.attributionSent;
  const search = includeAttribution ? (options.search ?? defaultSearch()) : '';
  const params = pageViewParams(screen, options.origin ?? defaultOrigin(), search);
  if (!params) return false;
  const gtag = options.gtag || defaultGtag();
  if (typeof gtag !== 'function') return false;
  state.last = screen;
  state.attributionSent = true;
  gtag('event', 'page_view', params);
  return true;
}

function cleanLocation(screen, origin) {
  const known = pageViewParams(screen, origin, '');
  if (known) {
    return { page_location: known.page_location, page_path: known.page_path };
  }
  if (origin) return { page_location: origin, page_path: '/' };
  return null;
}

/**
 * Params safe to send. Unknown keys are dropped, including anything that
 * could identify a person (email, name, user id, Stripe ids). Internal
 * checkout traffic never carries value or currency.
 */
export function publicEventParams(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  if (ENTRIES.has(raw.entry)) out.entry = raw.entry;
  if (PLANS.has(raw.plan)) out.plan = raw.plan;
  if (raw.traffic_type === 'internal') {
    out.traffic_type = 'internal';
    return out;
  }
  if (typeof raw.value === 'number' && Number.isFinite(raw.value)) out.value = raw.value;
  if (raw.currency === 'AUD' && out.value !== undefined) out.currency = 'AUD';
  return out;
}

/**
 * Queue a custom event. Always attaches the clean virtual page_location
 * for the current screen so gtag does not attach the document URL
 * (which may still hold session_id or a hash token). No-op without gtag.
 */
export function trackEvent(name, params = {}, options = {}) {
  if (!name || typeof name !== 'string') return false;
  const gtag = options.gtag || defaultGtag();
  if (typeof gtag !== 'function') return false;
  const state = options.state || shared;
  const payload = publicEventParams(params);
  const location = cleanLocation(options.screen ?? state.last, options.origin ?? defaultOrigin());
  if (location) Object.assign(payload, location);
  gtag('event', name, payload);
  return true;
}

export function testEntry(source) {
  if (source === 'voice' || source === 'ocr') return source;
  return 'manual';
}

/**
 * Counts successful water-test saves for this page load.
 * noteServerCount marks history that already existed, so a returning
 * member does not emit first_test_saved. begin/finish wraps one
 * db.saveTest call: finish runs only after the write resolves, and a
 * second in-flight save cannot also be "first". An in-flight save
 * keeps noteServerCount from treating that same row as prior history.
 */
export function createTestSaveTracker() {
  let emittedFirst = false;
  let pending = 0;
  return {
    noteServerCount(count) {
      if (pending === 0 && count > 0) emittedFirst = true;
    },
    begin() {
      pending += 1;
      let settled = false;
      return {
        finish() {
          if (settled) return null;
          settled = true;
          pending = Math.max(0, pending - 1);
          const isFirst = !emittedFirst;
          emittedFirst = true;
          return isFirst ? 'first_test_saved' : 'test_saved';
        },
        cancel() {
          if (settled) return;
          settled = true;
          pending = Math.max(0, pending - 1);
        },
      };
    },
    savedNow() {
      const isFirst = !emittedFirst;
      emittedFirst = true;
      return isFirst ? 'first_test_saved' : 'test_saved';
    },
  };
}

export function shouldTrackTrialStart(user, options = {}) {
  if (options.isPremium) return false;
  if (!user || typeof user !== 'object' || !user.id) return false;
  const meta = user.user_metadata;
  if (meta && meta[TRIAL_START_META_KEY] === true) return false;
  if (!user.email_confirmed_at && !user.confirmed_at) return false;
  const created = Date.parse(user.created_at);
  if (!Number.isFinite(created)) return false;
  const now = options.now ?? Date.now();
  const age = now - created;
  // A few minutes of clock skew still counts as a new account.
  if (age < -5 * 60 * 1000) return false;
  if (age > TRIAL_START_MAX_AGE_MS) return false;
  return true;
}

/**
 * trial_start, once per account. The marker is written on the auth user
 * before the event is sent. A failed write leaves the flag unset so a
 * later visit can try again. gtag missing does not consume the one shot.
 * No event params beyond the clean page location.
 */
export async function trackTrialStartOnce(user, options = {}) {
  if (!shouldTrackTrialStart(user, options)) return false;
  const attempted = options.attempted || trialStartAttempted;
  if (attempted.has(user.id)) return false;
  const inflight = options.inflight || trialStartInflight;
  if (inflight.has(user.id)) return inflight.get(user.id);
  const gtag = options.gtag || defaultGtag();
  if (typeof gtag !== 'function') return false;
  const updateUser = options.updateUser;
  if (typeof updateUser !== 'function') return false;

  let finish = () => {};
  const run = new Promise((resolve) => { finish = resolve; });
  inflight.set(user.id, run);
  (async () => {
    try {
      const { error } = await updateUser({ data: { [TRIAL_START_META_KEY]: true } });
      if (error) {
        finish(false);
        return;
      }
      attempted.add(user.id);
      finish(trackEvent('trial_start', {}, { ...options, gtag }));
    } catch {
      finish(false);
    } finally {
      inflight.delete(user.id);
    }
  })();
  return run;
}

export function checkoutEventParams(kind, pricing) {
  const params = {};
  const planOk = Boolean(pricing && PLANS.has(pricing.plan));
  if (planOk) params.plan = pricing.plan;
  if (pricing?.test_mode === true) {
    params.traffic_type = 'internal';
    return params;
  }
  // Revenue only travels with a plan we actually sell. An unrecognised
  // plan is treated as unknown pricing: no value, no currency.
  if (kind === 'completed' && planOk && typeof pricing.price_aud === 'number' && Number.isFinite(pricing.price_aud)) {
    params.value = pricing.price_aud;
    params.currency = 'AUD';
  }
  return params;
}

function offerFromPricing(pricing) {
  if (!pricing || typeof pricing !== 'object') {
    return { plan: null, price_aud: null, test_mode: false };
  }
  return {
    plan: PLANS.has(pricing.plan) ? pricing.plan : null,
    price_aud: typeof pricing.price_aud === 'number' && Number.isFinite(pricing.price_aud) ? pricing.price_aud : null,
    test_mode: pricing.test_mode === true,
  };
}

function newNonce() {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === 'function') return uuid.call(globalThis.crypto);
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Remember the plan from get_pricing in this tab so the success return
 * can label checkout_completed without reading the Stripe session id.
 * Nothing identifying is stored.
 */
export function rememberCheckoutOffer(pricing, storage) {
  const store = storage === undefined ? defaultSessionStorage() : storage;
  const offer = offerFromPricing(pricing);
  if (!pricing || !store) return null;
  const record = { ...offer, nonce: newNonce() };
  try {
    store.setItem(CHECKOUT_OFFER_KEY, JSON.stringify(record));
  } catch {
    return record;
  }
  return record;
}

export function readCheckoutOffer(storage) {
  const store = storage === undefined ? defaultSessionStorage() : storage;
  if (!store) return null;
  try {
    const raw = store.getItem(CHECKOUT_OFFER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const offer = offerFromPricing(data);
    return { ...offer, nonce: typeof data.nonce === 'string' ? data.nonce : '' };
  } catch {
    return null;
  }
}

function mergeOffer(stored, pricing) {
  const live = offerFromPricing(pricing);
  if (!stored) return live;
  return {
    plan: stored.plan || live.plan,
    price_aud: stored.price_aud == null ? live.price_aud : stored.price_aud,
    test_mode: stored.test_mode === true || live.test_mode === true,
  };
}

export function trackCheckoutStarted(pricing, options = {}) {
  return trackEvent('checkout_started', checkoutEventParams('started', pricing), options);
}

/**
 * checkout_completed once per checkout attempt. The nonce is written
 * before gtag runs, so a StrictMode remount or a refresh of the success
 * return does not send a second hit. Cancelled returns must not call this.
 */
export function trackCheckoutCompleted(pricing, options = {}) {
  const storage = options.storage === undefined ? defaultSessionStorage() : options.storage;
  const memory = options.memory || checkoutCompletedMemory;
  const stored = options.offer !== undefined ? options.offer : readCheckoutOffer(storage);
  const nonce = (stored && stored.nonce) || 'success-return';
  if (memory.has(nonce)) return false;
  try {
    if (storage && storage.getItem(CHECKOUT_COMPLETED_KEY) === nonce) {
      memory.add(nonce);
      return false;
    }
  } catch {
    /* private mode — the in-memory set still covers this page load */
  }
  const gtag = options.gtag || defaultGtag();
  if (typeof gtag !== 'function') return false;
  memory.add(nonce);
  try {
    storage?.setItem(CHECKOUT_COMPLETED_KEY, nonce);
  } catch {
    /* private mode */
  }
  const offer = mergeOffer(stored, pricing);
  return trackEvent('checkout_completed', checkoutEventParams('completed', offer), { ...options, gtag });
}
