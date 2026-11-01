// File: src/lib/dosing.js
//
// Live dose amounts for the app. App.jsx buildSteps calls doseOptions.
// The marketing chlorine calculator calls chlorineRaiseDose, which calls
// doseOptions — the factors are not copied anywhere else.
//
// Chlorine products this module actually calculates when raising free
// chlorine:
//   - liquid chlorine (sodium hypochlorite) — 8 mL per kL per ppm.
//     The app does not state a strength (no 10% / 12.5% choice).
//   - granular chlorine (calcium hypochlorite) — 1.4 g per kL per ppm.
// Dichlor and trichlor are not in the live dose plan, so they are not here.

export const fmtMass = (g) => (!g || g <= 0) ? null : (g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g / 5) * 5} g`);
export const fmtVol = (ml) => (!ml || ml <= 0) ? null : (ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml / 10) * 10} mL`);

// Midpoint each parameter is dosed toward.
export const TARGET_MID = {
  pH: 7.4, freeChlor: 2.0, alkalinity: 100, cyanuricAcid: 40,
  calciumHardness: 300, salt: 3500, phosphates: 0, tds: 0,
};

// Raise-chlorine products, in the same order the dose plan shows them.
// `quantity` is the only place the chlorine factors live.
export const CHLORINE_RAISE_PRODUCTS = [
  {
    id: 'liquid-chlorine',
    name: 'liquid chlorine (sodium hypochlorite)',
    label: 'Liquid chlorine (sodium hypochlorite)',
    quantity(name, kl, d) { return volume(name, kl * 8 * d); },
  },
  {
    id: 'cal-hypo',
    name: 'granular chlorine (calcium hypochlorite)',
    label: 'Granular chlorine (calcium hypochlorite)',
    quantity(name, kl, d) { return mass(name, kl * 1.4 * d); },
  },
];

// The amount the plan tells the owner to add, as a number. Matches what
// fmtMass / fmtVol print, so stock, costs and the label never disagree.
export const roundGrams = (g) => (!g || g <= 0) ? 0 : (g >= 1000 ? Math.round(g / 100) * 100 : Math.round(g / 5) * 5);
export const roundMillilitres = (ml) => (!ml || ml <= 0) ? 0 : (ml >= 1000 ? Math.round(ml / 100) * 100 : Math.round(ml / 10) * 10);

const mass = (name, g) => ({ name, grams: roundGrams(g) || null, millilitres: null });
const volume = (name, ml) => ({ name, grams: null, millilitres: roundMillilitres(ml) || null });
const step = (name) => ({ name, grams: null, millilitres: null });

// Dose quantities for one parameter, as numbers. `kl` is pool volume in
// 1000-L units (0 = unknown). `saltMid` overrides the salt target midpoint
// for the owner's chlorinator. `target` (optional) overrides the midpoint for
// any other parameter, e.g. a higher free chlorine aim in high-UV months.
export function doseQuantities(key, state, val, kl, saltPool, saltMid, target) {
  const t = key === 'salt' && saltMid != null ? saltMid : (target ?? TARGET_MID[key]);
  const d = Math.max(0, state === 'low' ? (t - val) : (val - t));
  switch (key) {
    case 'pH':
      return state === 'low'
        ? [mass('soda ash (sodium carbonate)', kl * 60 * d)]
        // pH-down rates: HCl ~29 mL/kL per pH-unit (33% acid); dry acid ~38 g/kL
        // per pH-unit (~1.3x HCl by acid equivalence). Verified against a Focus
        // pool-shop analysis (526 mL HCl for a 45 kL pool, pH 7.8->7.4) and
        // carbonate first-principles. Do NOT reset these to 80.
        // Liquid acid is the preferred primary method, so it leads the list.
        : [volume('hydrochloric acid (liquid)', kl * 29 * d),
           mass('dry acid (sodium bisulphate)', kl * 38 * d)];
    case 'freeChlor': {
      if (state === 'low') {
        const o = CHLORINE_RAISE_PRODUCTS.map((p) => p.quantity(p.name, kl, d));
        if (saltPool) o.unshift(step('increase chlorinator output or run time'));
        return o;
      }
      return [
        step('let chlorine reduce naturally (sunlight)'),
        mass('chlorine remover (sodium thiosulphate)', kl * 2.5 * d),
      ];
    }
    case 'alkalinity':
      return state === 'low'
        ? [mass('buffer / bicarb soda (sodium bicarbonate)', kl * 1.7 * d)]
        : [mass('dry acid (sodium bisulphate)', kl * 1.9 * d),
           volume('hydrochloric acid (liquid)', kl * 1.6 * d)];
    case 'cyanuricAcid':
      return state === 'low'
        ? [mass('stabiliser / conditioner (cyanuric acid)', kl * 1.0 * d)]
        : [step('partial drain & refill, or consult your pool professional')];
    case 'calciumHardness':
      return state === 'low'
        ? [mass('calcium chloride (hardness increaser)', kl * 1.5 * d)]
        : [step('partial drain & refill, or consult your pool professional'),
           step('scale inhibitor / sequestrant')];
    case 'salt':
      return state === 'low'
        ? [mass('pool salt', kl * 1.0 * d)]
        : [step('partial drain & refill, or consult your pool professional')];
    case 'phosphates':
      return [step('phosphate remover (lanthanum-based) — dose per product label')];
    case 'tds':
      return [step('partial drain & refill, or consult your pool professional')];
    default:
      return [step('needs attention')];
  }
}

// Dose options for one parameter, with the printed amount ("540 mL").
// Same arguments as doseQuantities; grams / millilitres ride along so the
// plan can draw from the shed and price a dose.
export function doseOptions(key, state, val, kl, saltPool, saltMid, target) {
  return doseQuantities(key, state, val, kl, saltPool, saltMid, target).map((o) => ({
    ...o,
    amount: o.grams ? fmtMass(o.grams) : o.millilitres ? fmtVol(o.millilitres) : null,
  }));
}

/**
 * Raise free chlorine from currentPpm to targetPpm for one product.
 * Calls doseOptions so the amount matches the app for the same ppm gap.
 * Returns null when the inputs cannot be dosed (including target <= current —
 * the app does not add chlorine to bring a level down).
 */
export function chlorineRaiseDose({ volumeLitres, currentPpm, targetPpm, productId }) {
  const product = CHLORINE_RAISE_PRODUCTS.find((p) => p.id === productId);
  const volume = parseFloat(volumeLitres);
  const current = parseFloat(currentPpm);
  const target = parseFloat(targetPpm);
  if (!product || !(volume > 0) || !Number.isFinite(current) || !Number.isFinite(target)) return null;
  if (current < 0 || target < 0) return null;
  if (!(target > current)) return null;
  const d = target - current;
  const kl = volume / 1000;
  // doseOptions raises toward TARGET_MID. A reading this far below the
  // midpoint produces the same gap as (target - current).
  const syntheticReading = TARGET_MID.freeChlor - d;
  const options = doseOptions('freeChlor', 'low', syntheticReading, kl, false, null);
  const chosen = options.find((o) => o.name === product.name);
  if (!chosen?.amount) return null;
  return {
    id: product.id,
    name: chosen.name,
    amount: chosen.amount,
    deltaPpm: d,
    volumeLitres: volume,
  };
}
