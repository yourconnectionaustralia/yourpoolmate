import assert from 'node:assert/strict';
import test from 'node:test';
import { ANDROID_STEPS, IOS_STEPS, countVisit, installPlatform, shouldShowInstallGuide } from './installGuide.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_FACEBOOK = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/470.0.0.40.108;FBBV/600000000;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_AU]';
const IPHONE_INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.12.109 (iPhone14,2; iOS 17_5; en_AU; en-AU; scale=3.00; 1170x2532; 600000000)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0';
const ANDROID_EDGE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0';
const ANDROID_FACEBOOK = 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.108;]';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

test('iPhone Safari gets the Share steps, old and new iOS alike', () => {
  assert.equal(installPlatform({ userAgent: IPHONE }), 'ios');
  assert.equal(installPlatform({ userAgent: IPHONE_26 }), 'ios');
});

test('Android Chrome gets a one-tap button when the browser offers one, steps when not', () => {
  assert.equal(installPlatform({ userAgent: ANDROID, hasPrompt: true }), 'android-prompt');
  assert.equal(installPlatform({ userAgent: ANDROID }), 'android');
  // Another browser that offers the prompt can use the button too: the prompt is the browser's own.
  assert.equal(installPlatform({ userAgent: ANDROID_SAMSUNG, hasPrompt: true }), 'android-prompt');
});

test('no guide where we cannot give steps that are right', () => {
  assert.equal(installPlatform({ userAgent: IPHONE_CHROME }), 'other');
  assert.equal(installPlatform({ userAgent: IPHONE_FIREFOX }), 'other');
  assert.equal(installPlatform({ userAgent: ANDROID_SAMSUNG }), 'other');
  assert.equal(installPlatform({ userAgent: ANDROID_FIREFOX }), 'other');
  assert.equal(installPlatform({ userAgent: ANDROID_EDGE }), 'other');
  assert.equal(installPlatform({ userAgent: DESKTOP }), 'other');
  // iPad reports itself as a Mac and its Share button is somewhere else.
  assert.equal(installPlatform({ userAgent: IPAD }), 'other');
});

test('in-app browsers (a Facebook link, an Instagram link) cannot add to the home screen', () => {
  assert.equal(installPlatform({ userAgent: IPHONE_FACEBOOK }), 'other');
  assert.equal(installPlatform({ userAgent: IPHONE_INSTAGRAM }), 'other');
  assert.equal(installPlatform({ userAgent: ANDROID_FACEBOOK }), 'other');
  assert.equal(installPlatform({ userAgent: ANDROID_FACEBOOK, hasPrompt: true }), 'other');
});

test('already installed beats everything', () => {
  assert.equal(installPlatform({ userAgent: IPHONE, standalone: true }), 'installed');
  assert.equal(installPlatform({ userAgent: ANDROID, standalone: true, hasPrompt: true }), 'installed');
});

test('the steps say where to tap on the phones they are for', () => {
  assert.equal(IOS_STEPS.length, 3);
  assert.match(IOS_STEPS[0], /Share/);
  assert.match(IOS_STEPS[0], /More/); // newer iPhones keep Share inside the More button
  assert.doesNotMatch(IOS_STEPS[0], /bottom of the screen/);
  assert.match(IOS_STEPS[1], /Add to Home Screen/);
  assert.equal(ANDROID_STEPS.length, 3);
  assert.match(ANDROID_STEPS[1], /Add to home screen/);
  assert.match(ANDROID_STEPS[1], /Install/);
  assert.doesNotMatch(ANDROID_STEPS[0], /top right/);
});

const NOW = new Date('2026-10-10T02:00:00Z');

test('shows from the second visit on a phone', () => {
  assert.equal(shouldShowInstallGuide({ platform: 'ios', visits: 1, now: NOW }), false);
  assert.equal(shouldShowInstallGuide({ platform: 'ios', visits: 2, now: NOW }), true);
  assert.equal(shouldShowInstallGuide({ platform: 'android', visits: 3, now: NOW }), true);
});

test('never shows when installed or where there is no reliable guide', () => {
  assert.equal(shouldShowInstallGuide({ platform: 'installed', visits: 9, now: NOW }), false);
  assert.equal(shouldShowInstallGuide({ platform: 'other', visits: 9, now: NOW }), false);
});

test('dismissing hides it for 30 days, then it can return', () => {
  assert.equal(shouldShowInstallGuide({ platform: 'ios', visits: 5, dismissedAt: '2026-10-01T00:00:00Z', now: NOW }), false);
  assert.equal(shouldShowInstallGuide({ platform: 'ios', visits: 5, dismissedAt: '2026-09-01T00:00:00Z', now: NOW }), true);
});

function memory() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; }

test('a visit is counted once per session', () => {
  const local = memory(); const session = memory();
  assert.equal(countVisit(local, session), 1);
  assert.equal(countVisit(local, session), 1);
  assert.equal(countVisit(local, memory()), 2); // new session
});

test('broken storage counts as zero visits, so nothing shows', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(countVisit(broken, broken), 0);
});
