import assert from 'node:assert/strict';
import test from 'node:test';
import { chatContext } from './chatContext.js';

const NOW = new Date('2026-10-24T02:00:00Z');

test('no pool and no test still says so', () => {
  const text = chatContext({ now: NOW });
  assert.match(text, /Today: 24 October 2026/);
  assert.match(text, /No water test saved yet/);
});

test('pool, readings, score and plan steps', () => {
  const text = chatContext({
    now: NOW,
    poolProfile: { volumeL: 42000, type: 'In-ground', surface: 'Pebble', sanitiser: 'Salt chlorinator', filter: 'Sand', hasCover: true },
    testData: { createdAt: '2026-10-23T22:00:00Z' },
    plan: {
      score: 64,
      swim: { title: 'Hold off swimming' },
      rows: [
        { name: 'Free chlorine', value: 0.5, unit: 'ppm', state: 'low', target: '1–3' },
        { name: 'pH', value: 7.4, unit: '', state: 'ok', target: '7.2–7.6' },
        { name: 'Calcium', value: null, unit: 'ppm', state: 'none', target: '200–400' },
      ],
      steps: [{ action: 'Raise chlorine', options: [{ name: 'liquid chlorine', amount: '1.2 L' }] }],
    },
  });
  assert.match(text, /42,000 litres, In-ground, Pebble, sanitiser: Salt chlorinator, filter: Sand, has a cover/);
  assert.match(text, /Free chlorine 0.5 ppm \(low, target 1–3\); pH 7.4 \(good, target 7.2–7.6\)\./);
  assert.doesNotMatch(text, /Calcium/);
  assert.match(text, /Health Score: 64\/100/);
  assert.match(text, /1\. Raise chlorine: 1.2 L /);
});

test('a test with nothing to add', () => {
  const text = chatContext({
    now: NOW,
    testData: { createdAt: '2026-10-23T22:00:00Z' },
    plan: { score: 92, rows: [{ name: 'pH', value: 7.4, unit: '', state: 'ok', target: '7.2–7.6' }], steps: [] },
  });
  assert.match(text, /Today's plan: nothing to add/);
});
