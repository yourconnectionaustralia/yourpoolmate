import assert from 'node:assert/strict';
import test from 'node:test';
import { countVisit, installPlatform, shouldShowInstallGuide } from './installGuide.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15';

test('platform detection', () => {
  assert.equal(installPlatform({ userAgent: IPHONE }), 'ios');
  assert.equal(installPlatform({ userAgent: IPAD, maxTouchPoints: 5 }), 'ios');
  assert.equal(installPlatform({ userAgent: IPAD, maxTouchPoints: 0 }), 'other');
  assert.equal(installPlatform({ userAgent: ANDROID, hasPrompt: true }), 'android-prompt');
  assert.equal(installPlatform({ userAgent: ANDROID }), 'android');
  assert.equal(installPlatform({ userAgent: DESKTOP }), 'other');
  assert.equal(installPlatform({ userAgent: IPHONE, standalone: true }), 'installed');
});

const NOW = new Date('2026-10-10T02:00:00Z');

test('shows from the second visit on a phone', () => {
  assert.equal(shouldShowInstallGuide({ platform: 'ios', visits: 1, now: NOW }), false);
  assert.equal(shouldShowInstallGuide({ platform: 'ios', visits: 2, now: NOW }), true);
  assert.equal(shouldShowInstallGuide({ platform: 'android', visits: 3, now: NOW }), true);
});

test('never shows when installed or on a desktop', () => {
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
