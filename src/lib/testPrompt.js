// Prompts about when the next water test is due.
//
// Weekly is the rhythm the app already uses ("within the next week or so"),
// so a test counts as overdue once more than seven Melbourne calendar days
// have passed. Days are counted on Melbourne civil dates, not 24-hour blocks,
// so a test logged late on a Sunday is still due the following Sunday.

import {
  NEXT_TEST_INTERVAL_DAYS,
  daysUntilNextTest,
  melbourneDayNumber,
} from './goodWaterLine.js';

export function daysSinceTest(testedAt, now = new Date()) {
  return NEXT_TEST_INTERVAL_DAYS - daysUntilNextTest(testedAt, now);
}

// "Sunday 18 Oct" for the Melbourne calendar day that is `intervalDays` after the test.
export function nextTestDueLabel(testedAt, now = new Date()) {
  const tested = new Date(testedAt);
  if (!testedAt || Number.isNaN(tested.getTime())) return null;
  const from = melbourneDayNumber(tested);
  if (from == null) return null;
  const due = new Date((from + NEXT_TEST_INTERVAL_DAYS) * 86400000 + 12 * 3600000);
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short',
  }).format(due).replace(',', '');
}

// Returns null when there is no test to measure from.
//   stale:    more than seven days since the last test (banner with a button)
//   upcoming: a quiet "next test due" line
export function testPrompt(testedAt, now = new Date()) {
  if (!testedAt || Number.isNaN(new Date(testedAt).getTime())) return null;
  const since = daysSinceTest(testedAt, now);
  if (since > NEXT_TEST_INTERVAL_DAYS) {
    return {
      kind: 'stale',
      days: since,
      title: `Last tested ${since} days ago`,
      body: 'A quick test keeps your record complete and your doses accurate.',
    };
  }
  const left = NEXT_TEST_INTERVAL_DAYS - since;
  let text;
  if (left === 0) text = 'Next test due today.';
  else if (left === 1) text = 'Next test due tomorrow.';
  else text = `Next test due ${nextTestDueLabel(testedAt, now)}.`;
  return { kind: 'upcoming', days: left, text };
}
