import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buyQuantity,
  drawForDose,
  enoughInShed,
  formatAud,
  lowStock,
  matchProduct,
  periodWindow,
  planShortfall,
  productKeyForDose,
  scoreSummary,
  shedWithStock,
  shopEstimate,
  shopListText,
  spendBreakdown,
  spendBuckets,
  spendTotal,
  testingRhythm,
} from './shed.js';
import { buildPlan, planContext } from './plan.js';

const HCL = 'hydrochloric acid (liquid)';
const LIQ = 'liquid chlorine (sodium hypochlorite)';

const items = [
  { id: 'a', productKey: 'hcl', packAmount: 5, packUnit: 'L', packs: 1, priceAud: 20, boughtAt: '2026-09-01' },
  { id: 'b', productKey: 'hcl', packAmount: 5, packUnit: 'L', packs: 1, priceAud: null, boughtAt: '2026-10-01' },
  { id: 'c', productKey: 'bicarb', packAmount: 4, packUnit: 'kg', packs: 2, priceAud: 40, boughtAt: '2026-10-02' },
];

test('dose names and receipt text map to products', () => {
  assert.equal(productKeyForDose(HCL), 'hcl');
  assert.equal(productKeyForDose('increase chlorinator output or run time'), null);
  assert.equal(matchProduct('LIQUID POOL CHLORINE 15L')?.key, 'liquid_chlorine');
  assert.equal(matchProduct('Spirit of Salt 5L')?.key, 'hcl');
  assert.equal(matchProduct('Swimming pool salt 20kg')?.key, 'salt');
  assert.equal(matchProduct('Bicarbonate buffer 4kg')?.key, 'bicarb');
  assert.equal(matchProduct('Pool noodle'), null);
});

test('stock left is what was bought less what doses drew', () => {
  const doses = [{ shedDraw: [{ itemId: 'a', amount: 1200 }] }, { shedDraw: [{ itemId: 'a', amount: 300 }] }];
  const stock = shedWithStock(items, doses);
  const a = stock.find((s) => s.id === 'a');
  assert.equal(a.total, 5000);
  assert.equal(a.remaining, 3500);
  assert.equal(stock.find((s) => s.id === 'c').total, 8000);
  // Removing the dose (undo) puts the stock back with no other write.
  assert.equal(shedWithStock(items, doses.slice(1)).find((s) => s.id === 'a').remaining, 4700);
});

test('a dose draws oldest stock first and is priced from typed prices only', () => {
  const stock = shedWithStock(items, [{ shedDraw: [{ itemId: 'a', amount: 4800 }] }]);
  const r = drawForDose(stock, HCL, 520);
  assert.deepEqual(r.draws, [{ itemId: 'a', amount: 200 }, { itemId: 'b', amount: 320 }]);
  // 200 mL of a $20 / 5 L bottle = $0.80; the unpriced bottle adds nothing.
  assert.equal(r.costAud, 0.8);
  assert.equal(r.shortBy, 0);
});

test('a dose with no stock uses the newest typed price, or none', () => {
  const r = drawForDose([], HCL, 500);
  assert.deepEqual(r.draws, []);
  assert.equal(r.costAud, null);
  const priced = shedWithStock(items, [{ shedDraw: [{ itemId: 'a', amount: 5000 }, { itemId: 'b', amount: 5000 }] }]);
  const r2 = drawForDose(priced, HCL, 500);
  assert.equal(r2.shortBy, 500);
  assert.equal(r2.costAud, 2);
  assert.equal(drawForDose(priced, 'increase chlorinator output or run time', 0).costAud, null);
});

test('enough in the shed', () => {
  const stock = shedWithStock(items, []);
  assert.equal(enoughInShed(stock, HCL, 9000), true);
  assert.equal(enoughInShed(stock, HCL, 11000), false);
  assert.equal(enoughInShed(stock, LIQ, 100), false);
});

test('low stock warns at under three weeks of the owner’s own use', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const stock = shedWithStock([{ id: 'x', productKey: 'hcl', packAmount: 5, packUnit: 'L', packs: 1, boughtAt: '2026-09-01' }], [
    { product: HCL, date: '2026-09-22T00:00:00Z', shedDraw: [{ itemId: 'x', amount: 2000 }] },
    { product: HCL, date: '2026-10-06T00:00:00Z', shedDraw: [{ itemId: 'x', amount: 2000 }] },
  ]);
  const low = lowStock(stock, [
    { product: HCL, date: '2026-09-22T00:00:00Z', shedDraw: [{ itemId: 'x', amount: 2000 }] },
    { product: HCL, date: '2026-10-06T00:00:00Z', shedDraw: [{ itemId: 'x', amount: 2000 }] },
  ], now);
  assert.equal(low.length, 1);
  assert.equal(low[0].key, 'hcl');
  assert.ok(low[0].weeksLeft < 3);
});

