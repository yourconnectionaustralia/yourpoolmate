import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CHECKOUT_COMPLETED_KEY,
  CHECKOUT_OFFER_KEY,
  CHECKOUT_PENDING_KEY,
  CHECKOUT_PENDING_MAX_AGE_MS,
  TRIAL_START_MAX_AGE_MS,
  TRIAL_START_META_KEY,
  analyticsScreen,
  armCheckoutPending,
  attributionQuery,
  checkoutEventParams,
  consumeCheckoutPending,
  createTestSaveTracker,
  pageViewParams,
  publicEventParams,
  readCheckoutOffer,
  readCheckoutPending,
  rememberCheckoutOffer,
  shouldTrackTrialStart,
  testEntry,
  trackCheckoutCompleted,
  trackCheckoutStarted,
  trackEvent,
  trackPageView,
  trackTrialStartOnce,
} from './analytics.js';

const ORIGIN = 'https://app.yourpoolmate.com.au';
const MEASUREMENT_ID = 'G-ETWSG20K0R';

function screen(overrides = {}) {
  return {
    loading: false,
    recoveryMode: false,
    signedIn: true,
    trialExpired: false,
    isPremium: false,
    dataReady: true,
    activeView: 'health',
    ...overrides,
  };
}

test('signed-in navigation follows activeView, gates replace it', () => {
  assert.equal(analyticsScreen(screen({ loading: true })), null);
  assert.equal(analyticsScreen(screen({ signedIn: false, activeView: 'health' })), 'sign-in');
  assert.equal(analyticsScreen(screen({ recoveryMode: true })), 'reset-password');
  assert.equal(analyticsScreen(screen({ trialExpired: true, isPremium: false })), 'trial-ended');
  assert.equal(analyticsScreen(screen({ trialExpired: true, isPremium: true, activeView: 'profile' })), 'profile');
  assert.equal(analyticsScreen(screen({ dataReady: false })), null);
  for (const view of ['health', 'tests', 'history', 'setup', 'equipment', 'schedule', 'profile']) {
    assert.equal(analyticsScreen(screen({ activeView: view })), view);
  }
});

test('page_view uses a virtual path and drops query and hash', () => {
  const params = pageViewParams('tests', ORIGIN);
  assert.deepEqual(params, {
    page_title: 'Water Tests',
    page_location: `${ORIGIN}/tests`,
    page_path: '/tests',
  });
  assert.equal(params.page_location.includes('?'), false);
  assert.equal(params.page_location.includes('#'), false);
  assert.equal(pageViewParams('not-a-screen', ORIGIN), null);
  assert.equal(pageViewParams('health', ''), null);
});

test('in-app navigations each send one page_view and repeats do not', () => {
  const calls = [];
  const gtag = (...args) => calls.push(args);
  const state = { last: null };
  const options = { gtag, origin: ORIGIN, state };

  assert.equal(trackPageView(null, options), false);
  assert.equal(trackPageView('sign-in', options), true);
  assert.equal(trackPageView('sign-in', options), false);
  assert.equal(trackPageView('health', options), true);
  assert.equal(trackPageView('tests', options), true);
  assert.equal(trackPageView('history', options), true);
  assert.equal(trackPageView('health', options), true);
  assert.equal(trackPageView('nope', options), false);

  assert.deepEqual(calls.map((call) => call[2].page_path), [
    '/sign-in',
    '/health',
    '/tests',
    '/history',
    '/health',
  ]);
  for (const call of calls) {
    assert.deepEqual(call.slice(0, 2), ['event', 'page_view']);
    assert.equal(call[2].page_location.startsWith(ORIGIN), true);
    assert.equal(JSON.stringify(call).includes('@'), false);
  }
});

