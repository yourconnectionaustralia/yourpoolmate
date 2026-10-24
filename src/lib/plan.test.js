import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amountForForm,
  buildPlan,
  chlorineAim,
  chlorinatorAdvice,
  climateFor,
  differentAmountGuidance,
  estimateChlorinator,
  inferCellGPerHour,
  langelier,
  parseAmount,
  planContext,
  readingProblem,
  readingRows,
  stateFromPostcode,
  swimVerdict,
} from './plan.js';
import { doseOptions } from './dosing.js';

// Mid-month dates in Melbourne so the zone never tips the month.
const JAN = new Date('2027-01-15T02:00:00Z');
const APR = new Date('2026-04-15T02:00:00Z');
const JUL = new Date('2026-07-15T02:00:00Z');
const OCT = new Date('2026-10-15T02:00:00Z');

const POOL = {
  volumeL: 45000,
  sanitiser: 'Chlorine (granular/liquid)',
  surface: 'Pebble / pebblecrete',
};

const BALANCED = { freeChlor: 2, pH: 7.4, alkalinity: 100, cyanuricAcid: 40, calciumHardness: 300 };

test('postcodes map to the right state', () => {
  assert.equal(stateFromPostcode('3186'), 'VIC');
  assert.equal(stateFromPostcode('2000'), 'NSW');
  assert.equal(stateFromPostcode('2600'), 'ACT');
  assert.equal(stateFromPostcode('2913'), 'ACT');
  assert.equal(stateFromPostcode('0800'), 'NT');
  assert.equal(stateFromPostcode('4000'), 'QLD');
  assert.equal(stateFromPostcode('5000'), 'SA');
  assert.equal(stateFromPostcode('6000'), 'WA');
  assert.equal(stateFromPostcode('7000'), 'TAS');
  assert.equal(stateFromPostcode('31860'), null);
  assert.equal(stateFromPostcode(''), null);
  assert.equal(stateFromPostcode(null), null);
});

test('climate falls back to Melbourne and says so', () => {
  const c = climateFor(null, OCT);
  assert.equal(c.city, 'Melbourne');
  assert.equal(c.stateKnown, false);
  assert.match(c.sourceNote, /not a forecast/);
  assert.match(c.sourceNote, /postcode/);
  assert.equal(climateFor('QLD', JUL).city, 'Brisbane');
  assert.equal(climateFor('QLD', JUL).stateKnown, true);
});

test('the chlorine aim moves with the sun but the band stays 1–3', () => {
  assert.equal(chlorineAim(climateFor('VIC', JAN)), 2.5);
  assert.equal(chlorineAim(climateFor('VIC', JUL)), 1.5);
  assert.equal(chlorineAim(climateFor('VIC', APR)), 2);
  const rows = readingRows({ freeChlor: 1.2 }, { sanitiser: POOL.sanitiser });
  assert.equal(rows.find((r) => r.key === 'freeChlor').target, '1.0–3.0');
});

test('balanced water has no steps and is safe to swim', () => {
  const ctx = planContext({ pool: POOL, postcode: '3186', now: APR });
  const plan = buildPlan({ ...BALANCED, createdAt: APR.toISOString() }, ctx, APR);
  assert.equal(plan.steps.length, 0);
  assert.equal(plan.swim.tone, 'good');
  assert.equal(plan.score, 100);
  assert.match(plan.headline, /every reading we scored is on target/);
});

test('steps come in balancing order: alkalinity, pH, then chlorine last', () => {
  const ctx = planContext({ pool: POOL, postcode: '3186', now: APR });
  const plan = buildPlan({ freeChlor: 0.5, pH: 7.9, alkalinity: 60, cyanuricAcid: 40, calciumHardness: 300 }, ctx, APR);
  assert.deepEqual(plan.steps.map((s) => s.key), ['alkalinity', 'pH', 'freeChlor']);
  assert.match(plan.steps[0].notes[0], /Start here/);
  assert.ok(plan.steps[2].notes.some((n) => /chlorine last/.test(n)));
  for (const s of plan.steps) {
    assert.ok(s.safety.includes('gloves'));
    assert.ok(s.wait.length > 10);
  }
});

