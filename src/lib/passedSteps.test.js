import assert from 'node:assert/strict';
import test from 'node:test';
import { nextOpenStep, passedFor, readPassed, setPassed, writePassed } from './passedSteps.js';

function memory(start = {}) {
  const m = { ...start };
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } };
}

const plan = { steps: [{ key: 'alkalinity' }, { key: 'pH' }, { key: 'freeChlor' }] };

test('the next step passes over what is done, on the shopping list or skipped', () => {
  assert.equal(nextOpenStep(plan)?.key, 'alkalinity');
  assert.equal(nextOpenStep(plan, { alkalinity: {} })?.key, 'pH');
  assert.equal(nextOpenStep(plan, {}, { alkalinity: {} })?.key, 'pH');
  assert.equal(nextOpenStep(plan, {}, {}, { alkalinity: true })?.key, 'pH');
  assert.equal(nextOpenStep(plan, { alkalinity: {} }, {}, { pH: true })?.key, 'freeChlor');
  assert.equal(nextOpenStep(plan, { alkalinity: {} }, { pH: {} }, { freeChlor: true }), null);
  assert.equal(nextOpenStep(null), null);
});

test('skipping a step and putting it back', () => {
  let map = setPassed({}, 't1', 'pH', true);
  assert.deepEqual(passedFor(map, 't1'), { pH: true });
  map = setPassed(map, 't1', 'alkalinity', true);
  assert.deepEqual(passedFor(map, 't1'), { pH: true, alkalinity: true });
  map = setPassed(map, 't1', 'pH', false);
  assert.deepEqual(passedFor(map, 't1'), { alkalinity: true });
  map = setPassed(map, 't1', 'alkalinity', false);
  assert.deepEqual(passedFor(map, 't1'), {});
  assert.equal('t1' in map, false); // nothing left to remember
});

test('a skip belongs to one test; a new test starts with nothing skipped', () => {
  const map = setPassed({}, 'old-test', 'pH', true);
  assert.deepEqual(passedFor(map, 'new-test'), {});
  assert.deepEqual(passedFor(map, null), {});
});

test('only the newest tests are kept', () => {
  let map = {};
  for (let i = 0; i < 30; i += 1) map = setPassed(map, `t${i}`, 'pH', true);
  assert.equal(Object.keys(map).length, 20);
  assert.equal('t0' in map, false);
  assert.equal('t29' in map, true);
});

test('survives storage that is empty, broken or blocked', () => {
  assert.deepEqual(readPassed(memory()), {});
  assert.deepEqual(readPassed(memory({ 'ypm.stepsPassed.v1': 'not json' })), {});
  assert.deepEqual(readPassed(memory({ 'ypm.stepsPassed.v1': '[1,2]' })), {});
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readPassed(blocked), {});
  assert.doesNotThrow(() => writePassed(blocked, { t: ['pH'] }));
  const store = memory();
  writePassed(store, { t1: ['pH'] });
  assert.deepEqual(readPassed(store), { t1: ['pH'] });
});
