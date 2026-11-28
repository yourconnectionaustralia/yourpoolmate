// File: src/lib/jobsDone.js
//
// "What I did": the jobs an owner does after a water test (turned the
// chlorinator up, scrubbed the walls, backwashed), and the reminder to buy pool
// salt, worked out from the salt reading on that test.
//
// A note is saved as a pool event (type 'job_note'), so it sits in the Chemistry
// log and the water record beside the tests. The ticked jobs are the title and
// anything typed is the notes. The salt reminder is an ordinary shopping list
// item, so no new table is needed for either.

import { CARE_TASKS, JOB_NOTE_TYPE, JOB_SEPARATOR, filterMedia } from './equipmentCare.js';
import { isSaltPool } from './healthScore.js';
import { matchProduct, planShortfall } from './shed.js';

export { JOB_NOTE_TYPE };
export const JOB_TEXT_MAX = 500;
const SALT_BAG_GRAMS = 20000;

// Jobs that are also equipment care jobs use the care job's wording, which is
// how ticking one here resets its reminder (see lastDone in equipmentCare.js).
const care = (key) => CARE_TASKS.find((t) => t.key === key).doneTitle;

export const JOBS = [
  { key: 'chlorinator_up', label: 'Turned the chlorinator up', chlorinator: true },
  { key: 'chlorinator_down', label: 'Turned the chlorinator down', chlorinator: true },
  { key: 'cleaner', label: 'Ran the pool cleaner' },
  { key: 'debris', label: 'Cleared out leaves and debris' },
  { key: 'scrub', label: 'Scrubbed the walls' },
  { key: 'to_waste', label: 'Lowered the water (pumped to waste)' },
  { key: 'top_up', label: 'Topped up the water' },
  { key: 'backwash', label: care('backwash'), media: 'backwash' },
  { key: 'cartridge', label: care('cartridge_clean'), media: 'cartridge' },
  { key: 'pump_basket', label: care('pump_basket') },
  { key: 'skimmer_basket', label: 'Emptied the skimmer basket' },
];

const hasChlorinator = (pool, equipment) => isSaltPool(pool?.sanitiser)
  || (equipment || []).some((e) => e.type === 'Chlorinator' || e.type === 'Salt Chlorinator');

// The tick boxes that make sense for this pool.
export function jobsFor(pool, equipment) {
  const media = filterMedia(pool?.filter);
  const chlorinator = hasChlorinator(pool, equipment);
  return JOBS.filter((j) => (!j.chlorinator || chlorinator) && (!j.media || j.media === media));
}

// The pool event for a note, or null when there is nothing to record.
export function jobEventFor({ jobKeys = [], text = '', testId = null, when = new Date() }) {
  const done = JOBS.filter((j) => jobKeys.includes(j.key)).map((j) => j.label);
  const note = String(text).trim().slice(0, JOB_TEXT_MAX);
  if (!done.length && !note) return null;
  return {
    type: JOB_NOTE_TYPE,
    title: done.length ? done.join(JOB_SEPARATOR) : 'Pool note',
    notes: note,
    testId,
    date: when.toISOString(),
  };
}

// Notes that belong to this test, newest first. A note with no test id (an
// older database, or saved a moment before the test had its id) belongs to the
// test when it was written after it.
export function notesForTest(events, test) {
  if (!test) return [];
  const since = new Date(test.createdAt).getTime();
  return (events || [])
    .filter((e) => e.type === JOB_NOTE_TYPE)
    .filter((e) => (e.testId ? e.testId === test.id : new Date(e.date).getTime() >= since))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

const isSaltItem = (i) => i.productKey === 'salt' || (!i.productKey && matchProduct(i.product)?.key === 'salt');
const ppmText = (n) => `${Math.round(n).toLocaleString('en-AU')} ppm`;
const bags = (grams) => {
  const n = Math.max(1, Math.ceil(grams / SALT_BAG_GRAMS - 1e-9));
  return `buy ${n} bag${n === 1 ? '' : 's'} if yours are 20 kg`;
};

// Where pool salt stands for the latest test. Null when salt does not matter to
// this pool. The amount is the plan's own, less what My Shed already holds.
//   state: listed | low | covered | added | ok | untested
export function saltStatus({ pool, test, plan, stock = [], done = {}, shopItems = [] }) {
  const ppm = Number.isFinite(test?.salt) ? test.salt : null;
  if (!isSaltPool(pool?.sanitiser) && ppm === null) return null;

  const listed = shopItems.find((i) => i.status !== 'bought' && isSaltItem(i));
  if (listed) return { state: 'listed', ppm, text: 'Pool salt is on your shopping list.' };

  if (ppm === null) return { state: 'untested', ppm, text: 'Your last test had no salt reading.' };
  const measured = `Your last test showed salt at ${ppmText(ppm)}`;

  const step = plan?.steps?.find((s) => s.key === 'salt' && s.state === 'low');
  if (!step) return { state: 'ok', ppm, text: `${measured}, which is not low.` };
  if (done.salt) return { state: 'added', ppm, text: `${measured}, and you have marked salt as added.` };

  const row = planShortfall({ plan: { steps: [step] }, stock })[0] ?? null;
  if (row?.covered) {
    return { state: 'covered', ppm, text: `${measured}, which is low. My Shed shows you have enough for today's plan.` };
  }
  if (!row) {
    return { state: 'low', ppm, row, text: `${measured}, which is low. Add your pool volume in Pool setup to get an amount.` };
  }
  const bagText = row.buy.packs ? '' : ` (${bags(row.buy.quantity)})`;
  // Whole bags can be more than the plan calls for, so say which is the dose.
  const dose = row.buy.packs ? `You need to buy ${row.buy.label}.` : `The plan needs about ${row.buy.label}${bagText}. Add only what the plan says.`;
  return { state: 'low', ppm, row, text: `${measured}, which is low. ${dose}` };
}

// The shopping list item for "Remind me to buy pool salt". When the test showed
// salt short, the item carries the amount and the reading, and the plan's salt
// step shows as waiting on the shop.
export function saltShopItem(status, test) {
  const base = { product: 'pool salt', productKey: 'salt', form: 'mass', quantity: 0, quantityLabel: '', source: 'manual' };
  const reading = status?.ppm == null ? '' : `test showed ${ppmText(status.ppm)}`;
  if (status?.state !== 'low') {
    return reading ? { ...base, stepTitle: `Salt reminder · ${reading}` } : base;
  }
  return {
    ...base,
    quantity: status.row?.buy.quantity ?? 0,
    quantityLabel: status.row?.buy.label ?? '',
    source: test?.id ? 'skip' : 'manual',
    testId: test?.id ?? null,
    stepKey: 'salt',
    stepTitle: `Raise salt · ${reading}`,
  };
}
