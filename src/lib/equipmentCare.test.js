import test from 'node:test';
import assert from 'node:assert/strict';
import {
  careDueNow, careEventFor, careList, careStatus, careTasksFor, filterMedia, isCareEvent, lastDone, CARE_TASKS,
} from './equipmentCare.js';

const NOW = new Date('2026-10-10T04:00:00Z'); // Sat 10 Oct, 3pm Melbourne
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const ev = (key, n) => ({ type: `care_${key}`, date: daysAgo(n) });

test('only equipment the owner has gets a job', () => {
  assert.deepEqual(careTasksFor([], {}), []);
  const keys = (eq, pool) => careTasksFor(eq, pool).map((t) => t.key);
  assert.deepEqual(keys([{ type: 'Pump' }], {}), ['pump_basket']);
  assert.deepEqual(keys([{ type: 'Pump' }, { type: 'Chlorinator' }], {}), ['pump_basket', 'salt_cell']);
  assert.deepEqual(keys([{ type: 'Salt Chlorinator' }], {}), ['salt_cell']); // old label
  assert.deepEqual(keys([{ type: 'Heater / Heat Pump' }, { type: 'Lighting' }], {}), []);
});

test('filter job follows the filter type', () => {
  assert.equal(filterMedia('Cartridge'), 'cartridge');
  assert.equal(filterMedia('Sand'), 'backwash');
  assert.equal(filterMedia('Diatomaceous earth (DE)'), 'backwash');
  assert.equal(filterMedia(undefined), 'backwash');
  assert.deepEqual(careTasksFor([{ type: 'Filter' }], { filter: 'Cartridge' }).map((t) => t.key), ['cartridge_clean']);
  assert.deepEqual(careTasksFor([{ type: 'Filter' }], { filter: 'Sand' }).map((t) => t.key), ['backwash']);
});

test('status: never, ok, soon, due today, overdue', () => {
  const pump = CARE_TASKS.find((t) => t.key === 'pump_basket'); // every 14 days
  assert.equal(careStatus(pump, [], NOW).state, 'never');
  assert.equal(careStatus(pump, [ev('pump_basket', 2)], NOW).text, 'Next in about 12 days');
  assert.equal(careStatus(pump, [ev('pump_basket', 12)], NOW).text, 'Due in 2 days');
  assert.equal(careStatus(pump, [ev('pump_basket', 12)], NOW).state, 'soon');
  assert.equal(careStatus(pump, [ev('pump_basket', 14)], NOW).text, 'Due today');
  assert.equal(careStatus(pump, [ev('pump_basket', 15)], NOW).text, '1 day overdue');
  assert.equal(careStatus(pump, [ev('pump_basket', 20)], NOW).text, '6 days overdue');
  assert.equal(careStatus(pump, [ev('pump_basket', 20)], NOW).state, 'due');
});

test('latest done wins; other jobs do not count', () => {
  const pump = CARE_TASKS.find((t) => t.key === 'pump_basket');
  const events = [ev('pump_basket', 30), ev('pump_basket', 3), ev('backwash', 1), { type: 'dose', date: daysAgo(0) }];
  assert.equal(lastDone(events, pump).toISOString(), daysAgo(3));
});

test('home screen lists only overdue jobs that were done before', () => {
  const equipment = [{ type: 'Pump' }, { type: 'Chlorinator' }, { type: 'Robotic Cleaner' }];
  const events = [ev('pump_basket', 20), ev('robot_filter', 3)]; // salt cell never recorded
  const due = careDueNow(equipment, {}, events, NOW);
  assert.deepEqual(due.map((s) => s.task.key), ['pump_basket']);
  assert.equal(careList(equipment, {}, events, NOW).length, 3);
});

test('event for a done job', () => {
  const task = CARE_TASKS[0];
  const e = careEventFor(task, NOW);
  assert.equal(e.type, 'care_pump_basket');
  assert.equal(e.title, 'Emptied the pump basket');
  assert.equal(e.date, NOW.toISOString());
  assert.equal(isCareEvent(e.type), true);
  assert.equal(isCareEvent('dose'), false);
});

test('house style: no dashes, plain words in every tip', () => {
  for (const t of CARE_TASKS) {
    for (const s of [t.label, t.doneTitle, t.every, t.tip]) {
      assert.ok(!/[–—]/.test(s), `${t.key} has a long dash`);
    }
    assert.ok(t.tip.length > 30 && t.everyDays > 0);
  }
});