test('the app loads this measurement id once, with the cross-domain linker', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const scriptSrcs = html.match(/googletagmanager\.com\/gtag\/js\?id=[^"']+/g) || [];
  assert.deepEqual(scriptSrcs, [`googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`]);
  assert.equal(html.includes(`gtag('config', '${MEASUREMENT_ID}', { 'send_page_view': false })`), true);
  assert.equal(
    html.includes(`gtag('set', 'linker', {'domains': ['yourpoolmate.com.au', 'app.yourpoolmate.com.au']})`),
    true,
  );
  assert.deepEqual(html.match(/G-[A-Z0-9]+/g), [MEASUREMENT_ID, MEASUREMENT_ID]);
  assert.equal(/AW-|GTM-|cookie banner|cookieconsent/i.test(html), false);

  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.equal(app.includes("from './lib/analytics.js'"), true);
  assert.equal(app.includes('trackPageView(screenNow)'), true);
  assert.equal(/react-router|createBrowserRouter|BrowserRouter/.test(app), false);
});

test('marketing pages keep the tag already on main and gain no second id', () => {
  for (const file of ['index.html', 'privacy.html', 'terms.html']) {
    const html = readFileSync(new URL(`../../marketing/${file}`, import.meta.url), 'utf8');
    assert.equal(html.includes(`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`), true);
    assert.equal(html.includes(`gtag('config', '${MEASUREMENT_ID}');`), true);
    assert.equal(html.includes("gtag('set', 'linker'"), false);
    assert.deepEqual(html.match(/G-[A-Z0-9]+/g), [MEASUREMENT_ID, MEASUREMENT_ID]);
  }
});

const DIRTY_SEARCH = [
  '?utm_source=facebook',
  'utm_medium=social',
  'utm_campaign=warranty',
  'utm_term=pool+test',
  'utm_content=post',
  'gclid=abc123',
  'session_id=cs_test_secret',
  'checkout=success',
  'access_token=secret-token',
  'email=member@example.com',
].join('&');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    dump: data,
  };
}

function gtagRecorder() {
  const calls = [];
  return { calls, gtag: (...args) => calls.push(args) };
}

test('attribution keeps campaign params and drops everything else', () => {
  const query = attributionQuery(`${DIRTY_SEARCH}#access_token=from-hash`);
  const params = new URLSearchParams(query.slice(1));
  assert.deepEqual([...params.keys()], [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
  ]);
  assert.equal(params.get('utm_source'), 'facebook');
  assert.equal(params.get('gclid'), 'abc123');
  assert.equal(query.includes('session_id'), false);
  assert.equal(query.includes('checkout'), false);
  assert.equal(query.includes('access_token'), false);
  assert.equal(query.includes('email'), false);
  assert.equal(query.includes('#'), false);
  assert.equal(attributionQuery(''), '');
  assert.equal(attributionQuery('?utm_source='), '');
});

test('only the first page_view keeps campaign params', () => {
  const { calls, gtag } = gtagRecorder();
  const state = { last: null, attributionSent: false };
  const options = { gtag, origin: ORIGIN, state, search: DIRTY_SEARCH };

  assert.equal(trackPageView(null, options), false);
  assert.equal(state.attributionSent, false);
  assert.equal(trackPageView('sign-in', options), true);
  assert.equal(trackPageView('health', options), true);

  const [first, second] = calls.map((call) => call[2]);
  assert.equal(first.page_location.includes('utm_source=facebook'), true);
  assert.equal(first.page_location.includes('gclid=abc123'), true);
  assert.equal(first.page_location.includes('session_id'), false);
  assert.equal(first.page_location.includes('#'), false);
  assert.equal(first.page_path, '/sign-in');
  assert.equal(second.page_location, `${ORIGIN}/health`);
  assert.equal(second.page_location.includes('?'), false);
});

test('custom events use the clean virtual path and drop identifying params', () => {
  const { calls, gtag } = gtagRecorder();
  const state = { last: 'tests', attributionSent: true };
  assert.equal(trackEvent('test_saved', {
    entry: 'ocr',
    email: 'member@example.com',
    user_id: 'user-123',
    session_id: 'cs_test_secret',
    name: 'Alex',
    postcode: '3000',
    customer: 'cus_secret',
  }, { gtag, origin: ORIGIN, state }), true);

  assert.equal(calls.length, 1);
  const [type, name, payload] = calls[0];
  assert.equal(type, 'event');
  assert.equal(name, 'test_saved');
  assert.deepEqual(payload, {
    entry: 'ocr',
    page_location: `${ORIGIN}/tests`,
    page_path: '/tests',
  });
  assert.equal(JSON.stringify(payload).includes('@'), false);
  assert.equal(JSON.stringify(payload).includes('session'), false);
  assert.equal(JSON.stringify(payload).includes('3000'), false);
});