test('in an aim-2 month the amounts match the live dose plan exactly', () => {
  const ctx = planContext({ pool: POOL, postcode: '3186', now: APR });
  const plan = buildPlan({ freeChlor: 0.5, pH: 7.8 }, ctx, APR);
  const fc = plan.steps.find((s) => s.key === 'freeChlor');
  assert.deepEqual(fc.options.map((o) => o.amount), doseOptions('freeChlor', 'low', 0.5, 45, false, null).map((o) => o.amount));
  assert.equal(fc.options[0].amount, '540 mL');
  assert.equal(fc.options[0].millilitres, 540);
  const ph = plan.steps.find((s) => s.key === 'pH');
  assert.equal(ph.options[0].amount, '520 mL');
  assert.equal(ph.options[1].amount, '685 g');
  assert.equal(ph.options[1].grams, 685);
});

test('a high-UV month aims chlorine higher and explains why', () => {
  const ctx = planContext({ pool: POOL, postcode: '3186', now: JAN });
  const plan = buildPlan({ freeChlor: 0.5 }, ctx, JAN);
  const fc = plan.steps.find((s) => s.key === 'freeChlor');
  // 45 kL × 8 mL × 2.0 ppm gap
  assert.equal(fc.options[0].millilitres, 720);
  assert.match(fc.notes[0], /Aimed at 2\.5 ppm because UV/);
  assert.equal(plan.fcAim, 2.5);
});

test('stabilised water aims chlorine at 3 ppm, without touching the score', () => {
  assert.equal(chlorineAim(climateFor('VIC', APR), { cya: 40 }), 3);
  assert.equal(chlorineAim(climateFor('VIC', JUL), { cya: 30, hasCover: true }), 3);
  const ctx = planContext({ pool: POOL, postcode: '3186', now: APR });
  const low = buildPlan({ freeChlor: 0.5, cyanuricAcid: 40 }, ctx, APR);
  const fc = low.steps.find((s) => s.key === 'freeChlor');
  // 45 kL × 8 mL × 2.5 ppm gap
  assert.equal(fc.options[0].millilitres, 900);
  assert.match(fc.notes[0], /Aimed at 3\.0 ppm because stabiliser/);
  const at2 = buildPlan({ ...BALANCED, freeChlor: 2, cyanuricAcid: 40 }, ctx, APR);
  const at3 = buildPlan({ ...BALANCED, freeChlor: 3, cyanuricAcid: 40 }, ctx, APR);
  assert.equal(at2.score, at3.score);
  assert.equal(at2.steps.some((s) => s.key === 'freeChlor'), false);
  assert.ok(at2.watchouts.some((w) => /toward 3 ppm/.test(w) && /score is fine/.test(w)));
  assert.equal(at3.watchouts.some((w) => /toward 3 ppm/.test(w)), false);
});

test('a covered pool with no stabiliser aims 1.5–2 ppm, even in summer', () => {
  const covered = { ...POOL, hasCover: true };
  assert.equal(planContext({ pool: covered, postcode: '3186', now: JAN }).hasCover, true);
  assert.equal(chlorineAim(climateFor('VIC', JAN), { hasCover: true }), 2);
  assert.equal(chlorineAim(climateFor('VIC', JUL), { hasCover: true }), 1.5);
  assert.equal(chlorineAim(climateFor('VIC', JAN), { cya: 0, hasCover: true }), 2);
  const ctx = planContext({ pool: covered, postcode: '3186', now: JAN });
  const low = buildPlan({ freeChlor: 0.5, cyanuricAcid: 0 }, ctx, JAN);
  const fc = low.steps.find((s) => s.key === 'freeChlor');
  // 45 kL × 8 mL × 1.5 ppm gap
  assert.equal(fc.options[0].millilitres, 540);
  assert.match(fc.notes[0], /cover/);
  assert.equal(low.fcAim, 2);
  // About 2 ppm in a covered pool: no top-up nag, same score as 3.
  const at2 = buildPlan({ ...BALANCED, freeChlor: 2, cyanuricAcid: 0 }, ctx, JAN);
  const at3 = buildPlan({ ...BALANCED, freeChlor: 3, cyanuricAcid: 0 }, ctx, JAN);
  assert.equal(at2.watchouts.some((w) => /low side for this much sun/.test(w)), false);
  assert.equal(at2.score, at3.score);
  assert.equal(at2.score, 100);
  // No stabiliser under a cover is fine: no step to add it.
  assert.equal(at2.steps.length, 0);
  assert.equal(at2.rows.find((r) => r.key === 'cyanuricAcid').state, 'ok');
  assert.ok(at3.watchouts.some((w) => /helps your cover last/.test(w)));
});

