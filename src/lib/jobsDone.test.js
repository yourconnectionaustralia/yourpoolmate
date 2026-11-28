import test from 'node:test';
import assert from 'node:assert/strict';
import { JOB_NOTE_TYPE, jobEventFor, jobsFor, notesForTest, saltShopItem, saltStatus } from './jobsDone.js';
import { CARE_TASKS, careStatus } from './equipmentCare.js';
import { retestPrompt } from './doseLog.js';
import { eventLabel } from './recordExport.js';
import { buildPlan, planContext } from './plan.js';

const keys = (list) => list.map((j) => j.key);
const saltPool = { volumeL: 50000, sanitiser: 'Salt chlorinator', filter: 'Sand' };
const lowSalt = { id: 't1', freeChlor: 2, pH: 7.4, alkalinity: 100, salt: 2800, createdAt: '2026-11-28T01:00:00.000Z' };
const planFor = (test_, pool = saltPool) => buildPlan(test_, planContext({ pool }));

test('the tick boxes fit the pool', () => {
  assert.ok(keys(jobsFor(saltPool, [])).includes('chlorinator_up'));
  assert.ok(keys(jobsFor(saltPool, [])).includes('backwash'));
  assert.ok(!keys(jobsFor(saltPool, [])).includes('cartridge'));
  const liquid = { sanitiser: 'Chlorine (granular/liquid)', filter: 'Cartridge' };
  assert.ok(!keys(jobsFor(liquid, [])).includes('chlorinator_up'));
  assert.ok(keys(jobsFor(liquid, [])).includes('cartridge'));
  assert.ok(!keys(jobsFor(liquid, [])).includes('backwash'));
  assert.ok(keys(jobsFor(liquid, [{ type: 'Salt Chlorinator' }])).includes('chlorinator_up'));
});

test('a note keeps the ticked jobs, the words and the test it followed', () => {
  const e = jobEventFor({ jobKeys: ['backwash', 'scrub', 'chlorinator_up'], text: '  Water a bit green  ', testId: 't1' });
  assert.equal(e.type, JOB_NOTE_TYPE);
  assert.equal(e.title, 'Turned the chlorinator up · Scrubbed the walls · Backwashed the filter');
  assert.equal(e.notes, 'Water a bit green');
  assert.equal(e.testId, 't1');
  assert.equal(jobEventFor({ text: 'Rain all week' }).title, 'Pool note');
  assert.equal(jobEventFor({ jobKeys: ['not-a-job'], text: '   ' }), null);
  assert.equal(jobEventFor({ text: 'x'.repeat(900) }).notes.length, 500);
});

test('a backwash ticked in a note resets the backwash reminder, typed words do not', () => {
  const backwash = CARE_TASKS.find((t) => t.key === 'backwash');
  const now = new Date('2026-11-28T03:00:00.000Z');
  const ticked = jobEventFor({ jobKeys: ['backwash', 'scrub'], when: now });
  assert.equal(careStatus(backwash, [ticked], now).state, 'ok');
  const typed = jobEventFor({ text: 'Backwashed the filter', when: now });
  assert.equal(careStatus(backwash, [typed], now).state, 'never');
});

test('notes show with the test they followed', () => {
  const events = [
    { id: 'a', type: JOB_NOTE_TYPE, testId: 't1', date: '2026-11-28T02:00:00.000Z' },
    { id: 'b', type: JOB_NOTE_TYPE, testId: 'older', date: '2026-11-28T02:00:00.000Z' },
    { id: 'c', type: JOB_NOTE_TYPE, testId: null, date: '2026-11-28T03:00:00.000Z' },
    { id: 'd', type: JOB_NOTE_TYPE, testId: null, date: '2026-11-20T03:00:00.000Z' },
    { id: 'e', type: 'dose', testId: 't1', date: '2026-11-28T02:00:00.000Z' },
  ];
  assert.deepEqual(notesForTest(events, lowSalt).map((e) => e.id), ['c', 'a']);
  assert.deepEqual(notesForTest(events, null), []);
});

