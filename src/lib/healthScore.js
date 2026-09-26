// File: src/lib/healthScore.js
// Canonical Pool Health Score for the client.
//
// This mirrors supabase/functions/calculate-health-score/index.ts — the edge
// function is the reference implementation; if the scoring model changes,
// change it there first and copy the constants here. Keys here are the app's
// camelCase test-state keys (the edge function uses the water_tests column names).
// Pass the pool surface so a vinyl liner does not score low calcium as a fault.
//
// Behaviour notes:
//   - A parameter that wasn't tested (null / undefined / '') is SKIPPED and the
//     remaining weights are renormalised — an untested reading never drags the
//     score down. A reading of 0 (e.g. no chlorine) is a real, scored value.
//   - Saltwater / mineral pools score salt as a weighted parameter — too low
//     and the chlorinator stops producing, too high and equipment corrodes.

// Standard (non-salt) pools
const WEIGHTS_DEFAULT = {
  freeChlor:       0.35,
  pH:              0.25,
  alkalinity:      0.20,
  cyanuricAcid:    0.10,
  calciumHardness: 0.10,
};

// Saltwater / mineral chlorinator pools
const WEIGHTS_SALTWATER = {
  freeChlor:       0.30,
  pH:              0.225,
  salt:            0.15,
  alkalinity:      0.175,
  cyanuricAcid:    0.075,
  calciumHardness: 0.075,
};

// Target ranges (AU residential). Salt matches the 3000–4500 target shown
// throughout the UI. Calcium 200–400 is the hard-surface band (pebblecrete,
// concrete, tile, painted concrete). Vinyl is handled separately below.
export const SCORE_RANGES = {
  freeChlor:       { min: 1.0,  max: 3.0  },
  pH:              { min: 7.2,  max: 7.6  },
  alkalinity:      { min: 80,   max: 120  },
  cyanuricAcid:    { min: 30,   max: 50   },
  calciumHardness: { min: 200,  max: 400  },
  salt:            { min: 3000, max: 4500 },
};

// Setup lists each surface on its own. Fibreglass is not grouped with vinyl,
// so only an actual vinyl liner gets the soft calcium band.
export function isVinylLiner(surface) {
  return /^vinyl(\s+liner)?$/i.test(String(surface || '').trim());
}

// Hard surfaces keep 200–400. Vinyl has no low floor: low calcium does not
// etch a liner, so it stays in range. The high side stays 400 because scale
// still matters on every surface.
export function calciumBand(surface) {
  if (isVinylLiner(surface)) return { lo: 0, hi: 400, target: 'up to 400' };
  return { lo: 200, hi: 400, target: '200–400' };
}

// Low calcium on vinyl is not a dosing action. High calcium still is.
export function includeCalciumInActions(state, surface) {
  if (state !== 'low' && state !== 'high') return false;
  if (state === 'low' && isVinylLiner(surface)) return false;
  return true;
}

// Plausible physical bounds — anything outside is treated as bad input,
// not a catastrophic reading.
const BOUNDS = {
  freeChlor:       { lo: 0, hi: 20 },
  pH:              { lo: 0, hi: 14 },
  alkalinity:      { lo: 0, hi: 500 },
  cyanuricAcid:    { lo: 0, hi: 300 },
  calciumHardness: { lo: 0, hi: 1500 },
  salt:            { lo: 0, hi: 20000 },
};

// The app stores human-readable sanitiser labels (e.g. "Saltwater chlorinator",
// "Mineral / magnesium") and onboarding stores slugs ('saltwater', 'mineral').
// Substring match covers both.
export const isSaltPool = (s) => /salt|mineral|magnesium/i.test(s || '');

function sanitise(param, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return null;
  const b = BOUNDS[param];
  if (!b || n < b.lo || n > b.hi) return null;
  return n;
}