test('combined chlorine of 0.5 or more swaps the chlorine step for a shock', () => {
  const ctx = planContext({ pool: POOL, postcode: '3186', now: APR });
  const plan = buildPlan({ ...BALANCED, freeChlor: 0.8, totalChlor: 1.6 }, ctx, APR);
  assert.equal(plan.combined, 0.8);
  assert.deepEqual(plan.steps.map((s) => s.key), ['shock']);
  // toward 10 ppm from 0.8: 45 × 8 × 9.2 = 3312 mL → 3.3 L
  assert.equal(plan.steps[0].options[0].amount, '3.3 L');
});

test('small combined chlorine is a watch-out, not a step', () => {
  const ctx = planContext({ pool: POOL, postcode: '3186', now: APR });
  const plan = buildPlan({ ...BALANCED, totalChlor: 2.3 }, ctx, APR);
  assert.equal(plan.steps.length, 0);
  assert.ok(plan.watchouts.some((w) => /Combined chlorine is 0\.3 ppm/.test(w)));
});

test('no volume means no quantities, and the plan says how to fix it', () => {
  const ctx = planContext({ pool: { ...POOL, volumeL: 0 }, postcode: '3186', now: APR });
  const plan = buildPlan({ freeChlor: 0.5 }, ctx, APR);
  assert.equal(plan.steps[0].volumeKnown, false);
  assert.equal(plan.steps[0].options[0].amount, null);
  assert.ok(plan.watchouts.some((w) => /pool volume/.test(w)));
});

test('vinyl liners are not told to raise calcium', () => {
  const ctx = planContext({ pool: { ...POOL, surface: 'Vinyl liner' }, postcode: '3186', now: APR });
  const plan = buildPlan({ ...BALANCED, calciumHardness: 80 }, ctx, APR);
  assert.equal(plan.steps.length, 0);
});

test('swim call is conservative', () => {
  const now = APR;
  const fresh = now.toISOString();
  assert.equal(swimVerdict({ freeChlor: 0.6, pH: 7.4, createdAt: fresh }, 70, 'Autumn', now).tone, 'wait');
  assert.equal(swimVerdict({ freeChlor: 6, pH: 7.4, createdAt: fresh }, 70, 'Autumn', now).title, 'Wait — chlorine is high');
  assert.equal(swimVerdict({ freeChlor: 2, pH: 7.9, createdAt: fresh }, 85, 'Autumn', now).tone, 'wait');
  assert.equal(swimVerdict({ pH: 7.4, createdAt: fresh }, 90, 'Autumn', now).tone, 'unknown');
  assert.equal(swimVerdict({ freeChlor: 2, pH: 7.4, createdAt: fresh }, 50, 'Autumn', now).tone, 'wait');
  const old = new Date(now.getTime() - 12 * 864e5).toISOString();
  assert.equal(swimVerdict({ freeChlor: 2, pH: 7.4, createdAt: old }, 95, 'Autumn', now).tone, 'stale');
  assert.equal(swimVerdict({ freeChlor: 2, pH: 7.4, createdAt: old }, 95, 'Winter', now).tone, 'good');
  assert.equal(swimVerdict({ freeChlor: 2, pH: 7.4, createdAt: fresh }, 95, 'Autumn', now).tone, 'good');
});

test('the balance index is near zero for textbook water', () => {
  const v = langelier({ pH: 7.5, calcium: 300, alkalinity: 100, tempC: 26, tds: 1000 });
  assert.ok(Math.abs(v) < 0.05, String(v));
  assert.ok(langelier({ pH: 7.2, calcium: 100, alkalinity: 60, tempC: 14, tds: 1000 }) < -0.3);
  assert.equal(langelier({ pH: 7.4, calcium: null, alkalinity: 100, tempC: 20 }), null);
});

test('cell size comes from the chlorinator model', () => {
  assert.equal(inferCellGPerHour([{ type: 'Chlorinator', brand: 'AstralPool', model: 'eQuilibrium EQ35' }]), 25);
  assert.equal(inferCellGPerHour([{ type: 'Chlorinator', brand: 'Zodiac', model: 'eXO iQ' }]), 20);
  assert.equal(inferCellGPerHour([{ type: 'Chlorinator', brand: 'Pool Controls', model: 'SWC 45' }]), 35);
  assert.equal(inferCellGPerHour([{ type: 'Pump' }]), null);
});

