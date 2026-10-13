// Equipment care: the small jobs that keep a pool's gear working, and when
// each is next due. A job is shown only for equipment the owner has added.
//
// Marking a job done saves a pool event (type "care_<key>"), so it sits in the
// history and the PDF record beside the water tests, and needs no new table.
//
// Intervals are typical figures for a pool in use, not a manufacturer's rule.
// Every tip points back to the equipment manual for the exact steps.

import { melbourneDayNumber } from './goodWaterLine.js';

export const CARE_PREFIX = 'care_';
export const SOON_DAYS = 3; // "due soon" window before the day it is due

export const CARE_TASKS = [
  {
    key: 'pump_basket',
    equipment: 'Pump',
    label: 'Empty the pump basket',
    doneTitle: 'Emptied the pump basket',
    everyDays: 14,
    every: 'about every 2 weeks',
    tip: 'Switch the pump off first. A full basket slows the water flow and makes the pump work harder.',
  },
  {
    key: 'backwash',
    equipment: 'Filter',
    media: 'backwash',
    label: 'Backwash the filter',
    doneTitle: 'Backwashed the filter',
    everyDays: 42,
    every: 'about every 4 to 6 weeks while you are swimming',
    tip: 'Also worth doing when the pressure gauge reads well above where it sits after a clean. Your filter manual gives the figure. Switch the pump off before you move the valve.',
  },
  {
    key: 'cartridge_clean',
    equipment: 'Filter',
    media: 'cartridge',
    label: 'Clean the filter cartridge',
    doneTitle: 'Cleaned the filter cartridge',
    everyDays: 42,
    every: 'about every 4 to 6 weeks while you are swimming',
    tip: 'Switch the pump off, lift the cartridge out and hose it down. Replace it if it is worn or will not come clean.',
  },
  {
    key: 'salt_cell',
    equipment: 'Chlorinator',
    label: 'Check the salt cell',
    doneTitle: 'Checked the salt cell',
    everyDays: 90,
    every: 'about every 3 months',
    tip: 'Look for white scale on the plates. If it has built up, clean it the way your chlorinator manual says.',
  },
  {
    key: 'robot_filter',
    equipment: 'Robotic Cleaner',
    label: "Empty and rinse the cleaner's filter",
    doneTitle: "Emptied and rinsed the cleaner's filter",
    everyDays: 14,
    every: 'about every 2 weeks',
    tip: 'A full filter basket stops the cleaner picking up. Take it out of the water and unplug it before you open it.',
  },
];

const normType = (t) => (t === 'Salt Chlorinator' ? 'Chlorinator' : t);

export const careEventType = (key) => `${CARE_PREFIX}${key}`;
export const isCareEvent = (type) => typeof type === 'string' && type.startsWith(CARE_PREFIX);

// Cartridge filters get the cartridge job. Everything else (sand, glass,
// zeolite, DE, not sure) gets the backwash job.
export function filterMedia(filterType) {
  return /cartridge/i.test(String(filterType || '')) ? 'cartridge' : 'backwash';
}

export function careTasksFor(equipment, pool) {
  const have = new Set((equipment || []).map((e) => normType(e.type)));
  const media = filterMedia(pool?.filter);
  return CARE_TASKS.filter((t) => have.has(t.equipment) && (!t.media || t.media === media));
}

export function careEventFor(task, when = new Date()) {
  return { type: careEventType(task.key), title: task.doneTitle, notes: '', date: when.toISOString() };
}

export function lastDone(events, task) {
  const type = careEventType(task.key);
  let best = null;
  for (const e of events || []) {
    if (e.type !== type) continue;
    const t = new Date(e.date).getTime();
    if (Number.isFinite(t) && (best === null || t > best)) best = t;
  }
  return best === null ? null : new Date(best);
}

const dayLabel = (n) => (n === 1 ? '1 day' : `${n} days`);

// state: never | ok | soon | due
export function careStatus(task, events, now = new Date()) {
  const last = lastDone(events, task);
  if (!last) {
    return { task, state: 'never', last: null, text: 'Not recorded yet' };
  }
  const since = Math.max(0, melbourneDayNumber(now) - melbourneDayNumber(last));
  const left = task.everyDays - since;
  if (left > SOON_DAYS) return { task, state: 'ok', last, since, left, text: `Next in about ${dayLabel(left)}` };
  if (left > 0) return { task, state: 'soon', last, since, left, text: `Due in ${dayLabel(left)}` };
  if (left === 0) return { task, state: 'due', last, since, left, text: 'Due today' };
  return { task, state: 'due', last, since, left, text: `${dayLabel(-left)} overdue` };
}

export function careList(equipment, pool, events, now = new Date()) {
  return careTasksFor(equipment, pool).map((t) => careStatus(t, events, now));
}

// Health page: only jobs the owner has done before and are now due.
// A job never recorded is not nagged about on the home screen.
export function careDueNow(equipment, pool, events, now = new Date()) {
  return careList(equipment, pool, events, now).filter((s) => s.state === 'due');
}