function scoreParam(value, min, max) {
  if (value >= min && value <= max) return 100;
  const mid = (min + max) / 2;
  const spread = (max - min) / 2;
  const dist = Math.abs(value - mid) - spread;
  // Penalise proportional to distance from range (score hits 0 at 2× spread)
  const penalty = Math.min(1, dist / spread);
  return Math.round(Math.max(0, 100 * (1 - penalty)));
}

// Vinyl: anything up to the shared high cap scores full marks, so a low
// reading cannot drag the Health Score. Above that cap, use the same
// high-side penalty as pebblecrete and concrete.
function scoreCalcium(value, surface) {
  const { min, max } = SCORE_RANGES.calciumHardness;
  if (isVinylLiner(surface) && value <= max) return 100;
  return scoreParam(value, min, max);
}

// `saltRange` ({ lo, hi }, optional) overrides the default salt band — it
// comes from the owner's chlorinator via saltRangeForEquipment() below.
// `surface` is the pool profile surface. Omitted = hard-surface calcium band.
export function calculateScore(test, sanitiserType, saltRange, surface) {
  if (!test) return 0;
  const weights = isSaltPool(sanitiserType) ? WEIGHTS_SALTWATER : WEIGHTS_DEFAULT;

  let total = 0;
  let weightSum = 0;

  for (const [param, weight] of Object.entries(weights)) {
    const value = sanitise(param, test[param]);
    if (value !== null) {
      let scored;
      if (param === 'calciumHardness') {
        scored = scoreCalcium(value, surface);
      } else {
        const { min, max } = param === 'salt' && saltRange
          ? { min: saltRange.lo, max: saltRange.hi }
          : SCORE_RANGES[param];
        scored = scoreParam(value, min, max);
      }
      total += scored * weight;
      weightSum += weight;
    }
  }

  if (weightSum === 0) return 0;
  return Math.round(total / weightSum);
}

// ── Chlorinator-specific salt / mineral bands ────────────────
// Different chlorinators need very different salt (or mineral TDS) levels —
// a Pool Controls XLS runs at ~1000 ppm while a Mineral Swim wants 3500+.
// Manufacturer-sourced operating bands (July 2026):
//   AstralPool eQuilibrium  — maintain ~4000, never below 3000 (product manual)
//   Zodiac eXO / TRi        — ideal 4000, minimum 3300 (product spec)
//   Pool Controls SWC / SG  — 3000–5000, ideally 4000 (user manual)
//   Pool Controls XLS       — 900–2000, ideally 1000 (user manual)
//   Mineral Swim PRO        — operational TDS 3500–6500 (maytronics.com.au)
//   Pool Pro MineralX       — ultra-low salt from 1500 ppm (poolpro.com.au)
// Order matters: first match wins, so put specific models before brand-wide
// rules. `model` omitted = match on brand alone (any/empty model).
const CHLORINATOR_SALT_RANGES = [
  { brand: 'pool controls',           model: /xls/i,            lo: 900,  hi: 2000 },
  { brand: 'pool controls',           model: /swc|sg/i,         lo: 3000, hi: 5000 },
  { brand: 'maytronics mineral swim',                           lo: 3500, hi: 6500 },
  { brand: 'pool pro',                model: /mineralx/i,       lo: 1500, hi: 4000 },
  { brand: 'astralpool',              model: /equilibrium|eq/i, lo: 3000, hi: 5000 },
  { brand: 'zodiac',                  model: /exo|tri/i,        lo: 3300, hi: 5000 },
];

// Given the owner's equipment register, return the salt band their
// chlorinator actually needs, or null to use the app default.
export function saltRangeForEquipment(equipment) {
  const chl = (equipment || []).find(e => /chlorinator/i.test(e.type || ''));
  if (!chl) return null;
  const brand = (chl.brand || '').toLowerCase();
  const match = CHLORINATOR_SALT_RANGES.find(r =>
    brand.includes(r.brand) && (!r.model || r.model.test(chl.model || ''))
  );
  if (!match) return null;
  return { lo: match.lo, hi: match.hi, label: [chl.brand, chl.model].filter(Boolean).join(' ') };
}
