import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  daysUntilNextTest,
  goodWaterLine,
  waterLooksGood,
} from './goodWaterLine.js';

// 3 Oct 2026 is still AEST. Clocks go forward at 2am on 4 Oct 2026.
const YESTERDAY = new Date('2026-10-02T02:00:00Z'); // 2 Oct, 12:00 AEST
const NOW = new Date('2026-10-03T02:00:00Z');       // 3 Oct, 12:00 AEST

test('water looks good only at the green-ring cut, with nothing to add', () => {
  assert.equal(waterLooksGood(80, false), true);
  assert.equal(waterLooksGood(100, false), true);
  assert.equal(waterLooksGood(79, false), false);
  assert.equal(waterLooksGood(80, true), false);
  assert.equal(waterLooksGood(0, false), false);
  assert.equal(waterLooksGood(null, false), false);
  assert.equal(waterLooksGood(undefined, false), false);
});

test('a test logged yesterday asks for the next one in 6 days', () => {
  assert.equal(daysUntilNextTest(YESTERDAY, NOW), 6);
  assert.equal(goodWaterLine(YESTERDAY, NOW), 'Water looks good. Next test in 6 days.');
});

test('the line follows Melbourne calendar days across the rest of the week', () => {
  const sameDay = new Date('2026-10-03T00:30:00Z'); // 3 Oct, 10:30 AEST
  assert.equal(goodWaterLine(sameDay, NOW), 'Water looks good. Next test in 7 days.');

  const sixDaysAgo = new Date('2026-09-27T02:00:00Z');
  assert.equal(goodWaterLine(sixDaysAgo, NOW), 'Water looks good. Next test tomorrow.');

  const sevenDaysAgo = new Date('2026-09-26T02:00:00Z');
  assert.equal(goodWaterLine(sevenDaysAgo, NOW), 'Water looks good. Next test today.');

  const eightDaysAgo = new Date('2026-09-25T02:00:00Z');
  assert.equal(goodWaterLine(eightDaysAgo, NOW), 'Water looks good. Next test was due yesterday.');

  const tenDaysAgo = new Date('2026-09-23T02:00:00Z'); // 10 Melbourne days before 3 Oct
  assert.equal(daysUntilNextTest(tenDaysAgo, NOW), -3);
  assert.equal(goodWaterLine(tenDaysAgo, NOW), 'Water looks good. Next test was due 3 days ago.');
});

test('daylight saving does not skip a Melbourne calendar day', () => {
  const before = new Date('2026-10-03T10:00:00Z'); // 3 Oct, 20:00 AEST
  const after = new Date('2026-10-03T23:00:00Z');  // 4 Oct, 10:00 AEDT
  assert.equal(daysUntilNextTest(before, after), 6);
});

test('a missing test time still names a week, and the copy stays quiet', () => {
  assert.equal(goodWaterLine(null, NOW), 'Water looks good. Next test in 7 days.');
  assert.equal(goodWaterLine('not-a-date', NOW), 'Water looks good. Next test in 7 days.');
  const source = readFileSync(new URL('./goodWaterLine.js', import.meta.url), 'utf8');
  assert.equal(source.includes('\u2014'), false);
  assert.equal(/confetti|celebrat|fantastic|amazing/i.test(source), false);
});

test('the home screen centres the score and does not invent local weather', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

  assert.match(app, /score >= 80 \? 'score-ring-fill score-good'/);
  assert.match(app, /score >= 50 \? 'score-ring-fill score-warn'/);
  assert.match(app, /score-ring-fill score-critical/);
  assert.match(app, /const showQuietLine = !emptyHeadline && waterLooksGood\(score, Boolean\(primaryAction\)\)/);
  assert.match(app, /className="card score-hero-card"/);
  assert.match(app, /<HealthScoreRing score=\{score\} size=\{240\} \/>/);
  assert.match(app, /className="score-quiet"/);
  assert.match(app, /\{showQuietLine && <p className="score-quiet">\{goodWaterLine\(lastTest\)\}<\/p>\}/);
  assert.match(app, /\{primaryAction && \(/);
  assert.match(css, /\.score-hero-card \{[\s\S]*?align-items: center;/);
  assert.match(css, /\.score-hero-card \{[\s\S]*?justify-content: center;/);
  assert.match(css, /\.score-quiet \{[\s\S]*?text-align: center;/);
  assert.equal(/Malvern|3144|confetti/i.test(app), false);
  assert.equal(/Malvern|3144/.test(css), false);
  assert.equal(/Heavy rain overnight/.test(app), false);
});
