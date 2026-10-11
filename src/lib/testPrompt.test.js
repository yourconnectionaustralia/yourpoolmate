import assert from 'node:assert/strict';
import test from 'node:test';
import { daysSinceTest, nextTestDueLabel, testPrompt } from './testPrompt.js';
import { DOSE_PLAN_GUIDANCE, safetyLineFor } from './dosingSafety.js';

// 3 Oct 2026 is Saturday and still AEST. Clocks go forward at 2am on 4 Oct 2026.
const SAT_NOON = '2026-10-03T02:00:00Z';

test('days since a test are Melbourne calendar days', () => {
  assert.equal(daysSinceTest(SAT_NOON, new Date('2026-10-03T02:00:00Z')), 0);
  assert.equal(daysSinceTest(SAT_NOON, new Date('2026-10-10T13:30:00Z')), 8); // 11 Oct 00:30 AEDT
});

test('a test seven days old is due, not stale', () => {
  const p = testPrompt(SAT_NOON, new Date('2026-10-10T02:00:00Z'));
  assert.equal(p.kind, 'upcoming');
  assert.equal(p.text, 'Next test due today.');
});

test('a test eight days old is stale and says how long', () => {
  const p = testPrompt(SAT_NOON, new Date('2026-10-11T02:00:00Z'));
  assert.equal(p.kind, 'stale');
  assert.equal(p.days, 8);
  assert.equal(p.title, 'Last tested 8 days ago');
});

test('a fresh test names the due weekday and date', () => {
  const p = testPrompt(SAT_NOON, new Date('2026-10-03T03:00:00Z'));
  assert.equal(p.kind, 'upcoming');
  assert.equal(p.text, 'Next test due Saturday 10 Oct.');
});

test('tomorrow wording', () => {
  assert.equal(testPrompt(SAT_NOON, new Date('2026-10-09T02:00:00Z')).text, 'Next test due tomorrow.');
});

test('a test logged late on a Sunday night is due the following Sunday', () => {
  // 11 Oct 23:30 AEDT
  assert.equal(nextTestDueLabel('2026-10-11T12:30:00Z'), 'Sunday 18 Oct');
});

test('no test, no prompt', () => {
  assert.equal(testPrompt(null), null);
  assert.equal(testPrompt('not a date'), null);
});

test('every dose step has a safety line with gloves or label advice', () => {
  for (const [key, state] of [['pH', 'low'], ['pH', 'high'], ['alkalinity', 'low'], ['alkalinity', 'high'],
    ['freeChlor', 'low'], ['freeChlor', 'high'], ['cyanuricAcid', 'low'], ['calciumHardness', 'low'], ['salt', 'low']]) {
    assert.match(safetyLineFor(key, state), /gloves|label/i, `${key} ${state}`);
  }
});

test('acid and chlorine lines carry the never-mix warning', () => {
  assert.match(safetyLineFor('pH', 'high'), /never water to acid/i);
  assert.match(safetyLineFor('pH', 'high'), /never mix acid with chlorine/i);
  assert.match(safetyLineFor('freeChlor', 'low'), /never mix chlorine with acid/i);
});

test('plan guidance says guide, not guarantee, and to re-test', () => {
  assert.match(DOSE_PLAN_GUIDANCE, /not a guarantee/);
  assert.match(DOSE_PLAN_GUIDANCE, /re-test/);
});
