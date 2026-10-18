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
// `amount` is the only place the chlorine factors live.
export const CHLORINE_RAISE_PRODUCTS = [
  {
    id: 'liquid-chlorine',
    name: 'liquid chlorine (sodium hypochlorite)',
    label: 'Liquid chlorine (sodium hypochlorite)',
    amount(kl, d) { return fmtVol(kl * 8 * d); },
  },
  {
    id: 'cal-hypo',
    name: 'granular chlorine (calcium hypochlorite)',
    label: 'Granular chlorine (calcium hypochlorite)',
    amount(kl, d) { return fmtMass(kl * 1.4 * d); },
  },
];

// Dose options for one parameter. `kl` is pool volume in 1000-L units (0 = unknown).
// `saltMid` overrides the salt target midpoint for the owner's chlorinator.
export function doseOptions(key, state, val, kl, saltPool, saltMid) {
  const t = key === 'salt' && saltMid != null ? saltMid : TARGET_MID[key];
  const d = state === 'low' ? (t - val) : (val - t);
  switch (key) {
    case 'pH':
      return state === 'low'
        ? [{ name: 'soda ash (sodium carbonate)', amount: fmtMass(kl * 60 * d) }]
        // pH-down rates: HCl ~29 mL/kL per pH-unit (33% acid); dry acid ~38 g/kL
        // per pH-unit (~1.3x HCl by acid equivalence). Verified against a Focus
        // pool-shop analysis (526 mL HCl for a 45 kL pool, pH 7.8->7.4) and
        // carbonate first-principles. Do NOT reset these to 80.
        // Liquid acid is the preferred primary method, so it leads the list.
        : [{ name: 'hydrochloric acid (liquid)', amount: fmtVol(kl * 29 * d) },
           { name: 'dry acid (sodium bisulphate)', amount: fmtMass(kl * 38 * d) }];
    case 'freeChlor': {
      if (state === 'low') {
        const o = CHLORINE_RAISE_PRODUCTS.map((p) => ({
          name: p.name,
          amount: p.amount(kl, d),
        }));
        if (saltPool) o.unshift({ name: 'increase chlorinator output or run time', amount: null });
        return o;
      }
      return [
        { name: 'let chlorine reduce naturally (sunlight)', amount: null },
        { name: 'chlorine remover (sodium thiosulphate)', amount: fmtMass(kl * 2.5 * d) },
      ];
    }
    case 'alkalinity':
      return state === 'low'
        ? [{ name: 'buffer / bicarb soda (sodium bicarbonate)', amount: fmtMass(kl * 1.7 * d) }]
        : [{ name: 'dry acid (sodium bisulphate)', amount: fmtMass(kl * 1.9 * d) },
           { name: 'hydrochloric acid (liquid)', amount: fmtVol(kl * 1.6 * d) }];
    case 'cyanuricAcid':
      return state === 'low'
        ? [{ name: 'stabiliser / conditioner (cyanuric acid)', amount: fmtMass(kl * 1.0 * d) }]
        : [{ name: 'partial drain & refill, or consult your pool professional', amount: null }];
    case 'calciumHardness':
      return state === 'low'
        ? [{ name: 'calcium chloride (hardness increaser)', amount: fmtMass(kl * 1.5 * d) }]
        : [{ name: 'partial drain & refill, or consult your pool professional', amount: null },
           { name: 'scale inhibitor / sequestrant', amount: null }];
    case 'salt':
      return state === 'low'
        ? [{ name: 'pool salt', amount: fmtMass(kl * 1.0 * d) }]
        : [{ name: 'partial drain & refill, or consult your pool professional', amount: null }];
    case 'phosphates':
      return [{ name: 'phosphate remover (lanthanum-based) — dose per product label', amount: null }];
    case 'tds':
      return [{ name: 'partial drain & refill, or consult your pool professional', amount: null }];
    default:
      return [{ name: 'needs attention', amount: null }];
  }
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
