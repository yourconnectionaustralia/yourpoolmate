import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CHLORINE_RAISE_PRODUCTS,
  TARGET_MID,
  chlorineRaiseDose,
  doseOptions,
} from './dosing.js';

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

function optionAmount(options, name) {
  return options.find((option) => option.name === name)?.amount;
}

test('the live dose plan uses this module and does not keep a second chlorine formula', () => {
  assert.match(app, /import \{ doseOptions \} from '\.\/lib\/dosing\.js'/);
  assert.match(app, /options: doseOptions\(key, state, Number\(test\[key\]\), kl, saltPool, saltMid\)/);
  assert.doesNotMatch(app, /function doseOptions/);
  assert.doesNotMatch(app, /kl \* 8 \* d/);
  assert.doesNotMatch(app, /kl \* 1\.4 \* d/);
});

test('raising chlorine lists only the products the app calculates', () => {
  const names = CHLORINE_RAISE_PRODUCTS.map((product) => product.name);
  assert.deepEqual(names, [
    'liquid chlorine (sodium hypochlorite)',
    'granular chlorine (calcium hypochlorite)',
  ]);
  assert.equal(/dichlor|trichlor/i.test(JSON.stringify(CHLORINE_RAISE_PRODUCTS)), false);

  const raised = doseOptions('freeChlor', 'low', 1, 45, false, null).map((option) => option.name);
  assert.deepEqual(raised, names);

  const salt = doseOptions('freeChlor', 'low', 1, 45, true, null);
  assert.equal(salt[0].name, 'increase chlorinator output or run time');
  assert.equal(salt[0].amount, null);
  assert.deepEqual(salt.slice(1).map((option) => option.name), names);
});

test('tool doses match doseOptions for each product and the same ppm gap', () => {
  const cases = [
    { volumeL: 45000, current: 1, target: 2 },
    { volumeL: 45000, current: 0.5, target: 2 },
    { volumeL: 32000, current: 0, target: 2 },
    { volumeL: 10000, current: 1.2, target: 2.5 },
    { volumeL: 80000, current: 0.5, target: 3 },
    { volumeL: 200000, current: 0, target: 4 },
  ];

  for (const sample of cases) {
    const gap = sample.target - sample.current;
    const kl = sample.volumeL / 1000;
    const fromApp = doseOptions('freeChlor', 'low', TARGET_MID.freeChlor - gap, kl, false, null);
    const fromSalt = doseOptions('freeChlor', 'low', TARGET_MID.freeChlor - gap, kl, true, null);
    for (const product of CHLORINE_RAISE_PRODUCTS) {
      const tool = chlorineRaiseDose({
        volumeLitres: sample.volumeL,
        currentPpm: sample.current,
        targetPpm: sample.target,
        productId: product.id,
      });
      const expected = optionAmount(fromApp, product.name);
      assert.ok(expected, `${product.id} missing from doseOptions`);
      assert.equal(tool?.amount, expected, JSON.stringify(sample));
      assert.equal(tool.name, product.name);
      assert.equal(optionAmount(fromSalt, product.name), expected);
    }
  }
});

test('a target of 2.0 ppm matches dosing the current reading in the app', () => {
  const fromApp = doseOptions('freeChlor', 'low', 0.5, 45, false, null);
  for (const product of CHLORINE_RAISE_PRODUCTS) {
    const tool = chlorineRaiseDose({
      volumeLitres: 45000,
      currentPpm: 0.5,
      targetPpm: TARGET_MID.freeChlor,
      productId: product.id,
    });
    assert.equal(tool.amount, optionAmount(fromApp, product.name));
  }
  assert.equal(optionAmount(fromApp, 'liquid chlorine (sodium hypochlorite)'), '540 mL');
  assert.equal(optionAmount(fromApp, 'granular chlorine (calcium hypochlorite)'), '95 g');
});

test('chlorine is not dosed downwards, and bad inputs do not invent an amount', () => {
  assert.equal(chlorineRaiseDose({
    volumeLitres: 45000, currentPpm: 3, targetPpm: 1, productId: 'liquid-chlorine',
  }), null);
  assert.equal(chlorineRaiseDose({
    volumeLitres: 45000, currentPpm: 2, targetPpm: 2, productId: 'cal-hypo',
  }), null);
  assert.equal(chlorineRaiseDose({
    volumeLitres: 0, currentPpm: 1, targetPpm: 2, productId: 'liquid-chlorine',
  }), null);
  assert.equal(chlorineRaiseDose({
    volumeLitres: 45000, currentPpm: 1, targetPpm: 2, productId: 'dichlor',
  }), null);

  const high = doseOptions('freeChlor', 'high', 4, 45, false, null);
  assert.deepEqual(high.map((option) => option.name), [
    'let chlorine reduce naturally (sunlight)',
    'chlorine remover (sodium thiosulphate)',
  ]);
});

test('moving the dose function did not change a known pH amount', () => {
  const acid = doseOptions('pH', 'high', 7.8, 45, false, null);
  assert.equal(acid[0].name, 'hydrochloric acid (liquid)');
  assert.equal(acid[0].amount, '520 mL');
  assert.equal(acid[1].amount, '685 g');
});
