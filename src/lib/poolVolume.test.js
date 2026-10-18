import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  KIDNEY_OF_RECTANGLE,
  averageDepthMetres,
  poolVolumeLitres,
  rectangularVolumeLitres,
} from './poolVolume.js';

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

test('setup and the volume gate both call the shared rectangle sum', () => {
  const calls = app.match(/rectangularVolumeLitres\(dims\.length, dims\.width, dims\.depth\)/g);
  assert.equal(calls?.length, 2);
  assert.match(app, /import \{ rectangularVolumeLitres \} from '\.\/lib\/poolVolume\.js'/);
  assert.doesNotMatch(app, /l \* w \* d \* 1000/);
});

test('rectangle litres match length × width × average depth × 1,000', () => {
  assert.equal(rectangularVolumeLitres(8, 4, 1.5), 48000);
  assert.equal(rectangularVolumeLitres('8', '4', '1.5'), 48000);
  assert.equal(rectangularVolumeLitres(0, 4, 1.5), null);
  assert.equal(rectangularVolumeLitres('', 4, 1.5), null);

  const averaged = averageDepthMetres(1.2, 1.8);
  assert.equal(averaged, 1.5);
  assert.equal(
    poolVolumeLitres('rectangle', { lengthM: 8, widthM: 4, shallowM: 1.2, deepM: 1.8 }),
    rectangularVolumeLitres(8, 4, averaged),
  );
  assert.equal(
    poolVolumeLitres('rectangle', { lengthM: 10, widthM: 4, depthM: 1.4 }),
    Math.round(10 * 4 * 1.4 * 1000),
  );
});

test('round, oval and kidney use standard geometry the app does not calculate', () => {
  const depth = averageDepthMetres(1, 2);
  assert.equal(depth, 1.5);

  const round = poolVolumeLitres('round', { diameterM: 5, shallowM: 1, deepM: 2 });
  assert.equal(round, Math.round(Math.PI * 2.5 * 2.5 * depth * 1000));
  assert.equal(round, 29452);

  const oval = poolVolumeLitres('oval', { lengthM: 8, widthM: 4, shallowM: 1, deepM: 2 });
  assert.equal(oval, Math.round(Math.PI * 4 * 2 * depth * 1000));
  assert.equal(oval, 37699);

  const kidney = poolVolumeLitres('kidney', { lengthM: 8, widthM: 4, shallowM: 1, deepM: 2 });
  assert.equal(kidney, Math.round(8 * 4 * depth * KIDNEY_OF_RECTANGLE * 1000));
  assert.equal(kidney, 40800);
  assert.equal(KIDNEY_OF_RECTANGLE, 0.85);
});

test('a shape with a missing measurement does not return a volume', () => {
  assert.equal(poolVolumeLitres('round', { diameterM: 5, shallowM: 1, deepM: 0 }), null);
  assert.equal(poolVolumeLitres('oval', { lengthM: 8, shallowM: 1, deepM: 2 }), null);
  assert.equal(poolVolumeLitres('kidney', { lengthM: 8, widthM: 4, shallowM: '', deepM: 2 }), null);
  assert.equal(poolVolumeLitres('triangle', { lengthM: 8, widthM: 4, depthM: 1.5 }), null);
  assert.equal(averageDepthMetres(1, -1), null);
});
