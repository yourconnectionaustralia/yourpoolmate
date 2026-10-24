// File: src/lib/trendRange.js
// The date window for the Chemistry log's "Trends over time" graph.
//
// The graph used to stretch to the oldest thing on it, so a pump installed in
// 2019 pushed the start of the graph back years before the first water test.
// Now the graph starts on the day of the first test, and the owner can narrow it
// to the last 3, 6 or 12 months or to a date range of their own.
//
// Events (doses, treatments, equipment) and untested-gap bands are cut to the
// same window, so nothing from outside it is drawn.

export const DAY_MS = 24 * 60 * 60 * 1000;

export const PRESETS = [
  { key: 'all', label: 'All time' },
  { key: '3m', label: '3 months', months: 3 },
  { key: '6m', label: '6 months', months: 6 },
  { key: '12m', label: '12 months', months: 12 },
];

const pad = (n) => String(n).padStart(2, '0');

// YYYY-MM-DD on the device's calendar, for <input type="date">.
export function toDay(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(str) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

export function dayStart(str) {
  const p = parseDay(str);
  return p ? new Date(p.y, p.mo, p.d, 0, 0, 0, 0).getTime() : null;
}

export function dayEnd(str) {
  const p = parseDay(str);
  return p ? new Date(p.y, p.mo, p.d, 23, 59, 59, 999).getTime() : null;
}

const ms = (iso) => +new Date(iso);

// The first test's time, or null with no tests.
export function firstTestTime(history) {
  const times = (history || []).map((h) => ms(h.createdAt)).filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}

function monthsBefore(now, months) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

// Presets worth showing: a "3 months" button is only useful once the first test
// is more than 3 months old. "All time" is always there.
export function availablePresets(history, now = Date.now()) {
  const first = firstTestTime(history);
  return PRESETS.filter((p) => !p.months || (first !== null && first < monthsBefore(now, p.months)));
}

// range: { preset: 'all' | '3m' | '6m' | '12m' | 'custom', from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }
// Returns the window and the data inside it. `from` is never before the first
// test's day, and `to` is never after today.
export function trendWindow({ history = [], events = [], gaps = [], range = { preset: 'all' }, now = Date.now() }) {
  const first = firstTestTime(history);
  if (first === null) return { empty: true, from: null, to: null, history: [], events: [], gaps: [], firstDay: null, lastDay: null };

  const times = history.map((h) => ms(h.createdAt)).filter(Number.isFinite);
  const last = Math.max(...times);
  const firstDayStart = dayStart(toDay(first));
  const todayEnd = dayEnd(toDay(now));
  const inRange = (t, lo, hi) => Number.isFinite(t) && t >= lo && t <= hi;

  let from;
  let to;
  if (range.preset === 'custom') {
    from = Math.max(dayStart(range.from) ?? firstDayStart, firstDayStart);
    to = Math.min(dayEnd(range.to) ?? todayEnd, todayEnd);
    if (to < from) to = Math.min(dayEnd(toDay(from)), todayEnd);
  } else if (range.preset === '3m' || range.preset === '6m' || range.preset === '12m') {
    const months = PRESETS.find((p) => p.key === range.preset).months;
    from = Math.max(firstDayStart, dayStart(toDay(monthsBefore(now, months))));
    to = todayEnd;
  } else {
    // All time: first test to the last thing worth showing. A dose after the
    // last test, or the untested stretch up to today, stays on the graph.
    from = firstDayStart;
    to = last;
    for (const e of events) {
      const t = ms(e.date);
      if (inRange(t, from, now) && t > to) to = t;
    }
    for (const g of gaps) {
      const t = Math.min(ms(g.end), now);
      if (Number.isFinite(t) && t > to) to = t;
    }
  }

  const win = {
    history: history.filter((h) => inRange(ms(h.createdAt), from, to)),
    events: events.filter((e) => inRange(ms(e.date), from, to)),
    gaps: gaps
      .map((g) => ({ ...g, start: new Date(Math.max(ms(g.start), from)).toISOString(), end: new Date(Math.min(ms(g.end), to)).toISOString() }))
      .filter((g) => ms(g.end) > ms(g.start)),
  };
  return { empty: win.history.length === 0, from, to, ...win, firstDay: toDay(first), lastDay: toDay(last) };
}
