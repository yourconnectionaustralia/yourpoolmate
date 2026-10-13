import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, dayLabel, prefsFromRow, shouldOfferReminder, suggestedDay, wantsTestForm, withoutTestParam,
} from './reminderPrefs.js';

test('prefsFromRow: columns missing means not available', () => {
  assert.deepEqual(prefsFromRow({ is_premium: false }), { available: false, reminderDay: null, monthlyReport: true });
  assert.equal(prefsFromRow(null).available, false);
});

test('prefsFromRow: reads day and report switch', () => {
  assert.deepEqual(prefsFromRow({ reminder_day: 0, monthly_report: false }), { available: true, reminderDay: 0, monthlyReport: false });
  assert.deepEqual(prefsFromRow({ reminder_day: null, monthly_report: true }), { available: true, reminderDay: null, monthlyReport: true });
  assert.equal(prefsFromRow({ reminder_day: 9 }).reminderDay, null);
});

test('days: week starts Monday, Sunday is 0', () => {
  assert.equal(DAYS.length, 7);
  assert.equal(DAYS[0].label, 'Monday');
  assert.equal(dayLabel(0), 'Sunday');
  assert.equal(dayLabel(4), 'Thursday');
});

test('offer: after a first test, once, only when available', () => {
  const prefs = { available: true, reminderDay: null, monthlyReport: true };
  assert.equal(shouldOfferReminder({ prefs, testCount: 1, dismissed: false }), true);
  assert.equal(shouldOfferReminder({ prefs, testCount: 0, dismissed: false }), false);
  assert.equal(shouldOfferReminder({ prefs, testCount: 3, dismissed: true }), false);
  assert.equal(shouldOfferReminder({ prefs: { ...prefs, reminderDay: 2 }, testCount: 3, dismissed: false }), false);
  assert.equal(shouldOfferReminder({ prefs: { ...prefs, available: false }, testCount: 3, dismissed: false }), false);
});

test('suggestedDay: same Melbourne weekday as the test', () => {
  assert.equal(suggestedDay('2026-10-10T04:00:00Z'), 6); // Saturday 10 Oct
  assert.equal(suggestedDay('2026-10-11T00:00:00Z'), 0); // Sunday morning Melbourne
  assert.equal(suggestedDay('nope', 3), 3);
});

test('deep link: ?test=1 is detected and removed', () => {
  assert.equal(wantsTestForm('?test=1'), true);
  assert.equal(wantsTestForm('?test=0'), false);
  assert.equal(wantsTestForm(''), false);
  assert.equal(withoutTestParam('https://app.yourpoolmate.com.au/?test=1'), '/');
  assert.equal(withoutTestParam('https://app.yourpoolmate.com.au/?a=2&test=1#x'), '/?a=2#x');
});
