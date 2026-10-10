import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXER_NOT_SURE, GUIDES, SAFETY_BEFORE, SAFETY_EMERGENCY, SAFETY_SEE_BOTTOM, guideByKey } from './problemFixer.js';

test('five guides, each complete', () => {
  assert.deepEqual(GUIDES.map((g) => g.key), ['green', 'cloudy', 'eyes', 'foam', 'stains']);
  for (const g of GUIDES) {
    assert.ok(g.title && g.summary && g.why && g.shop, g.key);
    assert.ok(g.steps.length >= 4, `${g.key} steps`);
    for (const s of g.steps) assert.ok(s.title && s.body.length > 30, `${g.key} step`);
    assert.ok(['green_treatment', 'treatment', 'custom'].includes(g.event.type));
    assert.ok(g.event.title.length > 5);
  }
});

test('no chemical amounts: those come from the dose plan and the label', () => {
  const text = GUIDES.flatMap((g) => g.steps.map((s) => s.body)).join(' ');
  assert.ok(!/\b\d+(\.\d+)?\s?(g|kg|ml|mL|l|L|litres?|grams?|cups?|tablets?|scoops?)\b/.test(text), 'found an amount');
});

test('ranges quoted match the app targets', () => {
  const text = GUIDES.flatMap((g) => g.steps.map((s) => s.body)).join(' ');
  for (const m of text.match(/\d+(\.\d+)? to \d+(\.\d+)?/g) || []) {
    assert.ok(['7.2 to 7.6', '1.0 to 3.0', '12 to 24'].includes(m), `unexpected range ${m}`);
  }
  assert.ok(text.includes('7.2 to 7.6') && text.includes('1.0 to 3.0'));
});

test('safety: the swimming and emergency lines are present', () => {
  assert.ok(SAFETY_BEFORE.some((l) => /never mix/i.test(l)));
  assert.match(SAFETY_EMERGENCY, /13 11 26/);
  assert.match(SAFETY_EMERGENCY, /000/);
  assert.match(SAFETY_SEE_BOTTOM, /bottom/);
  assert.ok(GUIDES.find((g) => g.key === 'green').mustSeeBottom);
  assert.ok(FIXER_NOT_SURE.length > 30);
});

test('house style: no long dashes, no pretend guarantees', () => {
  const all = JSON.stringify(GUIDES) + SAFETY_BEFORE.join('') + SAFETY_EMERGENCY + FIXER_NOT_SURE;
  assert.ok(!/[–—]/.test(all));
  assert.ok(!/guarantee|always works|cure-all/i.test(all.replace(/not a cure/i, '')));
  assert.equal(guideByKey('nope'), null);
});
