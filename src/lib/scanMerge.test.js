import assert from 'node:assert/strict';
import test from 'node:test';
import { blankValues, conflictMessage, hasReadings, mergeScans } from './scanMerge.js';

const page1 = { readings: { free_chlorine: 1.2, ph: 7.4 }, confidence: 'high', notes: null };
const page2 = { readings: { alkalinity: 95, cyanuric_acid: 40 }, confidence: 'medium', notes: 'page 2' };

test('a second page fills the gaps and the lowest confidence wins', () => {
  const m = mergeScans({}, [page1, page2]);
  assert.equal(m.values.freeChlor, '1.2');
  assert.equal(m.values.alkalinity, '95');
  assert.equal(m.values.salt, '');
  assert.equal(m.confidence, 'medium');
  assert.equal(m.notes, 'page 2');
  assert.deepEqual(m.conflicts, []);
});

test('a later photo never overwrites a reading already on screen, and says so', () => {
  const first = mergeScans({}, [page1]);
  // The owner has edited pH on screen to 7.5 before adding another photo.
  const m = mergeScans({ ...first.values, pH: '7.5' }, [{ readings: { ph: 7.9, alkalinity: 95 }, confidence: 'high' }], first.confidence, first.notes);
  assert.equal(m.values.pH, '7.5');
  assert.equal(m.values.alkalinity, '95');
  assert.equal(m.conflicts.length, 1);
  assert.match(conflictMessage(m.conflicts), /pH \(7\.5 kept, another photo says 7\.9\)/);
});

test('the same number on two photos is not a conflict', () => {
  const m = mergeScans({}, [page1, { readings: { ph: '7.40' }, confidence: 'high' }]);
  assert.deepEqual(m.conflicts, []);
});

test('blank and null readings do not count as readings', () => {
  assert.equal(hasReadings({ free_chlorine: null, ph: '' }), false);
  assert.equal(hasReadings({ ph: 0 }), true);
  assert.equal(hasReadings(undefined), false);
  assert.equal(Object.keys(blankValues()).length, 7);
});
