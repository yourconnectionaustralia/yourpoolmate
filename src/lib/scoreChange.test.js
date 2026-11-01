import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreChange } from './scoreChange.js';

const t = (healthScore) => ({ healthScore });

test('needs two scored tests', () => {
  assert.equal(scoreChange([]), null);
  assert.equal(scoreChange(undefined), null);
  assert.equal(scoreChange([t(70)]), null);
});

test('says up, down or the same against the test before', () => {
  assert.deepEqual(scoreChange([t(60), t(74)]), { delta: 14, tone: 'up', text: 'Up 14 since your last test' });
  assert.deepEqual(scoreChange([t(80), t(71)]), { delta: -9, tone: 'down', text: 'Down 9 since your last test' });
  assert.equal(scoreChange([t(80), t(80)]).tone, 'same');
});

test('skips an older test with no score, but not a newest one with none', () => {
  assert.equal(scoreChange([t(50), t(null), t(65)]).delta, 15);
  assert.equal(scoreChange([t(50), t(65), t(null)]), null);
});