test('internal traffic drops value and currency even if both were passed', () => {
  assert.deepEqual(publicEventParams({
    plan: 'annual',
    value: 49,
    currency: 'AUD',
    traffic_type: 'internal',
    email: 'member@example.com',
  }), {
    plan: 'annual',
    traffic_type: 'internal',
  });
  assert.equal(trackEvent('checkout_started', {}, { origin: ORIGIN }), false);
});

test('test entry is manual, voice, or ocr', () => {
  assert.equal(testEntry(undefined), 'manual');
  assert.equal(testEntry('manual'), 'manual');
  assert.equal(testEntry('voice'), 'voice');
  assert.equal(testEntry('ocr'), 'ocr');
  assert.equal(testEntry('shop_import'), 'manual');
});

test('the first successful save is first_test_saved and later saves are not', () => {
  const tracker = createTestSaveTracker();
  tracker.noteServerCount(0);
  const first = tracker.begin();
  const second = tracker.begin();
  tracker.noteServerCount(1);
  assert.equal(first.finish(), 'first_test_saved');
  assert.equal(second.finish(), 'test_saved');

  const returning = createTestSaveTracker();
  returning.noteServerCount(3);
  assert.equal(returning.begin().finish(), 'test_saved');

  const cancelled = createTestSaveTracker();
  const dropped = cancelled.begin();
  dropped.cancel();
  assert.equal(cancelled.begin().finish(), 'first_test_saved');

  const onboarding = createTestSaveTracker();
  assert.equal(onboarding.savedNow(), 'first_test_saved');
  assert.equal(onboarding.begin().finish(), 'test_saved');
});

function recentUser(overrides = {}) {
  return {
    id: 'user-1',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    email_confirmed_at: new Date().toISOString(),
    email: 'member@example.com',
    user_metadata: {},
    ...overrides,
  };
}

test('trial_start is once per recent confirmed account and carries no identifying params', async () => {
  const now = Date.now();
  const fresh = recentUser();
  assert.equal(shouldTrackTrialStart(fresh, { now }), true);
  assert.equal(shouldTrackTrialStart(fresh, { now, isPremium: true }), false);
  assert.equal(shouldTrackTrialStart({
    ...fresh,
    user_metadata: { [TRIAL_START_META_KEY]: true },
  }, { now }), false);
  assert.equal(shouldTrackTrialStart({ ...fresh, email_confirmed_at: null, confirmed_at: null }, { now }), false);
  assert.equal(shouldTrackTrialStart({
    ...fresh,
    created_at: new Date(now - TRIAL_START_MAX_AGE_MS - 1000).toISOString(),
  }, { now }), false);
  assert.equal(shouldTrackTrialStart({
    ...fresh,
    email_confirmed_at: null,
    confirmed_at: new Date().toISOString(),
  }, { now }), true);

  const { calls, gtag } = gtagRecorder();
  const attempted = new Set();
  const inflight = new Map();
  const updates = [];
  const updateUser = async (payload) => {
    updates.push(payload);
    return { error: null };
  };
  const options = { gtag, origin: ORIGIN, screen: 'health', now, attempted, inflight, updateUser };

  assert.equal(await trackTrialStartOnce(fresh, options), true);
  assert.equal(await trackTrialStartOnce(fresh, options), false);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], { data: { [TRIAL_START_META_KEY]: true } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'trial_start');
  assert.deepEqual(Object.keys(calls[0][2]).sort(), ['page_location', 'page_path']);
  assert.equal(calls[0][2].page_location, `${ORIGIN}/health`);
  assert.equal(JSON.stringify(calls[0]).includes('member@example.com'), false);
  assert.equal(JSON.stringify(calls[0]).includes('user-1'), false);
});

