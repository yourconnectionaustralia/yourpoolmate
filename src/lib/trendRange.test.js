import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { availablePresets, dayEnd, dayStart, toDay, trendWindow } from './trendRange.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0).getTime();
const iso = (ms) => new Date(ms).toISOString();
const NOW = at(2026, 10, 24, 9);

const tests = [
  { createdAt: iso(at(2026, 3, 24)), freeChlor: 7.1 },
  { createdAt: iso(at(2026, 6, 10)) },
  { createdAt: iso(at(2026, 10, 15)), freeChlor: 0.61 },
];
// A pump installed in 2019 and a dose before the first test.
const events = [
  { id: 'eq', type: 'new_equipment', date: iso(at(2019, 5, 1)) },
  { id: 'old', type: 'dose', date: iso(at(2026, 3, 1)) },
  { id: 'mid', type: 'dose', date: iso(at(2026, 7, 2)) },
  { id: 'after', type: 'dose', date: iso(at(2026, 10, 18)) },
];

test('all time starts on the day of the first test, not at the oldest event', () => {
  const w = trendWindow({ history: tests, events, now: NOW });
  assert.equal(toDay(w.from), '2026-03-24');
  assert.deepEqual(w.events.map((e) => e.id), ['mid', 'after']);
  assert.equal(w.history.length, 3);
  // Ends at the last thing on it: the dose after the last test.
  assert.equal(toDay(w.to), '2026-10-18');
  assert.equal(w.firstDay, '2026-03-24');
});

test('an event on the first test day is kept', () => {
  const same = [{ id: 'same', type: 'dose', date: iso(at(2026, 3, 24, 8)) }];
  assert.equal(trendWindow({ history: tests, events: same, now: NOW }).events.length, 1);
});

test('the untested stretch up to today stays on an all-time graph', () => {
  const gaps = [{ start: iso(at(2026, 3, 24)), end: iso(at(2026, 6, 10)), days: 78 }, { start: iso(at(2026, 10, 15)), end: iso(NOW), days: 9, ongoing: true }];
  const w = trendWindow({ history: tests, gaps, now: NOW });
  assert.equal(toDay(w.to), '2026-10-24');
  assert.equal(w.gaps.length, 2);
});

test('3, 6 and 12 month windows never start before the first test', () => {
  const six = trendWindow({ history: tests, events, range: { preset: '6m' }, now: NOW });
  assert.equal(toDay(six.from), '2026-04-24');
  assert.equal(toDay(six.to), '2026-10-24');
  assert.deepEqual(six.history.map((h) => toDay(+new Date(h.createdAt))), ['2026-06-10', '2026-10-15']);
  const twelve = trendWindow({ history: tests, events, range: { preset: '12m' }, now: NOW });
  assert.equal(toDay(twelve.from), '2026-03-24');
  assert.equal(twelve.history.length, 3);
});

test('a custom range is clamped to the first test and to today', () => {
  const w = trendWindow({ history: tests, events, range: { preset: 'custom', from: '2019-01-01', to: '2030-01-01' }, now: NOW });
  assert.equal(toDay(w.from), '2026-03-24');
  assert.equal(toDay(w.to), '2026-10-24');
  const mid = trendWindow({ history: tests, events, range: { preset: 'custom', from: '2026-06-01', to: '2026-07-31' }, now: NOW });
  assert.deepEqual(mid.history.map((h) => toDay(+new Date(h.createdAt))), ['2026-06-10']);
  assert.deepEqual(mid.events.map((e) => e.id), ['mid']);
  // To before From does not make an upside-down window.
  const flipped = trendWindow({ history: tests, range: { preset: 'custom', from: '2026-07-31', to: '2026-06-01' }, now: NOW });
  assert.ok(flipped.to >= flipped.from);
  // Inclusive of the whole last day.
  const edge = trendWindow({ history: tests, range: { preset: 'custom', from: '2026-10-15', to: '2026-10-15' }, now: NOW });
  assert.equal(edge.history.length, 1);
});

test('a window with no tests says so instead of drawing nothing', () => {
  const w = trendWindow({ history: tests, range: { preset: 'custom', from: '2026-07-01', to: '2026-07-31' }, now: NOW });
  assert.equal(w.empty, true);
  assert.equal(trendWindow({ history: [], now: NOW }).empty, true);
});

test('gaps are cut to the window', () => {
  const gaps = [{ start: iso(at(2026, 3, 24)), end: iso(at(2026, 6, 10)), days: 78 }];
  const w = trendWindow({ history: tests, gaps, range: { preset: 'custom', from: '2026-05-01', to: '2026-10-24' }, now: NOW });
  assert.equal(toDay(+new Date(w.gaps[0].start)), '2026-05-01');
  assert.equal(toDay(+new Date(w.gaps[0].end)), '2026-06-10');
  const outside = trendWindow({ history: tests, gaps, range: { preset: 'custom', from: '2026-07-01', to: '2026-10-24' }, now: NOW });
  assert.deepEqual(outside.gaps, []);
});

test('only presets that mean something are offered', () => {
  const keys = (h) => availablePresets(h, NOW).map((p) => p.key);
  assert.deepEqual(keys(tests), ['all', '3m', '6m']);
  assert.deepEqual(keys([{ createdAt: iso(at(2026, 10, 1)) }]), ['all']);
  assert.deepEqual(keys([{ createdAt: iso(at(2024, 1, 1)) }]), ['all', '3m', '6m', '12m']);
  assert.deepEqual(keys([]), ['all']);
});

test('day helpers use the device calendar', () => {
  assert.equal(toDay(dayStart('2026-10-15')), '2026-10-15');
  assert.equal(toDay(dayEnd('2026-10-15')), '2026-10-15');
  assert.equal(dayStart('nope'), null);
});

test('the Chemistry log graph uses the window', () => {
  const chart = readFileSync(new URL('../components/WaterTrendChart.jsx', import.meta.url), 'utf8');
  assert.match(chart, /trendWindow\(/);
  assert.match(chart, /aria-label="Choose a date range"/);
  // The old rule that stretched the axis to the oldest event is gone.
  assert.doesNotMatch(chart, /\.\.\.events\.map\(e => \+new Date\(e\.date\)\)/);
});
