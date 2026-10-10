// Reminder settings: the weekly test reminder day and the monthly report.
// Pure helpers, no network. Saving is db.saveReminderPrefs.

export const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export const dayLabel = (n) => DAYS.find((d) => d.value === n)?.label ?? '';

// `available` is false until migration 020 is applied: the columns are then
// missing from the row, and the settings are hidden rather than failing on save.
export function prefsFromRow(row) {
  const available = !!row && Object.prototype.hasOwnProperty.call(row, 'reminder_day');
  const day = row?.reminder_day;
  return {
    available,
    reminderDay: Number.isInteger(day) && day >= 0 && day <= 6 ? day : null,
    monthlyReport: row?.monthly_report !== false,
  };
}

const DISMISS_KEY = 'ypm.reminderOffer.v1';

export function readOfferDismissed(storage) {
  try { return storage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}
export function writeOfferDismissed(storage) {
  try { storage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
}

// Offer the weekly reminder once the member has a first test saved, has not
// picked a day, and has not said no thanks.
export function shouldOfferReminder({ prefs, testCount, dismissed }) {
  return !!prefs?.available && prefs.reminderDay === null && testCount >= 1 && !dismissed;
}

// The day after a first test is a sensible default suggestion: same weekday next week.
export function suggestedDay(testedAtIso, fallback = 6) {
  const d = new Date(testedAtIso);
  if (Number.isNaN(d.getTime())) return fallback;
  const name = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'short' }).format(d);
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
  return idx < 0 ? fallback : idx;
}

// ?test=1 on the app URL (the link in the weekly email) opens Test water.
export function wantsTestForm(search) {
  try { return new URLSearchParams(search).get('test') === '1'; } catch { return false; }
}
export function withoutTestParam(href) {
  try {
    const u = new URL(href);
    u.searchParams.delete('test');
    return `${u.pathname}${u.search}${u.hash}`;
  } catch { return '/'; }
}
