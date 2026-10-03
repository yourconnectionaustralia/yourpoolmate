import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyticsScreen, pageViewParams, trackPageView } from './analytics.js';

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
  assert.equal(app.includes("import { analyticsScreen, trackPageView } from './lib/analytics.js'"), true);
  assert.equal(app.includes('trackPageView(analyticsScreen('), true);
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