test('chlorinator advice turns the cell up before buying liquid', () => {
  const estimate = estimateChlorinator({ equipment: [], cellGPerHour: 20, outputPercent: 60, hours: 8, tempC: 20 });
  assert.equal(estimate.dailyGrams, 72);
  const advice = chlorinatorAdvice({ estimate, volumeL: 45000, deltaPpm: 1.7, climate: { season: 'Spring', uv: 5 } });
  assert.equal(advice.summary, 'Turn the chlorinator up to 80% and run 8 hours');
  assert.equal(advice.coversInOneDay, true);
  const unset = chlorinatorAdvice({ estimate: estimateChlorinator({ cellGPerHour: 20, tempC: 20 }), volumeL: 45000, deltaPpm: 1, climate: {} });
  assert.match(unset.detail, /pump hours/);
  // Never "making more than a typical day" and "turn it up because it's low" in one breath.
  const low = chlorinatorAdvice({ estimate, volumeL: 45000, deltaPpm: 1.7, climate: { season: 'Spring', uv: 7 } });
  assert.match(low.diagnosis, /keeps up with a normal day/);
});

test('a salt pool sees the chlorinator first, with an estimate', () => {
  const ctx = planContext({
    pool: { ...POOL, sanitiser: 'Saltwater chlorinator', chlorinatorOutputPercent: 60, pumpHoursPerDay: 8 },
    equipment: [{ type: 'Chlorinator', brand: 'Zodiac', model: 'eXO iQ' }],
    postcode: '3186',
    now: APR,
  });
  const plan = buildPlan({ ...BALANCED, freeChlor: 0.8, salt: 3800 }, ctx, APR);
  const fc = plan.steps.find((s) => s.key === 'freeChlor');
  assert.match(fc.options[0].name, /chlorinator/);
  assert.match(fc.options[0].summary, /chlorinator/i);
  assert.ok(fc.notes.some((n) => /cell should make/.test(n)));
});

test('typed readings are checked before saving', () => {
  assert.equal(readingProblem({ pH: 7.4 }), null);
  assert.equal(readingProblem({}).message, 'Enter at least one reading.');
  assert.match(readingProblem({ pH: 74 }).message, /looks too high/);
  assert.match(readingProblem({ freeChlor: -1 }).message, /below 0/);
});

test('a different amount says where the reading should land', () => {
  const ctx = planContext({ pool: POOL, postcode: '3186', now: APR });
  const plan = buildPlan({ freeChlor: 0.5 }, ctx, APR);
  const step = plan.steps[0];
  const option = step.options[0];
  const under = differentAmountGuidance({ step, option, amount: 200, test: { freeChlor: 0.5 }, ctx });
  assert.equal(under.kind, 'under');
  assert.match(under.text, /free chlorine of about 1/);
  const match = differentAmountGuidance({ step, option, amount: 540, test: { freeChlor: 0.5 }, ctx });
  assert.equal(match.kind, 'match');
  const over = differentAmountGuidance({ step, option, amount: 1500, test: { freeChlor: 0.5 }, ctx });
  assert.equal(over.kind, 'over');
});

test('amount helpers round-trip', () => {
  assert.deepEqual(parseAmount('1.5', 'kg'), { grams: 1500, millilitres: null });
  assert.deepEqual(parseAmount('500', 'mL'), { grams: null, millilitres: 500 });
  assert.equal(parseAmount('0', 'g'), null);
  assert.deepEqual(amountForForm({ grams: 2300 }), { value: '2.3', unit: 'kg' });
  assert.deepEqual(amountForForm({ millilitres: 540 }), { value: '540', unit: 'mL' });
});

test('4,572 ppm salt with no chlorinator on file is in range, so no drain-and-refill step', () => {
  const ctx = planContext({ pool: { ...POOL, sanitiser: 'Saltwater chlorinator' }, postcode: '3144', now: APR });
  const plan = buildPlan({ ...BALANCED, salt: 4572 }, ctx, APR);
  assert.equal(plan.steps.some((st) => st.key === 'salt'), false);
  const row = plan.rows.find((r) => r.key === 'salt');
  assert.equal(row.state, 'ok');
  assert.equal(row.target, '3,000–5,000');
  // Past the band it is still flagged.
  const high = buildPlan({ ...BALANCED, salt: 5400 }, ctx, APR);
  assert.equal(high.steps.some((st) => st.key === 'salt' && st.state === 'high'), true);
  // A chlorinator's own band still wins.
  const own = planContext({ pool: { ...POOL, sanitiser: 'Saltwater chlorinator' }, saltRange: { lo: 900, hi: 2000 }, postcode: '3144', now: APR });
  assert.equal(buildPlan({ ...BALANCED, salt: 4572 }, own, APR).steps.some((st) => st.key === 'salt' && st.state === 'high'), true);
});
