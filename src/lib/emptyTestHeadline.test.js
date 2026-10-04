import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { emptyTestHeadline, EMPTY_TEST_HEADLINE } from './emptyTestHeadline.js';
import { calculateScore, hasScorableReadings } from './healthScore.js';

const BLANK = {
  freeChlor: null,
  pH: null,
  alkalinity: null,
  cyanuricAcid: null,
  calciumHardness: null,
  healthScore: 0,
};

const MEASURED_ZERO_CHLORINE = {
  freeChlor: 0,
  pH: null,
  alkalinity: null,
  cyanuricAcid: null,
  calciumHardness: null,
};

test('a blank test scores 0 and asks for a water test', () => {
  assert.equal(hasScorableReadings(BLANK, 'Chlorine (granular/liquid)'), false);
  assert.equal(hasScorableReadings(BLANK, 'Saltwater chlorinator'), false);
  assert.equal(calculateScore(BLANK, 'Chlorine (granular/liquid)'), 0);
  assert.equal(emptyTestHeadline(BLANK, 'Chlorine (granular/liquid)'), EMPTY_TEST_HEADLINE);
  assert.match(EMPTY_TEST_HEADLINE, /Do a water test/);
  assert.equal(EMPTY_TEST_HEADLINE.includes('\u2014'), false);
  assert.equal(/\blog\b/i.test(EMPTY_TEST_HEADLINE), false);
  assert.equal(/urgent|hold off swimming/i.test(EMPTY_TEST_HEADLINE), false);
});

test('blank strings and out-of-bounds values are not a usable test', () => {
  const blankStrings = { freeChlor: '', pH: undefined, alkalinity: null, cyanuricAcid: '  ', calciumHardness: '' };
  assert.equal(hasScorableReadings(blankStrings, null), false);
  assert.equal(emptyTestHeadline(blankStrings, null), EMPTY_TEST_HEADLINE);
  assert.equal(hasScorableReadings({ freeChlor: 99 }, 'Chlorine (granular/liquid)'), false);
  assert.equal(hasScorableReadings(null, null), false);
  assert.equal(emptyTestHeadline(null, null), EMPTY_TEST_HEADLINE);
});

test('salt alone counts only on a saltwater or mineral pool', () => {
  const saltOnly = { salt: 4000 };
  assert.equal(hasScorableReadings(saltOnly, 'Chlorine (granular/liquid)'), false);
  assert.equal(emptyTestHeadline(saltOnly, 'Chlorine (granular/liquid)'), EMPTY_TEST_HEADLINE);
  assert.equal(hasScorableReadings(saltOnly, 'Saltwater chlorinator'), true);
  assert.equal(emptyTestHeadline(saltOnly, 'Mineral / magnesium'), null);
});

test('a measured zero still uses the scored warning, not the empty-test line', () => {
  assert.equal(hasScorableReadings(MEASURED_ZERO_CHLORINE, 'Chlorine (granular/liquid)'), true);
  assert.equal(calculateScore(MEASURED_ZERO_CHLORINE, 'Chlorine (granular/liquid)'), 0);
  assert.equal(emptyTestHeadline(MEASURED_ZERO_CHLORINE, 'Chlorine (granular/liquid)'), null);

  const bad = {
    freeChlor: 0,
    pH: 6.2,
    alkalinity: 40,
    cyanuricAcid: 5,
    calciumHardness: 80,
  };
  assert.equal(calculateScore(bad, 'Chlorine (granular/liquid)') < 50, true);
  assert.equal(emptyTestHeadline(bad, 'Saltwater chlorinator'), null);
});

test('the home screen asks for a test only when nothing is scorable', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /const emptyHeadline = emptyTestHeadline\(testData, poolProfile\?\.sanitiser\)/);
  assert.match(app, /const headline = emptyHeadline \?\? scoreHeadline\(score, params\)/);
  assert.match(app, /const showQuietLine = !emptyHeadline && waterLooksGood\(score, Boolean\(primaryAction\)\)/);
  assert.match(app, /\{!showQuietLine && !emptyHeadline && recommendations\.length > 0 && \(/);
  assert.match(app, /return 'Chemistry needs urgent correction — hold off swimming for now\.'/);
});
