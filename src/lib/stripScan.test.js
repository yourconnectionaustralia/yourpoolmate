import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { STRIP_CAVEAT, STRIP_NOT_READY, STRIP_TIPS, isStripReply, padTag, stripConfidenceTag, stripDateText, stripFailure, stripReview } from './stripScan.js';

const reply = {
  kind: 'strip',
  strip_found: true,
  chart_in_photo: true,
  lighting: 'good',
  readings: { free_chlorine: 3, total_chlorine: 3, ph: 7.6, alkalinity: 100, cyanuric_acid: null, calcium: 150 },
  pad_confidence: { free_chlorine: 'high', total_chlorine: 'medium', ph: 'high', alkalinity: 'low', calcium: 'high' },
  confidence: 'low',
  notes: 'The alkalinity pad sits between two blocks.',
};

test('a strip reply is told apart from an older function that read it as a printout', () => {
  assert.equal(isStripReply(reply), true);
  assert.equal(isStripReply({ readings: { ph: 7.2 }, confidence: 'high' }), false);
  assert.equal(isStripReply(null), false);
});

test('review values are app-keyed strings, and pads that were not read are left out', () => {
  const r = stripReview(reply);
  assert.deepEqual(r.values, { freeChlor: '3', totalChlor: '3', pH: '7.6', alkalinity: '100', calciumHardness: '150' });
  assert.equal('cyanuricAcid' in r.values, false);
  assert.equal(r.readCount, 5);
});

test('a reading of zero is kept, not treated as missing', () => {
  const r = stripReview({ ...reply, readings: { free_chlorine: 0, ph: 7.2 }, pad_confidence: { free_chlorine: 'medium', ph: 'medium' } });
  assert.equal(r.values.freeChlor, '0');
  assert.equal(r.readCount, 2);
});

test('only pads the server was not sure about get a check tag', () => {
  const r = stripReview(reply);
  assert.equal(r.padTags.freeChlor, undefined);
  assert.equal(r.padTags.pH, undefined);
  assert.equal(r.padTags.totalChlor.text, 'Check against your chart');
  assert.equal(r.padTags.alkalinity.text, 'Best guess, please check');
});

test('a pad with no confidence from the server is tagged as a best guess', () => {
  assert.equal(padTag(undefined).text, 'Best guess, please check');
  assert.equal(padTag('nonsense').text, 'Best guess, please check');
  assert.equal(padTag('high'), null);
});

test('overall confidence is passed on as the server gave it, never raised', () => {
  assert.equal(stripReview(reply).confidence, 'low');
  assert.equal(stripReview({ ...reply, confidence: 'high' }).confidence, 'high');
  assert.equal(stripReview({ ...reply, confidence: undefined }).confidence, 'low');
  assert.equal(stripReview({ ...reply, confidence: 'very high' }).confidence, 'low');
});

test('even the best strip result is called a clear match, never a sure thing', () => {
  assert.equal(stripConfidenceTag('high').text, 'Clear match');
  assert.match(stripConfidenceTag('medium').text, /please check/);
  assert.match(stripConfidenceTag('low').text, /check every value/);
  assert.equal(stripConfidenceTag('high').cls, 'tag-good');
  assert.equal(stripConfidenceTag('low').cls, 'tag-warn');
});

test('notes are trimmed, and blank notes become null', () => {
  assert.equal(stripReview({ ...reply, notes: '  Warm light.  ' }).notes, 'Warm light.');
  assert.equal(stripReview({ ...reply, notes: '   ' }).notes, null);
  assert.equal(stripReview({ ...reply, notes: undefined }).notes, null);
});

test('garbage in gives an empty review, not a crash', () => {
  for (const bad of [null, undefined, {}, 'x', 5]) {
    const r = stripReview(bad);
    assert.deepEqual(r.values, {});
    assert.equal(r.readCount, 0);
    assert.equal(r.confidence, 'low');
  }
});

test('failure messages tell the owner what to do next', () => {
  assert.match(stripFailure({ strip_found: false }), /dipped test strip/);
  assert.match(stripFailure({ strip_found: false }), /wait the time your pack says/);
  const noMatch = stripFailure({ strip_found: true, notes: 'The light was poor, so colours may be well off.' });
  assert.match(noMatch, /The light was poor/);
  assert.match(noMatch, /chart from your bottle/);
  assert.doesNotMatch(stripFailure({ strip_found: true }), /undefined|null/);
});

test('the caveat is plain and says a photo can be a step out', () => {
  assert.match(STRIP_CAVEAT, /different light/);
  assert.match(STRIP_CAVEAT, /out by a step/);
  assert.match(STRIP_CAVEAT, /check each one against the chart on your pack/);
});

test('the tips cover timing, light and the chart', () => {
  assert.equal(STRIP_TIPS.length, 3);
  assert.match(STRIP_TIPS[0], /time it tells you/);
  assert.match(STRIP_TIPS[1], /white/);
  assert.match(STRIP_TIPS[1], /shaded daylight/);
  assert.match(STRIP_TIPS[2], /same photo/);
});

test('new copy uses no em or en dashes, which the app avoids in plain copy', () => {
  const all = [STRIP_CAVEAT, STRIP_NOT_READY, stripDateText(), stripFailure({ strip_found: false }), stripFailure({ strip_found: true }),
    ...STRIP_TIPS, ...['high', 'medium', 'low'].map((l) => stripConfidenceTag(l).text), padTag('medium').text, padTag('low').text];
  for (const s of all) assert.doesNotMatch(s, /[–—]/, s);
});

// The strip reader is wired into the app next to the printout scanner. These
// strings are what the other tests look for, so the new button must not remove them.
test('the app still offers the printout scanner and voice entry beside the strip reader', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /Scan test results/);
  assert.match(app, /Speak results/);
  assert.match(app, /Read my test strip/);
  assert.match(app, /onScanStrip/);
});
