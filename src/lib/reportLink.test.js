import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReport, decodeReport, encodeReport, reportUrl } from './reportLink.js';

const now = new Date('2026-10-20T00:00:00Z');
const pool = { name: 'Home pool', volumeL: 45000, sanitiser: 'Saltwater chlorinator', surface: 'Pebble / pebblecrete' };
const tests = Array.from({ length: 15 }, (_, i) => ({
  createdAt: new Date(now.getTime() - i * 7 * 864e5).toISOString(),
  freeChlor: 1.5 + i / 10,
  pH: 7.5,
  salt: 3800,
  source: i === 0 ? 'ocr' : 'manual',
  editedAt: i === 2 ? now.toISOString() : null,
}));
const events = [
  { type: 'dose', title: 'Added 520 mL hydrochloric acid', date: '2026-10-18T00:00:00Z' },
  { type: 'care_backwash', title: 'Backwashed the filter', date: '2026-10-17T00:00:00Z' },
  { type: 'dose', title: 'Old dose', date: '2026-05-01T00:00:00Z' },
];

test('a report round-trips through the link', () => {
  const r = buildReport({ pool, tests, events, scoreFn: () => 88, saltRange: { lo: 3300, hi: 5000 }, now });
  const back = decodeReport(`#${encodeReport(r)}`);
  assert.equal(back.pool.name, 'Home pool');
  assert.equal(back.pool.volumeL, 45000);
  assert.deepEqual(back.pool.saltRange, { lo: 3300, hi: 5000 });
  assert.equal(back.tests.length, 12);
  assert.equal(back.tests[0].source, 'ocr');
  assert.equal(back.tests[0].score, 88);
  assert.equal(back.tests[2].edited, true);
  assert.equal(back.tests[0].readings.salt, 3800);
  assert.deepEqual(back.doses.map((d) => d.title), ['Added 520 mL hydrochloric acid']);
});

test('the link carries no email, name or address', () => {
  const r = buildReport({ pool, tests, events, now });
  const text = JSON.stringify(r);
  assert.doesNotMatch(text, /@|first_name|address|postcode/);
  assert.match(reportUrl('https://app.yourpoolmate.com.au', r), /^https:\/\/app\.yourpoolmate\.com\.au\/report#[A-Za-z0-9_-]+$/);
});

test('damaged links are refused, not half-shown', () => {
  assert.equal(decodeReport(''), null);
  assert.equal(decodeReport('#not base64!'), null);
  assert.equal(decodeReport('#e30'), null); // {}
  const r = buildReport({ pool, tests, events, now });
  const good = encodeReport(r);
  assert.equal(decodeReport(`#${good.slice(0, good.length - 7)}`), null);
});

test('unicode pool names survive', () => {
  const r = buildReport({ pool: { ...pool, name: 'Nan’s pool 🏊' }, tests: [], events: [], now });
  assert.equal(decodeReport(encodeReport(r)).pool.name, 'Nan’s pool 🏊');
});
