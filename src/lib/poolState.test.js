import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COVER_STATES, WATER_LEVELS, conditionSummary, conditionWatchouts, normaliseCover, normaliseWaterLevel } from './poolState.js';
import { buildPlan, planContext } from './plan.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('only a known water level or cover answer is kept', () => {
  assert.equal(normaliseWaterLevel('high'), 'high');
  assert.equal(normaliseWaterLevel('flooded'), null);
  assert.equal(normaliseCover('none'), 'none');
  assert.equal(normaliseCover(true), null);
});

test('the summary says what was answered, and nothing for an older test', () => {
  assert.equal(conditionSummary({ waterLevel: 'high', coverState: 'on' }), 'Water level high · Cover on');
  assert.equal(conditionSummary({ coverState: 'none' }), 'No cover');
  assert.equal(conditionSummary({}), '');
});

test('high, low and covered each add a tip, and the cover tip needs something to add', () => {
  assert.match(conditionWatchouts({ waterLevel: 'high' }, true)[0], /before you add salt/);
  assert.doesNotMatch(conditionWatchouts({ waterLevel: 'high' }, false)[0], /before you add/);
  assert.match(conditionWatchouts({ waterLevel: 'low' }, false)[0], /Top it up/);
  assert.equal(conditionWatchouts({ coverState: 'on' }, true).length, 1);
  assert.equal(conditionWatchouts({ coverState: 'on' }, false).length, 0);
  assert.deepEqual(conditionWatchouts({ waterLevel: 'normal', coverState: 'off' }, true), []);
});

test('the answers change the tips, never the score or the doses', () => {
  const ctx = planContext({ pool: { volumeL: 50000, sanitiser: 'Salt chlorinator' } });
  const base = { freeChlor: 0.5, pH: 7.9, alkalinity: 100, salt: 2800, createdAt: new Date().toISOString() };
  const plain = buildPlan(base, ctx);
  const asked = buildPlan({ ...base, waterLevel: 'high', coverState: 'on' }, ctx);
  assert.equal(asked.score, plain.score);
  assert.deepEqual(asked.steps, plain.steps);
  assert.deepEqual(plain.beforeYouAdd, []);
  assert.equal(asked.beforeYouAdd.length, 2);
});

test('every way of logging a new test asks both questions and waits for the answers', () => {
  for (const file of ['../app/pages/WaterTestsPage.jsx', '../components/WaterTestScanner.jsx', '../components/VoiceTestEntry.jsx']) {
    const src = read(file);
    assert.match(src, /<PoolStateQuestions /, file);
    assert.match(src, /!waterLevel \|\| !coverState/, file);
    assert.match(src, /\n {6}waterLevel,\n {6}coverState,\n/, file);
  }
});

test('migration 028 allows exactly the answers the app offers', () => {
  const sql = read('../../supabase/migrations/028_water_tests_water_level_cover.sql');
  const allowed = (col) => sql.match(new RegExp(`${col} = any \\(array\\[([^\\]]+)\\]`))[1].match(/'[a-z]+'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(allowed('water_level'), WATER_LEVELS.map((o) => o.value));
  assert.deepEqual(allowed('cover_state'), COVER_STATES.map((o) => o.value));
});
