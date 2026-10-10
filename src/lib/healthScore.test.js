import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  calciumBand,
  calculateScore,
  includeCalciumInActions,
  isVinylLiner,
} from './healthScore.js';

const BALANCED = {
  freeChlor: 2,
  pH: 7.4,
  alkalinity: 100,
  cyanuricAcid: 40,
  calciumHardness: 300,
};

test('vinyl is the only soft surface in Setup', () => {
  assert.equal(isVinylLiner('Vinyl liner'), true);
  assert.equal(isVinylLiner('vinyl liner'), true);
  assert.equal(isVinylLiner('Fibreglass'), false);
  assert.equal(isVinylLiner('Pebble / pebblecrete'), false);
  assert.equal(isVinylLiner('Concrete / rendered'), false);
  assert.equal(isVinylLiner('Fully tiled'), false);
  assert.equal(isVinylLiner('Painted concrete'), false);
  assert.equal(isVinylLiner('Other'), false);
  assert.equal(isVinylLiner(''), false);
  assert.equal(isVinylLiner(null), false);
});

test('vinyl widens the low side and keeps the high cap', () => {
  assert.deepEqual(calciumBand('Vinyl liner'), { lo: 0, hi: 400, target: 'up to 400' });
  assert.deepEqual(calciumBand('Pebble / pebblecrete'), { lo: 200, hi: 400, target: '200–400' });
  assert.deepEqual(calciumBand('Fibreglass'), calciumBand('Concrete / rendered'));
});

test('low calcium does not tank a vinyl score and does not raise an action', () => {
  const low = { ...BALANCED, calciumHardness: 80 };
  assert.equal(calculateScore(low, 'Chlorine (granular/liquid)', null, 'Vinyl liner'), 100);
  assert.equal(calculateScore(low, 'Chlorine (granular/liquid)', null, 'Pebble / pebblecrete') < 100, true);
  assert.equal(calculateScore(low, 'Chlorine (granular/liquid)', null, 'Fibreglass'),
    calculateScore(low, 'Chlorine (granular/liquid)', null, 'Concrete / rendered'));
  assert.equal(includeCalciumInActions('low', 'Vinyl liner'), false);
  assert.equal(includeCalciumInActions('low', 'Pebble / pebblecrete'), true);
  assert.equal(includeCalciumInActions('low', 'Fibreglass'), true);
  assert.equal(includeCalciumInActions('ok', 'Vinyl liner'), false);
});

test('high calcium still scores and still actions on vinyl', () => {
  const high = { ...BALANCED, calciumHardness: 520 };
  const vinyl = calculateScore(high, 'Saltwater chlorinator', null, 'Vinyl liner');
  const pebble = calculateScore(high, 'Saltwater chlorinator', null, 'Pebble / pebblecrete');
  assert.equal(vinyl, pebble);
  assert.equal(vinyl < 100, true);
  assert.equal(includeCalciumInActions('high', 'Vinyl liner'), true);
  assert.equal(includeCalciumInActions('high', 'Fully tiled'), true);
});

test('in-range calcium matches across surfaces', () => {
  assert.equal(
    calculateScore(BALANCED, 'Chlorine (granular/liquid)', null, 'Vinyl liner'),
    calculateScore(BALANCED, 'Chlorine (granular/liquid)', null, 'Pebble / pebblecrete'),
  );
});

test('live app greets only on the Health Score header and softens vinyl calcium', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const chart = readFileSync(new URL('../components/WaterTrendChart.jsx', import.meta.url), 'utf8');

  const headers = app.match(/<p className="page-title">\{greeting\}<\/p>\s*<h1 className="page-title">Health Score<\/h1>/g);
  assert.equal(headers?.length, 2);
  assert.match(app, /function formatRelative[\s\S]*?function melbourneGreeting/);
  assert.match(app, /<h1 className="page-title">Water Tests<\/h1>/);
  assert.match(app, /<h1 className="page-title">Chemistry log<\/h1>/);
  assert.match(app, /<h1 className="page-title">Pool setup<\/h1>/);
  assert.match(app, /<h1 className="page-title">Profile<\/h1>/);
  assert.match(app, /<HealthScorePage[\s\S]*?user=\{user\}/);
  assert.match(app, /test\?\.healthScore \?\? calculateScore\(test, sanitiser, saltRange, surface\)/);
  assert.doesNotMatch(app, /isVinylLiner\(surface\)\) return calculateScore/);
  assert.match(app, /includeCalciumInActions\(statuses\[key\], pool\?\.surface\)/);
  assert.match(app, /calculateScore\(data, pool\?\.sanitiser, saltRange, pool\?\.surface\)/);
  assert.match(app, /Enter Test Results/);
  assert.match(app, /Scan test results/);
  assert.match(app, /Speak results/);
  assert.match(chart, /idealLabel: calciumBand\.target/);
});

test('calcium alone: vinyl low is full marks, hard surface is not', () => {
  const only = { calciumHardness: 50 };
  assert.equal(calculateScore(only, null, null, 'Vinyl liner'), 100);
  assert.equal(calculateScore(only, null, null, 'Pebble / pebblecrete'), 0);
});