test('trial_start does not write the marker when analytics or the account is not eligible', async () => {
  const user = recentUser();
  const updates = [];
  const updateUser = async (payload) => {
    updates.push(payload);
    return { error: null };
  };
  assert.equal(await trackTrialStartOnce(user, { updateUser, origin: ORIGIN }), false);
  assert.equal(updates.length, 0);

  const old = recentUser({
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const { gtag } = gtagRecorder();
  assert.equal(await trackTrialStartOnce(old, { gtag, updateUser, origin: ORIGIN }), false);
  assert.equal(updates.length, 0);
});

test('a failed marker write does not send trial_start and can be retried', async () => {
  const { calls, gtag } = gtagRecorder();
  const attempted = new Set();
  const inflight = new Map();
  let fail = true;
  const updateUser = async () => (fail ? { error: { message: 'offline' } } : { error: null });
  const options = {
    gtag,
    origin: ORIGIN,
    screen: 'health',
    attempted,
    inflight,
    updateUser,
    now: Date.now(),
  };
  const user = recentUser();
  assert.equal(await trackTrialStartOnce(user, options), false);
  assert.equal(calls.length, 0);
  fail = false;
  assert.equal(await trackTrialStartOnce(user, options), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'trial_start');
});

test('overlapping trial_start calls share one marker write', async () => {
  const { calls, gtag } = gtagRecorder();
  const attempted = new Set();
  const inflight = new Map();
  let resolveUpdate;
  const updateUser = () => new Promise((resolve) => { resolveUpdate = resolve; });
  const options = { gtag, origin: ORIGIN, screen: 'health', attempted, inflight, updateUser, now: Date.now() };
  const user = recentUser();
  const first = trackTrialStartOnce(user, options);
  const second = trackTrialStartOnce(user, options);
  resolveUpdate({ error: null });
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(calls.length, 1);
});

test('checkout params come from pricing and test mode omits revenue', () => {
  assert.deepEqual(checkoutEventParams('started', { plan: 'founding_lifetime', price_aud: 79, test_mode: false }), {
    plan: 'founding_lifetime',
  });
  assert.deepEqual(checkoutEventParams('completed', { plan: 'annual', price_aud: 49, test_mode: false }), {
    plan: 'annual',
    value: 49,
    currency: 'AUD',
  });
  assert.deepEqual(checkoutEventParams('completed', { plan: 'founding_lifetime', price_aud: 79, test_mode: true }), {
    plan: 'founding_lifetime',
    traffic_type: 'internal',
  });
  assert.deepEqual(checkoutEventParams('started', null), {});
  assert.deepEqual(checkoutEventParams('completed', { plan: 'lifetime_deal', price_aud: 79 }), {});
});

test('checkout_started fires with the priced plan and checkout_completed fires once', () => {
  const { calls, gtag } = gtagRecorder();
  const storage = memoryStorage();
  const memory = new Set();
  const live = { plan: 'founding_lifetime', price_aud: 79, test_mode: false };
  const options = { gtag, origin: ORIGIN, screen: 'trial-ended', storage, memory };

  assert.equal(trackCheckoutStarted(live, options), true);
  const started = calls[0][2];
  assert.equal(calls[0][1], 'checkout_started');
  assert.deepEqual(started, {
    plan: 'founding_lifetime',
    page_location: `${ORIGIN}/trial-ended`,
    page_path: '/trial-ended',
  });

  const stored = rememberCheckoutOffer(live, storage);
  assert.equal(typeof stored.nonce, 'string');
  assert.equal(readCheckoutOffer(storage).plan, 'founding_lifetime');
  assert.equal(storage.dump[CHECKOUT_OFFER_KEY].includes('79'), true);
  assert.equal(storage.dump[CHECKOUT_OFFER_KEY].includes('@'), false);

  assert.equal(trackCheckoutCompleted(null, options), true);
  assert.equal(trackCheckoutCompleted(null, options), false);
  const refreshed = trackCheckoutCompleted(null, {
    gtag,
    origin: ORIGIN,
    screen: 'health',
    storage,
    memory: new Set(),
  });
  assert.equal(refreshed, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1], 'checkout_completed');
  assert.deepEqual(calls[1][2], {
    plan: 'founding_lifetime',
    value: 79,
    currency: 'AUD',
    page_location: `${ORIGIN}/trial-ended`,
    page_path: '/trial-ended',
  });
  assert.equal(storage.dump[CHECKOUT_COMPLETED_KEY], stored.nonce);
});

test('a test-mode checkout omits value and currency and is marked internal', () => {
  const { calls, gtag } = gtagRecorder();
  const storage = memoryStorage();
  const offer = { plan: 'annual', price_aud: 49, test_mode: true };
  rememberCheckoutOffer(offer, storage);
  assert.equal(trackCheckoutStarted(offer, { gtag, origin: ORIGIN, screen: 'profile' }), true);
  assert.equal(trackCheckoutCompleted({ plan: 'annual', price_aud: 49, test_mode: false }, {
    gtag,
    origin: ORIGIN,
    screen: 'profile',
    storage,
    memory: new Set(),
  }), true);
  for (const call of calls) {
    assert.equal(call[2].traffic_type, 'internal');
    assert.equal('value' in call[2], false);
    assert.equal('currency' in call[2], false);
    assert.equal(call[2].plan, 'annual');
  }
  assert.equal(calls[0][1], 'checkout_started');
  assert.equal(calls[1][1], 'checkout_completed');
});

test('the live shell wires each event without sending a Stripe session id', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const onboarding = readFileSync(new URL('../components/GuestOnboarding.jsx', import.meta.url), 'utf8');
  assert.equal(app.includes('trackTrialStartOnce'), true);
  assert.equal(app.includes('supabase.auth.updateUser'), true);
  assert.equal(app.includes('trackCheckoutStarted'), true);
  assert.equal(app.includes('consumeCheckoutPending'), true);
  assert.equal(app.includes("checkoutReturn === 'success') armCheckoutPending()"), true);
  assert.equal(app.includes('rememberCheckoutOffer'), true);
  assert.equal(app.includes('sessionStorage.removeItem(CHECKOUT_RETURN_KEY)'), true);
  assert.equal(app.includes('awaitWithTimeout'), true);
  assert.equal(app.includes('CHECKOUT_PRICING_WAIT_MS'), true);

  const start = app.indexOf('const startCheckout = async');
  const startFn = app.slice(start, app.indexOf('return (', start));
  assert.equal(startFn.indexOf('createCheckoutSession') < startFn.indexOf('awaitWithTimeout'), true);
  assert.equal(startFn.indexOf('awaitWithTimeout') < startFn.indexOf('trackCheckoutStarted'), true);
  assert.equal(startFn.indexOf('trackCheckoutStarted') < startFn.indexOf('window.location.assign'), true);

  const persist = app.slice(app.indexOf('const persistTest'), app.indexOf('const finalizeTest'));
  assert.equal(persist.includes('.then('), true);
  assert.equal(persist.indexOf('.then(') < persist.indexOf('trackEvent'), true);
  assert.equal(persist.indexOf('trackEvent') < persist.indexOf('.catch('), true);
  assert.equal(app.includes("source: 'ocr'"), true);
  assert.equal(app.includes("source: 'voice'"), true);

  const saved = onboarding.indexOf("supabase.from('water_tests').insert");
  const callback = onboarding.indexOf('onTestSaved?.()');
  assert.equal(saved > 0 && callback > saved, true);
  assert.equal(/track(Event|CheckoutStarted|CheckoutCompleted|TrialStartOnce)\([\s\S]{0,180}session_id/.test(app), false);
  assert.equal(app.includes("params.delete('session_id')"), true);
});

test('a slow webhook still completes once on a later load, then not again', () => {
  const { calls, gtag } = gtagRecorder();
  const session = memoryStorage();
  const pending = memoryStorage();
  const memory = new Set();
  const startedAt = Date.parse('2026-10-08T00:00:00.000Z');
  const offer = rememberCheckoutOffer(
    { plan: 'founding_lifetime', price_aud: 79, test_mode: false },
    session,
  );
  const armed = armCheckoutPending({
    pendingStorage: pending,
    offer,
    now: startedAt,
  });
  assert.equal(armed.nonce, offer.nonce);
  assert.equal(armed.pendingAt, startedAt);

  // The return flag is gone and premium is not in yet. The marker stays,
  // and nothing is sent until the shell asks (it only asks once is_premium).
  assert.equal(readCheckoutPending(pending, { now: startedAt + 60 * 1000 }).nonce, offer.nonce);
  assert.equal(readCheckoutPending(pending, { now: startedAt + 60 * 1000 }).plan, 'founding_lifetime');
  assert.equal(calls.filter((call) => call[1] === 'checkout_completed').length, 0);
  assert.equal(memory.size, 0);

  const later = startedAt + 2 * 60 * 60 * 1000;
  assert.equal(consumeCheckoutPending(null, {
    pendingStorage: pending,
    storage: pending,
    gtag,
    memory: new Set(),
    now: later,
    origin: ORIGIN,
    screen: 'health',
  }), true);
  assert.equal(readCheckoutPending(pending, { now: later }), null);
  assert.equal(pending.dump[CHECKOUT_COMPLETED_KEY], offer.nonce);

  // Same nonce, even if something arms it again, does not send twice.
  assert.equal(armCheckoutPending({ pendingStorage: pending, offer, now: later + 1000 }), null);
  assert.equal(consumeCheckoutPending(null, {
    pendingStorage: pending,
    storage: pending,
    gtag,
    memory: new Set(),
    now: later + 1000,
    origin: ORIGIN,
    screen: 'health',
  }), false);
  assert.equal(calls.filter((call) => call[1] === 'checkout_completed').length, 1);
  assert.deepEqual(calls.find((call) => call[1] === 'checkout_completed')[2], {
    plan: 'founding_lifetime',
    value: 79,
    currency: 'AUD',
    page_location: `${ORIGIN}/health`,
    page_path: '/health',
  });
  assert.equal(JSON.stringify(pending.dump).includes('session'), false);
});

test('an expired pending checkout is dropped and does not send', () => {
  const { calls, gtag } = gtagRecorder();
  const pending = memoryStorage();
  const startedAt = Date.parse('2026-10-01T00:00:00.000Z');
  armCheckoutPending({
    pendingStorage: pending,
    offer: { plan: 'annual', price_aud: 49, test_mode: false, nonce: 'nonce-old' },
    now: startedAt,
  });
  const expiredAt = startedAt + CHECKOUT_PENDING_MAX_AGE_MS + 1;
  assert.equal(readCheckoutPending(pending, { now: expiredAt }), null);
  assert.equal(CHECKOUT_PENDING_KEY in pending.dump, false);
  assert.equal(consumeCheckoutPending(null, {
    pendingStorage: pending,
    gtag,
    memory: new Set(),
    now: expiredAt,
    origin: ORIGIN,
    screen: 'health',
  }), false);
  assert.equal(calls.length, 0);

  // Re-arming the same nonce inside the window keeps the original clock.
  const fresh = memoryStorage();
  const first = armCheckoutPending({
    pendingStorage: fresh,
    offer: { plan: 'annual', price_aud: 49, test_mode: true, nonce: 'nonce-new' },
    now: startedAt,
  });
  const second = armCheckoutPending({
    pendingStorage: fresh,
    offer: { plan: 'annual', price_aud: 49, test_mode: true, nonce: 'nonce-new' },
    now: startedAt + 60 * 1000,
  });
  assert.equal(second.pendingAt, first.pendingAt);
});

test('a pending checkout waits for gtag and then sends once', () => {
  const pending = memoryStorage();
  const now = Date.parse('2026-10-08T03:00:00.000Z');
  armCheckoutPending({
    pendingStorage: pending,
    offer: { plan: 'annual', price_aud: 49, test_mode: false, nonce: 'nonce-wait' },
    now,
  });
  assert.equal(consumeCheckoutPending(null, {
    pendingStorage: pending,
    storage: pending,
    memory: new Set(),
    now,
    origin: ORIGIN,
    screen: 'health',
  }), false);
  assert.equal(readCheckoutPending(pending, { now }).nonce, 'nonce-wait');

  const { calls, gtag } = gtagRecorder();
  assert.equal(consumeCheckoutPending(null, {
    pendingStorage: pending,
    storage: pending,
    gtag,
    memory: new Set(),
    now,
    origin: ORIGIN,
    screen: 'health',
  }), true);
  assert.equal(consumeCheckoutPending(null, {
    pendingStorage: pending,
    storage: pending,
    gtag,
    memory: new Set(),
    now,
    origin: ORIGIN,
    screen: 'health',
  }), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'checkout_completed');
  assert.equal(calls[0][2].plan, 'annual');
  assert.equal(calls[0][2].value, 49);
});
