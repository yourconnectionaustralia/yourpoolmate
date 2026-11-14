import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POOL_LOOKS,
  isMurkyLook,
  lookLabel,
  lookView,
  murkySwimCall,
  normaliseLook,
  scoreCapFor,
} from './poolLook.js';

test('five answers, each with a label and a hint', () => {
  assert.deepEqual(POOL_LOOKS.map((l) => l.value), ['clear', 'cloudy', 'green', 'other', 'unsure']);
  for (const l of POOL_LOOKS) {
    assert.ok(l.label.length > 0);
    assert.ok(l.hint.length > 0);
  }
});

test('only a known answer is kept', () => {
  assert.equal(normaliseLook('green'), 'green');
  assert.equal(normaliseLook('Green'), null);
  assert.equal(normaliseLook(''), null);
  assert.equal(normaliseLook(undefined), null);
  assert.equal(normaliseLook('murky'), null);
});

test('only green and cloudy count as murky', () => {
  assert.equal(isMurkyLook('green'), true);
  assert.equal(isMurkyLook('cloudy'), true);
  for (const v of ['clear', 'other', 'unsure', '', null, undefined]) assert.equal(isMurkyLook(v), false);
});

test('labels come from the options', () => {
  assert.equal(lookLabel('cloudy'), 'Cloudy or hazy');
  assert.equal(lookLabel('nope'), null);
});

test('clear, not sure and never asked add nothing', () => {
  for (const v of ['clear', 'unsure', null, undefined, 'bogus']) assert.equal(lookView(v, true), null);
});

test('green water says the readings cannot see it', () => {
  const inRange = lookView('green', true);
  assert.equal(inRange.key, 'green');
  assert.equal(inRange.tone, 'alert');
  assert.match(inRange.body, /readings are in range/i);
  assert.match(inRange.body, /pump and filter/);
  const off = lookView('green', false);
  assert.doesNotMatch(off.body, /readings are in range/i);
  assert.match(off.body, /algae/);
});

test('cloudy water points at the filter and pump', () => {
  assert.match(lookView('cloudy', true).body, /filter/);
  assert.equal(lookView('cloudy', false).tone, 'alert');
});

test('something else wrong is an action, not an alert', () => {
  const v = lookView('other', true);
  assert.equal(v.tone, 'action');
  assert.match(v.body, /foam/i);
});

test('murky water is a no-swim call, and clear water is not', () => {
  const green = murkySwimCall('green');
  assert.equal(green.tone, 'wait');
  assert.match(green.title, /green/);
  assert.match(green.detail, /bottom of the deep end/);
  assert.match(murkySwimCall('cloudy').title, /cloudy/);
  for (const v of ['clear', 'other', 'unsure', null, undefined]) assert.equal(murkySwimCall(v), null);
});

test('green holds the score in the act-now band and cloudy keeps it out of green', () => {
  assert.equal(scoreCapFor('green'), 55);
  assert.equal(scoreCapFor('cloudy'), 69);
  assert.ok(scoreCapFor('green') < 60, 'green is red');
  assert.ok(scoreCapFor('cloudy') >= 60 && scoreCapFor('cloudy') < 80, 'cloudy is amber');
  for (const v of ['clear', 'other', 'unsure', '', null, undefined, 'bogus']) assert.equal(scoreCapFor(v), null);
});

test('only green and cloudy explain the held-down score', () => {
  assert.match(lookView('green', true).scoreNote, /held down while the water is green/);
  assert.match(lookView('cloudy', false).scoreNote, /held down while the water is cloudy/);
  assert.equal(lookView('other', true).scoreNote, undefined);
});