test('a note is not treated as a dose that needs a retest, and is named in the record', () => {
  const note = jobEventFor({ jobKeys: ['to_waste'], when: new Date('2026-11-28T02:00:00.000Z') });
  assert.equal(retestPrompt([note], lowSalt.createdAt, new Date('2026-11-28T04:00:00.000Z')), null);
  assert.equal(eventLabel(JOB_NOTE_TYPE), 'Jobs done');
});

test('low salt: the amount is the plan’s, and the list item carries the reading', () => {
  const plan = planFor(lowSalt);
  const status = saltStatus({ pool: saltPool, test: lowSalt, plan });
  assert.equal(status.state, 'low');
  const dose = plan.steps.find((s) => s.key === 'salt').options[0].grams;
  assert.equal(status.row.need, dose);
  assert.match(status.text, /2,800 ppm, which is low\. The plan needs about .*kg \(buy \d+ bags? if yours are 20 kg\)\. Add only what the plan says\./);
  const item = saltShopItem(status, lowSalt);
  assert.equal(item.productKey, 'salt');
  assert.equal(item.quantity, status.row.buy.quantity);
  assert.equal(item.source, 'skip');
  assert.equal(item.testId, 't1');
  assert.equal(item.stepKey, 'salt');
  assert.equal(item.stepTitle, 'Raise salt · test showed 2,800 ppm');
  assert.ok(item.stepTitle.length <= 80);
});

test('salt already in the shed comes off the amount', () => {
  const plan = planFor(lowSalt);
  const stock = [{ productKey: 'salt', packAmount: 20, packUnit: 'kg', packs: 10, remaining: 200000 }];
  assert.equal(saltStatus({ pool: saltPool, test: lowSalt, plan, stock }).state, 'covered');
});

test('salt that is not low, not tested, already listed or already added says so', () => {
  const fine = { ...lowSalt, salt: 4200 };
  const ok = saltStatus({ pool: saltPool, test: fine, plan: planFor(fine) });
  assert.equal(ok.state, 'ok');
  assert.deepEqual(saltShopItem(ok, fine), {
    product: 'pool salt', productKey: 'salt', form: 'mass', quantity: 0, quantityLabel: '', source: 'manual',
    stepTitle: 'Salt reminder · test showed 4,200 ppm',
  });
  const none = { ...lowSalt, salt: undefined };
  assert.equal(saltStatus({ pool: saltPool, test: none, plan: planFor(none) }).state, 'untested');
  const plan = planFor(lowSalt);
  for (const item of [{ productKey: 'salt', status: 'needed' }, { product: 'Pool salt 20 kg', status: 'needed' }]) {
    assert.equal(saltStatus({ pool: saltPool, test: lowSalt, plan, shopItems: [item] }).state, 'listed');
  }
  assert.equal(saltStatus({ pool: saltPool, test: lowSalt, plan, shopItems: [{ productKey: 'salt', status: 'bought' }] }).state, 'low');
  assert.equal(saltStatus({ pool: saltPool, test: lowSalt, plan, done: { salt: {} } }).state, 'added');
});

test('no pool volume: still a reminder, with no made-up amount', () => {
  const pool = { ...saltPool, volumeL: 0 };
  const status = saltStatus({ pool, test: lowSalt, plan: planFor(lowSalt, pool) });
  assert.equal(status.state, 'low');
  const item = saltShopItem(status, lowSalt);
  assert.equal(item.quantity, 0);
  assert.equal(item.quantityLabel, '');
});

test('a chlorine pool with no salt reading is not asked about salt', () => {
  const pool = { volumeL: 50000, sanitiser: 'Chlorine (granular/liquid)' };
  const t = { ...lowSalt, salt: undefined };
  assert.equal(saltStatus({ pool, test: t, plan: planFor(t, pool) }), null);
});
