import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NAV, cleanNav, navOption, sameNav, setSlot } from './navSlots.js';

test('defaults to Home, Plan, History', () => {
  assert.deepEqual(cleanNav(undefined), DEFAULT_NAV);
  assert.deepEqual(cleanNav('junk'), DEFAULT_NAV);
});

test('keeps a valid choice, and fills gaps and repeats from the defaults', () => {
  assert.deepEqual(cleanNav(['health', 'shed', 'plan']), ['health', 'shed', 'plan']);
  assert.deepEqual(cleanNav(['shed', 'shed', 'nope']), ['shed', 'health', 'plan']);
  assert.deepEqual(cleanNav(['plan', 'health', 'history', 'shed']), ['plan', 'health', 'history']);
  assert.deepEqual(cleanNav(['tests']), DEFAULT_NAV); // Test is fixed in the middle, never a slot
});

test('setting a slot swaps rather than duplicating', () => {
  assert.deepEqual(setSlot(DEFAULT_NAV, 2, 'shed'), ['health', 'plan', 'shed']);
  assert.deepEqual(setSlot(DEFAULT_NAV, 0, 'plan'), ['plan', 'health', 'history']);
  assert.deepEqual(setSlot(DEFAULT_NAV, 1, 'plan'), DEFAULT_NAV);
  assert.deepEqual(setSlot(DEFAULT_NAV, 5, 'shed'), DEFAULT_NAV);
  assert.deepEqual(setSlot(DEFAULT_NAV, 0, 'tests'), DEFAULT_NAV);
});

test('helpers', () => {
  assert.equal(navOption('chat').label, 'Ask Mate');
  assert.equal(navOption('nope'), null);
  assert.equal(sameNav(['a', 'b'], ['a', 'b']), true);
  assert.equal(sameNav(['a', 'b'], ['b', 'a']), false);
});