test('buy quantities round up to the owner’s pack size', () => {
  assert.deepEqual(buyQuantity(6200, 'volume', { amount: 5, unit: 'L' }), { quantity: 10000, label: '2 × 5 L', packs: 2 });
  assert.equal(buyQuantity(540, 'volume', null).label, '540 mL');
  assert.equal(buyQuantity(0, 'mass', null).label, 'As the label says');
});

test('the plan shortfall is what the shed cannot cover', () => {
  const now = new Date('2026-04-15T02:00:00Z');
  const ctx = planContext({ pool: { volumeL: 45000, sanitiser: 'Chlorine (granular/liquid)' }, postcode: '3186', now });
  const plan = buildPlan({ freeChlor: 0.5, pH: 7.8, alkalinity: 100 }, ctx, now);
  const stock = shedWithStock([{ id: 'h', productKey: 'hcl', packAmount: 5, packUnit: 'L', packs: 1 }], []);
  const rows = planShortfall({ plan, stock });
  const ph = rows.find((r) => r.stepKey === 'pH');
  const fc = rows.find((r) => r.stepKey === 'freeChlor');
  assert.equal(ph.covered, true);
  assert.equal(fc.covered, false);
  assert.equal(fc.buy.label, '540 mL');
  assert.equal(planShortfall({ plan, stock, doneKeys: new Set(['freeChlor']) }).some((r) => r.stepKey === 'freeChlor'), false);
  // A salt pool's chlorine step starts with the chlorinator: nothing to buy.
  const saltCtx = planContext({ pool: { volumeL: 45000, sanitiser: 'Saltwater chlorinator' }, postcode: '3186', now });
  const saltPlan = buildPlan({ freeChlor: 0.5, salt: 4000 }, saltCtx, now);
  assert.equal(planShortfall({ plan: saltPlan, stock }).some((r) => r.stepKey === 'freeChlor'), false);
});

test('shopping estimate and text never invent a price', () => {
  assert.equal(shopEstimate({ productKey: 'bicarb', quantity: 4000 }, items), 20);
  assert.equal(shopEstimate({ productKey: 'liquid_chlorine', quantity: 5000 }, items), null);
  const text = shopListText([
    { product: LIQ, productKey: 'liquid_chlorine', quantityLabel: '1 × 15 L', stepTitle: 'Raise chlorine', status: 'needed' },
    { product: HCL, productKey: 'hcl', quantityLabel: '5 L', status: 'bought' },
  ]);
  assert.match(text, /• 1 × 15 L liquid chlorine — Raise chlorine/);
  assert.doesNotMatch(text, /hydrochloric/);
  assert.doesNotMatch(text, /\$/);
});

test('costs add up only typed prices and count the rest honestly', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const w = periodWindow('30d', 0, now).current;
  const events = [
    { type: 'dose', date: '2026-10-10T00:00:00Z', product: HCL, costAud: 2.08 },
    { type: 'dose', date: '2026-10-12T00:00:00Z', product: LIQ, costAud: null },
    { type: 'dose', date: '2026-10-13T00:00:00Z', product: 'increase chlorinator output or run time', costAud: null },
    { type: 'dose', date: '2026-08-01T00:00:00Z', product: HCL, costAud: 5 },
    { type: 'shock', date: '2026-10-11T00:00:00Z', title: 'Shocked' },
  ];
  assert.deepEqual(spendTotal(events, w), { aud: 2.08, doses: 3, free: 1, unpriced: 1 });
  const rows = spendBreakdown(events, w);
  assert.equal(rows[0].name, 'hydrochloric acid');
  assert.equal(rows[0].aud, 2.08);
  const buckets = spendBuckets(events, '30d', w);
  assert.ok(buckets.length >= 4);
  assert.equal(buckets.reduce((a, b) => a + b.doses, 0), 3);
  assert.equal(formatAud(2.08), '$2.08');
  assert.equal(formatAud(79), '$79');
});

test('score summary and rhythm for a window', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const { current, previous } = periodWindow('30d', 0, now);
  const tests = [
    { createdAt: '2026-09-05T00:00:00Z', healthScore: 60 },
    { createdAt: '2026-10-01T00:00:00Z', healthScore: 70 },
    { createdAt: '2026-10-15T00:00:00Z', healthScore: 90 },
  ];
  const s = scoreSummary(tests, current, previous);
  assert.equal(s.tests, 2);
  assert.equal(s.average, 80);
  assert.equal(s.previousAverage, 60);
  assert.equal(s.change, 20);
  assert.equal(s.greenShare, 50);
  assert.deepEqual(testingRhythm(tests, current), { count: 2, longestGapDays: 14 });
});
