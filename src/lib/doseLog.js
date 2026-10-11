// Turning a dose step into a history entry, and asking for a retest afterwards.
//
// "I added it" on a dose step saves a pool event (type 'dose') with the
// chemical and amount in plain words, so the export and the timeline show what
// was added and when. Nothing here needs a new database column.

import { melbourneDayNumber } from './goodWaterLine.js';

export function doseEventFor(step, option, volumeL, when = new Date()) {
  const title = option.amount
    ? `Added ${option.amount} ${option.name}`
    : `${step.action}: ${option.name}`;
  const bits = [step.action];
  if (volumeL > 0) bits.push(`pool ${Number(volumeL).toLocaleString('en-AU')} L`);
  return { type: 'dose', title, notes: bits.join(' · '), date: when.toISOString() };
}

// Events that change the water enough that the next test is worth taking soon.
export const RETEST_TYPES = new Set(['dose', 'shock', 'green_treatment', 'treatment', 'drain_refill']);

const RETEST_AFTER_HOURS = 24;
const GIVE_UP_AFTER_DAYS = 14; // after this the plain "last tested" banner takes over

const timeLabel = (date) => new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Melbourne', hour: 'numeric', minute: '2-digit', hour12: true,
}).format(date).replace(/\s/g, '').toLowerCase();

// "today" / "tomorrow" / "Sunday" for a Melbourne calendar day, relative to now.
function dayWord(date, now) {
  const diff = melbourneDayNumber(date) - melbourneDayNumber(now);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'long' }).format(date);
}

// Returns null when there is nothing to ask for.
//   wait: a dose went in less than 24 hours ago, so say when to test
//   now:  24 hours have passed with no test since
export function retestPrompt(events, lastTestIso, now = new Date()) {
  const lastTest = lastTestIso ? new Date(lastTestIso).getTime() : -Infinity;
  const nowMs = now.getTime();
  const latest = (events || [])
    .filter(e => RETEST_TYPES.has(e.type))
    .map(e => ({ ...e, at: new Date(e.date).getTime() }))
    .filter(e => Number.isFinite(e.at) && e.at <= nowMs && e.at > lastTest)
    .sort((a, b) => b.at - a.at)[0];
  if (!latest) return null;

  const hours = (nowMs - latest.at) / 3600000;
  if (hours > GIVE_UP_AFTER_DAYS * 24) return null;

  if (hours < RETEST_AFTER_HOURS) {
    const ready = new Date(latest.at + RETEST_AFTER_HOURS * 3600000);
    return {
      kind: 'wait',
      title: 'Test again to see if it worked',
      body: `Give the water 24 hours to settle, then test ${dayWord(ready, now)} after ${timeLabel(ready)}. Your Health Score will show the change.`,
    };
  }
  return {
    kind: 'now',
    title: 'Time to see if it worked',
    body: 'It has been over 24 hours since you treated the water. A quick test shows how it settled.',
  };
}
