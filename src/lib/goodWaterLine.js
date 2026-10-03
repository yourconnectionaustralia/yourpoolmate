// Quiet line under a good Health Score.
//
// "Good" uses the same cut as the green ring: 80 and above. A dosing step
// still wins, so this line never replaces action advice.
//
// The next test is seven days after the logged test, counted in Melbourne
// calendar days. That is the weekly rhythm already used on this screen
// ("within the next week"). A test logged yesterday reads "in 6 days".

import { MELBOURNE_TZ } from './greeting.js';

export const GOOD_SCORE_MIN = 80;
export const NEXT_TEST_INTERVAL_DAYS = 7;

export function waterLooksGood(score, hasCorrectiveAction) {
  const n = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(n) && n >= GOOD_SCORE_MIN && !hasCorrectiveAction;
}

function melbourneDayNumber(date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value);
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  if (!year || !month || !day) return null;
  return Math.round(Date.UTC(year, month - 1, day) / 86400000);
}

export function daysUntilNextTest(testedAt, now = new Date()) {
  const tested = new Date(testedAt);
  if (!testedAt || Number.isNaN(tested.getTime())) return NEXT_TEST_INTERVAL_DAYS;
  const from = melbourneDayNumber(tested);
  const to = melbourneDayNumber(now);
  if (from == null || to == null) return NEXT_TEST_INTERVAL_DAYS;
  return NEXT_TEST_INTERVAL_DAYS - (to - from);
}

function nextTestClause(daysLeft) {
  if (daysLeft > 1) return `Next test in ${daysLeft} days.`;
  if (daysLeft === 1) return 'Next test tomorrow.';
  if (daysLeft === 0) return 'Next test today.';
  if (daysLeft === -1) return 'Next test was due yesterday.';
  return `Next test was due ${-daysLeft} days ago.`;
}

export function goodWaterLine(testedAt, now = new Date()) {
  return `Water looks good. ${nextTestClause(daysUntilNextTest(testedAt, now))}`;
}
