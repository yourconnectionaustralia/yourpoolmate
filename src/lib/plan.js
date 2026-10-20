// File: src/lib/plan.js
//
// The dose plan for the latest test: what to add, in what order, how much,
// whether it is safe to swim, and what to watch.
//
// Dose factors live in dosing.js and nowhere else. Scoring lives in
// healthScore.js. This module puts them together with the pool's context
// (litres, surface, sanitiser, chlorinator, the month and the state).
//
// Climate figures are approximate monthly averages for the capital city of
// the owner's state. They are labelled that way on screen. This is not a
// forecast and the app never says it is.

import { doseOptions } from './dosing.js';
import { safetyLineFor, DOSE_PLAN_GUIDANCE } from './dosingSafety.js';
import { calculateScore, calciumBand, includeCalciumInActions, isSaltPool } from './healthScore.js';

export { DOSE_PLAN_GUIDANCE };

export const POISONS_LINE =
  'If someone swallows pool chemicals, breathes in fumes and struggles to breathe, or gets chemicals in their eyes, ring the Poisons Information Centre on 13 11 26. In an emergency ring 000.';

// ── Where and when ───────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Australian postcode → state. Returns null for anything that isn't a
// 4-digit Australian postcode.
export function stateFromPostcode(postcode) {
  const s = String(postcode ?? '').trim();
  if (!/^\d{4}$/.test(s)) return null;
  const n = Number(s);
  if ((n >= 200 && n <= 299) || (n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return 'ACT';
  if (n >= 800 && n <= 999) return 'NT';
  if ((n >= 1000 && n <= 2599) || (n >= 2619 && n <= 2899) || (n >= 2921 && n <= 2999)) return 'NSW';
  if ((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999)) return 'VIC';
  if ((n >= 4000 && n <= 4999) || (n >= 9000 && n <= 9999)) return 'QLD';
  if (n >= 5000 && n <= 5999) return 'SA';
  if (n >= 6000 && n <= 6999) return 'WA';
  if (n >= 7000 && n <= 7999) return 'TAS';
  return null;
}

export const STATE_TIME_ZONE = {
  VIC: 'Australia/Melbourne', NSW: 'Australia/Sydney', ACT: 'Australia/Sydney',
  QLD: 'Australia/Brisbane', SA: 'Australia/Adelaide', WA: 'Australia/Perth',
  TAS: 'Australia/Hobart', NT: 'Australia/Darwin',
};

// Approximate monthly mean maximum temperature (°C) and typical midday UV
// index for each state's capital. Rounded; good enough to aim chlorine and
// pump hours, not a measurement.
const CLIMATE = {
  VIC: { city: 'Melbourne', temp: [26, 26, 24, 20, 17, 14, 14, 15, 17, 20, 22, 24], uv: [11, 10, 8, 5, 3, 2, 2, 3, 5, 7, 9, 11] },
  NSW: { city: 'Sydney',    temp: [26, 26, 25, 23, 20, 18, 17, 19, 21, 23, 24, 25], uv: [12, 11, 9, 6, 4, 3, 3, 4, 6, 8, 10, 12] },
  ACT: { city: 'Canberra',  temp: [28, 27, 24, 20, 16, 12, 12, 13, 16, 20, 23, 26], uv: [12, 11, 8, 5, 3, 2, 2, 3, 5, 7, 10, 11] },
  QLD: { city: 'Brisbane',  temp: [30, 29, 28, 27, 24, 22, 22, 23, 26, 27, 28, 29], uv: [13, 12, 10, 8, 5, 4, 4, 6, 8, 10, 12, 13] },
  SA:  { city: 'Adelaide',  temp: [29, 29, 26, 22, 19, 16, 15, 16, 19, 22, 25, 27], uv: [12, 11, 8, 5, 3, 2, 2, 3, 5, 7, 10, 11] },
  WA:  { city: 'Perth',     temp: [31, 32, 29, 25, 22, 19, 18, 19, 20, 23, 26, 29], uv: [13, 12, 10, 7, 4, 3, 3, 4, 6, 9, 11, 12] },
  TAS: { city: 'Hobart',    temp: [22, 22, 20, 17, 15, 12, 12, 13, 15, 17, 19, 21], uv: [9, 8, 6, 4, 2, 1, 1, 2, 4, 6, 8, 9] },
  NT:  { city: 'Darwin',    temp: [32, 31, 32, 33, 32, 31, 31, 32, 33, 34, 34, 33], uv: [12, 12, 12, 11, 10, 9, 10, 11, 12, 13, 13, 12] },
};

function zonedMonth(date, timeZone) {
  const m = Number(new Intl.DateTimeFormat('en-AU', { timeZone, month: 'numeric' }).format(date));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : date.getMonth() + 1;
}

export function seasonForMonth(m) {
  if (m >= 3 && m <= 5) return 'Autumn';
  if (m >= 6 && m <= 8) return 'Winter';
  if (m >= 9 && m <= 11) return 'Spring';
  return 'Summer';
}

// The month's typical conditions for the owner's state (Victoria when the
// state is unknown — most early members are in Melbourne).
export function climateFor(state, date = new Date()) {
  const known = Boolean(CLIMATE[state]);
  const key = known ? state : 'VIC';
  const c = CLIMATE[key];
  const month = zonedMonth(date, STATE_TIME_ZONE[key]);
  const tempC = c.temp[month - 1];
  const uv = c.uv[month - 1];
  // Darwin has no winter worth the name: treat it by temperature, not calendar.
  const season = key === 'NT' ? (tempC >= 32 ? 'Summer' : 'Spring') : seasonForMonth(month);
  return {
    state: key,
    stateKnown: known,
    city: c.city,
    month,
    monthName: MONTHS[month - 1],
    tempC,
    uv,
    season,
    summary: `Typical ${MONTHS[month - 1]} in ${c.city}: about ${tempC}°C, UV ${uv}`,
    advice: uv >= 7
      ? 'UV this strong burns chlorine off quickly. Keep free chlorine toward the top of the range and give the pump a longer run.'
      : season === 'Winter'
        ? 'Cool water moves slowly. A test each fortnight is enough unless there has been heavy rain.'
        : season === 'Summer'
          ? 'Heat and swimmers use chlorine quickly. Test twice a week.'
          : 'A weekly test is the right rhythm for this time of year.',
    pumpHours: season === 'Summer' ? '10–12 hours' : season === 'Spring' ? 'about 8 hours' : season === 'Autumn' ? '6–8 hours' : '4–6 hours',
    sourceNote: known
      ? `Approximate long-term averages for ${c.city}, not a forecast.`
      : 'Approximate long-term averages for Melbourne, not a forecast. Add your postcode in Profile to use your state.',
  };
}

// Free chlorine the plan aims for. The acceptable band is always 1–3 ppm;
// only the aim inside it moves with the sun.
export function chlorineAim(climate) {
  if (!climate) return 2;
  if (climate.season === 'Winter' && climate.uv < 6) return 1.5;
  if (climate.uv >= 7 || climate.season === 'Summer') return 2.5;
  return 2;
}

// One turnover at about 200 L/min.
export function turnoverHours(volumeL, litresPerMinute = 200) {
  if (!volumeL || litresPerMinute <= 0) return 0;
  return Math.round((volumeL / (60 * litresPerMinute)) * 10) / 10;
}

// ── Salt chlorinator estimate ────────────────────────────────

// Cell size in grams of chlorine an hour at 100%, from the model on the
// equipment list. Most AU residential cells are 15–35 g/h.
export function inferCellGPerHour(equipment) {
  const chl = (equipment || []).find((e) => /chlorinat/i.test(e.type || ''));
  if (!chl) return null;
  const name = `${chl.brand || ''} ${chl.model || ''}`.toLowerCase();
  if (/eq45|swc ?45|pro40/.test(name)) return 35;
  if (/eq35|swc ?35|pro25/.test(name)) return 25;
  if (/swc ?60/.test(name)) return 45;
  if (/eq25|swc ?25|pro20/.test(name)) return 20;
  if (/eq18|swc ?15/.test(name)) return 15;
  if (/exo/.test(name)) return 20;
  if (/\btri\b|tri-xo/.test(name)) return 25;
  const grams = name.match(/(\d{2})\s*g/);
  return grams ? Number(grams[1]) : 20;
}

// Cells make less in cold water and when salt is short.
function tempFactor(tempC) {
  if (tempC <= 15) return 0.5;
  if (tempC >= 30) return 1.1;
  if (tempC <= 25) return round3(0.5 + ((tempC - 15) / 10) * 0.5);
  return round3(1 + ((tempC - 25) / 5) * 0.1);
}

function saltFactor(saltPpm, saltRange) {
  if (saltPpm == null) return 1;
  const lo = saltRange?.lo ?? 3000;
  const hi = saltRange?.hi ?? 5000;
  if (saltPpm < 0.8 * lo) return 0.5;
  if (saltPpm < lo) return 0.75;
  if (saltPpm > 1.15 * hi) return 0.9;
  return 1;
}

function cellGrams({ ratedGPerHour, outputPercent, hours, tempC, saltPpm = null, saltRange = null }) {
  return Math.round(10 * ratedGPerHour * (outputPercent / 100) * hours * tempFactor(tempC) * saltFactor(saltPpm, saltRange)) / 10;
}

// 1 ppm in 1 kL is treated as 1 g of available chlorine.
export const gramsForPpm = (volumeL, ppm) => (volumeL <= 0 || ppm <= 0 ? 0 : Math.round(volumeL * ppm) / 1000);

// Liquid chlorine (12.5%) carries about 125 g available chlorine per litre:
// 8 mL per gram, matching the 8 mL/kL/ppm dose factor.
export const millilitresForChlorineGrams = (g) => (g <= 0 ? 0 : Math.round(8 * g));

const gramText = (g) => (g >= 100 ? `${Math.round(g)} g` : `${Math.round(10 * g) / 10} g`);

export function estimateChlorinator({ equipment, cellGPerHour, outputPercent, hours, tempC, saltPpm, saltRange }) {
  const rated = Number(cellGPerHour) > 0 ? Number(cellGPerHour) : (inferCellGPerHour(equipment) ?? 20);
  const out = Number(outputPercent) > 0 ? Number(outputPercent) : null;
  const hrs = Number(hours) > 0 ? Number(hours) : null;
  return {
    ratedGPerHour: rated,
    outputPercent: out,
    hours: hrs,
    tempC,
    tempFactor: tempFactor(tempC),
    saltFactor: saltFactor(saltPpm ?? null, saltRange ?? null),
    dailyGrams: out != null && hrs != null
      ? cellGrams({ ratedGPerHour: rated, outputPercent: out, hours: hrs, tempC, saltPpm, saltRange })
      : null,
  };
}

export const CHLORINATOR_NOTE =
  'The cell figure is an estimate: rated grams an hour × output × pump hours, scaled for the month’s typical temperature and your salt. It is not a measurement.';

// What to do with the chlorinator before buying liquid chlorine.
export function chlorinatorAdvice({ estimate, volumeL, deltaPpm, climate }) {
  const need = gramsForPpm(volumeL, deltaPpm);
  const typical = gramsForPpm(volumeL, climate?.season === 'Winter' && climate.uv < 6 ? 1 : climate?.uv >= 7 || climate?.season === 'Summer' ? 1.5 : 1.2);
  const setting = `${estimate.outputPercent ?? '?'}% for ${estimate.hours ?? '?'} hours on a ${estimate.ratedGPerHour} g/h cell`;
  const diagnosis = (made) => {
    if (estimate.saltFactor < 1) {
      return `Free chlorine is low. Salt is short of the cell's band, so it makes less than its rating. ${setting} is estimated at ${gramText(made)} today; this lift needs about ${gramText(need)}.`;
    }
    if (made < typical) {
      return `Free chlorine is low. The chlorinator is on ${setting}, estimated ${gramText(made)} a day — less than the ${gramText(typical)} a typical day uses this month. Turn it up before you buy liquid chlorine.`;
    }
    return `Free chlorine is low. On ${setting} the cell keeps up with a normal day (about ${gramText(made)}), but catching up needs about ${gramText(need)} on top. Turn it up for a day or two.`;
  };

  if (estimate.outputPercent == null || estimate.hours == null) {
    return {
      summary: 'Turn up the chlorinator output or run time',
      detail: 'Add your pump hours and chlorinator output in Pool setup and we can estimate what the cell makes. Turn it up before you buy liquid chlorine.',
      diagnosis: 'Free chlorine is low. Pump hours or chlorinator output are not set yet, so we cannot tell whether the cell can catch up on its own.',
      coversInOneDay: false,
      currentDailyG: null,
      suggestedOutput: 80,
      suggestedHours: 8,
    };
  }

  const made = estimate.dailyGrams ?? 0;
  if (need > 0 && made >= need) {
    return {
      summary: `Keep the chlorinator at ${estimate.outputPercent}% for ${estimate.hours} hours`,
      detail: `At ${estimate.outputPercent}% for ${estimate.hours} hours the cell should make about ${gramText(made)} of chlorine today — enough for the ${deltaPpm.toFixed(1)} ppm lift.`,
      diagnosis: null,
      coversInOneDay: true,
      currentDailyG: made,
      suggestedOutput: estimate.outputPercent,
      suggestedHours: estimate.hours,
    };
  }

  const startHours = estimate.hours ?? 8;
  const outputs = [estimate.outputPercent ?? 60, 80, 100].filter((v, i, a) => a.indexOf(v) === i && v >= (estimate.outputPercent ?? 0));
  const hoursList = [startHours, startHours + 2, 10, 12].filter((v, i, a) => v <= 12 && a.indexOf(v) === i).sort((a, b) => a - b);
  for (const h of hoursList) {
    for (const o of outputs) {
      const g = cellGrams({ ratedGPerHour: estimate.ratedGPerHour, outputPercent: o, hours: h, tempC: estimate.tempC });
      if (g + 0.05 >= need) {
        return {
          summary: `Turn the chlorinator up to ${o}% and run ${h} hours`,
          detail: `At ${o}% for ${h} hours the cell should make about ${gramText(g)} — enough to skip buying liquid chlorine for this lift.`,
          diagnosis: diagnosis(made),
          coversInOneDay: true,
          currentDailyG: made,
          suggestedOutput: o,
          suggestedHours: h,
        };
      }
    }
  }

  const max = cellGrams({ ratedGPerHour: estimate.ratedGPerHour, outputPercent: 100, hours: 12, tempC: estimate.tempC });
  const days = max > 0 ? Math.max(2, Math.ceil(need / max)) : 3;
  return {
    summary: 'Run the chlorinator at 100% for 12 hours',
    detail: `Even at 100% for 12 hours the cell is estimated to make about ${gramText(max)} today, and this lift needs about ${gramText(need)}. Turn it right up, and use liquid chlorine only if you need the pool sooner than about ${days} days.`,
    diagnosis: diagnosis(made),
    coversInOneDay: false,
    currentDailyG: made,
    suggestedOutput: 100,
    suggestedHours: 12,
  };
}

export function isChlorinatorStep(name) {
  return /chlorinator/i.test(name || '');
}

// ── Readings ─────────────────────────────────────────────────

export const READINGS = [
  { key: 'freeChlor',       name: 'Free chlorine',          short: 'Chlorine',   unit: 'ppm' },
  { key: 'pH',              name: 'pH',                     short: 'pH',         unit: '' },
  { key: 'alkalinity',      name: 'Total alkalinity',       short: 'Alkalinity', unit: 'ppm' },
  { key: 'cyanuricAcid',    name: 'Stabiliser (cyanuric acid)', short: 'Stabiliser', unit: 'ppm' },
  { key: 'calciumHardness', name: 'Calcium hardness',       short: 'Calcium',    unit: 'ppm' },
  { key: 'salt',            name: 'Salt',                   short: 'Salt',       unit: 'ppm' },
  { key: 'phosphates',      name: 'Phosphates',             short: 'Phosphate',  unit: 'ppb' },
  { key: 'tds',             name: 'Total dissolved solids', short: 'TDS',        unit: 'ppm' },
];

export const readingByKey = Object.fromEntries(READINGS.map((r) => [r.key, r]));

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const thousands = (n) => n.toLocaleString('en-AU');

// Active range for one reading. Salt follows the owner's chlorinator,
// calcium follows the surface, TDS allows for the salt in a salt pool.
export function rangeFor(key, ctx = {}, test = {}) {
  const { saltRange, surface, sanitiser } = ctx;
  switch (key) {
    case 'freeChlor': return { lo: 1, hi: 3, target: '1.0–3.0' };
    case 'pH': return { lo: 7.2, hi: 7.6, target: '7.2–7.6' };
    case 'alkalinity': return { lo: 80, hi: 120, target: '80–120' };
    case 'cyanuricAcid': return { lo: 30, hi: 50, target: '30–50' };
    case 'calciumHardness': return calciumBand(surface);
    case 'salt': {
      const r = saltRange || { lo: 3000, hi: 4500 };
      return { lo: r.lo, hi: r.hi, target: `${thousands(r.lo)}–${thousands(r.hi)}` };
    }
    case 'phosphates': return { lo: 0, hi: 200, target: 'under 200' };
    case 'tds': {
      if (isSaltPool(sanitiser)) {
        const salt = num(test.salt);
        const hi = Math.round((salt && salt > 0 ? salt : 4000) + 1500);
        return { lo: 0, hi, target: `under ${thousands(hi)}` };
      }
      return { lo: 0, hi: 2000, target: 'under 2,000' };
    }
    default: return { lo: 0, hi: 0, target: '' };
  }
}

export function stateFor(key, value, ctx, test) {
  const n = num(value);
  if (n == null) return 'none';
  const r = rangeFor(key, ctx, test);
  if (n < r.lo) return 'low';
  if (n > r.hi) return 'high';
  return 'ok';
}

// Readings to show for a test: the core five always, salt for salt pools or
// when measured, phosphates and TDS only when measured.
export function readingRows(test, ctx) {
  const salt = isSaltPool(ctx?.sanitiser);
  return READINGS
    .filter((r) => (r.key !== 'salt' || salt || num(test?.salt) != null))
    .filter((r) => (r.key !== 'phosphates' && r.key !== 'tds') || num(test?.[r.key]) != null)
    .map((r) => ({
      ...r,
      value: num(test?.[r.key]),
      target: rangeFor(r.key, ctx, test).target,
      state: stateFor(r.key, test?.[r.key], ctx, test),
    }));
}

export function formatReading(value, unit) {
  if (value == null || Number.isNaN(value)) return '—';
  const s = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  return unit ? `${s} ${unit}` : s;
}

// Plausible limits for typed readings. Above these it is almost always a typo.
const ENTRY_MAX = {
  freeChlor: 30, totalChlor: 30, pH: 14, alkalinity: 600, cyanuricAcid: 500,
  calciumHardness: 2000, salt: 10000, phosphates: 10000, tds: 20000,
};
const ENTRY_NAME = { ...Object.fromEntries(READINGS.map((r) => [r.key, r.name])), totalChlor: 'Total chlorine' };

// First problem with a typed test, or null when it can be saved.
export function readingProblem(readings) {
  let any = false;
  for (const key of Object.keys(ENTRY_MAX)) {
    const raw = readings?.[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return { key, message: `${ENTRY_NAME[key]} needs to be a number.` };
    if (n < 0) return { key, message: `${ENTRY_NAME[key]} can't be below 0.` };
    if (n > ENTRY_MAX[key]) return { key, message: `${ENTRY_NAME[key]} of ${n} looks too high. Check it and try again.` };
    any = true;
  }
  return any ? null : { key: null, message: 'Enter at least one reading.' };
}

// ── The plan ─────────────────────────────────────────────────

// Correct order to balance a pool: alkalinity buffers pH (first), salt must
// be present before the chlorinator works, chlorine goes in last.
const BALANCE_ORDER = ['alkalinity', 'pH', 'calciumHardness', 'cyanuricAcid', 'salt', 'freeChlor', 'phosphates', 'tds'];

const ACTION_LABEL = {
  pH:              { low: 'Raise pH',                high: 'Lower pH' },
  freeChlor:       { low: 'Raise chlorine',          high: 'Lower chlorine' },
  alkalinity:      { low: 'Raise total alkalinity',  high: 'Lower total alkalinity' },
  cyanuricAcid:    { low: 'Raise stabiliser',        high: 'Lower stabiliser' },
  calciumHardness: { low: 'Raise calcium hardness',  high: 'Lower calcium hardness' },
  salt:            { low: 'Raise salt',              high: 'Lower salt' },
  phosphates:      { low: 'Remove phosphates',       high: 'Remove phosphates' },
  tds:             { low: 'Reduce dissolved solids', high: 'Reduce dissolved solids' },
  shock:           { low: 'Shock to clear chloramines', high: 'Shock to clear chloramines' },
};

const TARGET = { pH: 7.4, alkalinity: 100, cyanuricAcid: 40, calciumHardness: 300 };

function orderNote(key, statuses) {
  const alkOff = statuses.alkalinity === 'low' || statuses.alkalinity === 'high';
  if (key === 'alkalinity') return 'Start here — correct alkalinity first so pH holds steady.';
  if (key === 'pH' && alkOff) return 'Do this after alkalinity, and re-test pH first. It often moves once alkalinity is right.';
  if (key === 'freeChlor') return 'Add chlorine last. It can nudge pH, so re-check pH afterwards.';
  if (key === 'shock') return 'Shock after pH is in range. Chlorine works poorly when pH is high.';
  if (key === 'salt') return 'The chlorinator can only make chlorine once the salt is in range.';
  return null;
}

function interactionNotes(key, state, statuses) {
  const out = [];
  const alkOff = statuses.alkalinity === 'low' || statuses.alkalinity === 'high';
  if (key === 'pH' && state === 'low') {
    if (alkOff) out.push('Balance alkalinity first. Unstable alkalinity makes pH swing, and it often corrects itself.');
    out.push('Soda ash lifts alkalinity a little as well.');
  } else if (key === 'pH' && state === 'high') {
    out.push(statuses.alkalinity === 'high'
      ? 'Acid brings pH and alkalinity down together.'
      : 'Acid lowers alkalinity too. If alkalinity drops, aerate the water to lift pH without more chemicals.');
  } else if (key === 'alkalinity' && state === 'low') {
    out.push('Bicarb nudges pH up a little. Re-test pH before you add acid.');
  } else if (key === 'alkalinity' && state === 'high') {
    out.push('Acid lowers pH as well. Aerate afterwards if pH falls too far.');
  } else if (key === 'freeChlor' && state === 'low') {
    out.push('Liquid chlorine is alkaline and nudges pH up. Granular chlorine also adds calcium.');
  } else if (key === 'cyanuricAcid' && state === 'low') {
    out.push('Stabiliser is mildly acidic and can lower pH slightly as it dissolves.');
  } else if (key === 'salt' && state === 'low') {
    out.push('Undissolved salt on the floor can stain. Brush it until it is gone.');
  }
  return out;
}

export function waitLine(key) {
  switch (key) {
    case 'alkalinity': return 'Run the pump for at least 2 hours, then re-test before the next chemical.';
    case 'pH': return 'Run the pump for about 4 hours. Stay out of the water until you re-test.';
    case 'freeChlor': return 'Stay out for at least 4 hours with the pump running, and until free chlorine is back under 5 ppm.';
    case 'shock': return 'Keep everyone out, run the pump continuously, and re-test in the morning. Swim only once free chlorine is back between 1 and 5 ppm.';
    case 'salt': return 'Brush until you cannot see the salt. Leave the chlorinator at its normal setting until the salt has dissolved.';
    case 'cyanuricAcid': return 'Stabiliser dissolves slowly. Brush it in and give it a day before you re-test.';
    case 'calciumHardness': return 'Dissolve it in a bucket first — the bucket gets hot — then pour it around the pool with the pump running.';
    default: return 'Run the pump and re-test before adding anything else.';
  }
}

// Langelier saturation index from pH, alkalinity, calcium, TDS and the
// month's typical temperature. Ignores stabiliser, and says so.
export function langelier({ pH, calcium, alkalinity, tempC, tds }) {
  if (!(pH > 0 && calcium > 0 && alkalinity > 0 && Number.isFinite(tempC))) return null;
  const t = tds && tds > 0 ? tds : 1000;
  const kelvin = tempC + 273;
  const A = (Math.log10(t) - 1) / 10;
  const B = -13.12 * Math.log10(kelvin) + 34.55;
  const C = Math.log10(calcium) - 0.4;
  const D = Math.log10(alkalinity);
  return Math.round((pH - (9.3 + A + B - (C + D))) * 100) / 100;
}

function lsiView(value) {
  if (value == null) return null;
  const tone = value >= -0.3 && value <= 0.3 ? 'good' : 'warn';
  const label = tone === 'good' ? 'Balanced' : value < -0.3 ? 'Slightly corrosive' : 'Scale-forming';
  return {
    value,
    label,
    tone,
    note: 'From pH, alkalinity, calcium and the month’s typical water temperature. It leaves out stabiliser.',
  };
}

// Swim call for a test. Conservative on purpose: grandchildren swim here.
export function swimVerdict(test, score, season, now = new Date()) {
  if (!test || score == null) {
    return { tone: 'unknown', title: 'No test yet', detail: 'Clear water can still be short of chlorine. Test before anyone gets in.' };
  }
  const fc = num(test.freeChlor);
  const ph = num(test.pH);
  const ageDays = test.createdAt ? (now.getTime() - new Date(test.createdAt).getTime()) / 864e5 : 0;
  const staleAfter = season === 'Winter' ? 14 : season === 'Autumn' ? 10 : 7;
  if (fc != null && fc > 5) return { tone: 'wait', title: 'Wait — chlorine is high', detail: 'Keep everyone out until free chlorine is back under 5 ppm.' };
  if (fc != null && fc < 1) return { tone: 'wait', title: "Don't swim yet", detail: 'Free chlorine is under 1 ppm, so the water is not sanitised.' };
  if (fc == null) return { tone: 'unknown', title: 'Test chlorine before a swim', detail: 'This test has no free chlorine reading, and that is the one that says the water is sanitised.' };
  if (ph != null && (ph < 7.2 || ph > 7.6)) return { tone: 'wait', title: 'Fix pH before a long swim', detail: 'pH outside 7.2–7.6 stings eyes and skin, and it dulls the chlorine.' };
  if (score < 60) return { tone: 'wait', title: 'Hold off swimming', detail: 'The Health Score is in the act-now band. Follow the plan, then re-test.' };
  if (ageDays > staleAfter) return { tone: 'stale', title: 'Test again before swim day', detail: `The last test is ${Math.floor(ageDays)} days old. The numbers may have drifted.` };
  return { tone: 'good', title: 'Safe to swim on these readings', detail: 'Free chlorine and pH are in range. Re-test if the pool has been busy or it has rained.' };
}

function headlineFor(score, rows, swim) {
  if (score == null) return 'Log a water test and this becomes a number you can trust.';
  const off = rows.filter((r) => r.state === 'low' || r.state === 'high').length;
  if (swim.tone === 'wait' && score >= 60) return off === 1 ? 'One reading needs fixing before the next swim.' : 'A few readings need attention before the next swim.';
  if (score >= 80 && off === 0) return 'Your pool is in great shape — every reading we scored is on target.';
  if (score >= 80) return `Your pool is in great shape — ${off === 1 ? 'one small tweak' : `${off} small tweaks`}.`;
  if (score >= 60) return 'A few readings need attention before the next swim.';
  return 'The water needs work before anyone swims.';
}

// Pool hours of pump run for the current season, from the pool profile.
export function pumpHoursFor(pool, season) {
  if (!pool) return null;
  const bySeason = { Summer: pool.pumpHoursSummer, Autumn: pool.pumpHoursAutumn, Winter: pool.pumpHoursWinter, Spring: pool.pumpHoursSpring }[season];
  if (Number(bySeason) > 0) return Number(bySeason);
  if (Number(pool.pumpHoursPerDay) > 0) return Number(pool.pumpHoursPerDay);
  return null;
}

// Everything the plan needs to know about the pool and the month.
export function planContext({ pool, equipment = [], saltRange = null, postcode = null, now = new Date() }) {
  const climate = climateFor(stateFromPostcode(postcode), now);
  return {
    volumeL: Number(pool?.volumeL) > 0 ? Number(pool.volumeL) : 0,
    sanitiser: pool?.sanitiser,
    surface: pool?.surface,
    equipment,
    saltRange,
    climate,
    pumpHours: pumpHoursFor(pool, climate.season),
    chlorinatorOutputPercent: pool?.chlorinatorOutputPercent ?? null,
    chlorinatorCellGPerHour: pool?.chlorinatorCellGPerHour ?? null,
  };
}

function chlorinatorFor(test, ctx, aim) {
  const estimate = estimateChlorinator({
    equipment: ctx.equipment,
    cellGPerHour: ctx.chlorinatorCellGPerHour,
    outputPercent: ctx.chlorinatorOutputPercent,
    hours: ctx.pumpHours,
    tempC: ctx.climate.tempC,
    saltPpm: num(test.salt),
    saltRange: ctx.saltRange,
  });
  return chlorinatorAdvice({
    estimate,
    volumeL: ctx.volumeL,
    deltaPpm: Math.max(0, aim - (num(test.freeChlor) ?? 0)),
    climate: ctx.climate,
  });
}

// The plan for one test. `ctx` comes from planContext().
export function buildPlan(test, ctx, now = new Date()) {
  const kl = ctx.volumeL > 0 ? ctx.volumeL / 1000 : 0;
  const saltPool = isSaltPool(ctx.sanitiser);
  const aim = chlorineAim(ctx.climate);
  const saltMid = ctx.saltRange ? (ctx.saltRange.lo + ctx.saltRange.hi) / 2 : null;
  const statuses = {};
  for (const key of BALANCE_ORDER) statuses[key] = stateFor(key, test?.[key], ctx, test);

  const fc = num(test?.freeChlor);
  const tc = num(test?.totalChlor);
  const combined = fc == null || tc == null ? null : Math.max(0, Math.round((tc - fc) * 100) / 100);
  const needsShock = combined != null && combined >= 0.5;

  const steps = BALANCE_ORDER
    .filter((key) => !(key === 'freeChlor' && needsShock))
    .filter((key) => (key === 'calciumHardness'
      ? includeCalciumInActions(statuses[key], ctx.surface)
      : statuses[key] === 'low' || statuses[key] === 'high'))
    .map((key) => {
      const state = statuses[key];
      const target = key === 'freeChlor' ? aim : TARGET[key];
      const options = doseOptions(key, state, num(test[key]), kl, saltPool, saltMid, target);
      const notes = [orderNote(key, statuses), ...interactionNotes(key, state, statuses)].filter(Boolean);
      if (key === 'freeChlor' && state === 'low' && aim !== 2) {
        notes.unshift(aim > 2
          ? `Aimed at ${aim.toFixed(1)} ppm because UV is typically ${ctx.climate.uv} this month. The acceptable band is still 1–3.`
          : `Aimed at ${aim.toFixed(1)} ppm because the water is cool. The acceptable band is still 1–3.`);
      }
      if (key === 'freeChlor' && state === 'low' && saltPool && options[0] && isChlorinatorStep(options[0].name)) {
        const advice = chlorinatorFor(test, ctx, aim);
        options[0] = { ...options[0], summary: advice.summary };
        notes.push(advice.detail);
      }
      return {
        key,
        state,
        action: ACTION_LABEL[key]?.[state] || key,
        options,
        notes,
        safety: safetyLineFor(key, state),
        wait: waitLine(key),
        volumeKnown: kl > 0,
      };
    });

  if (needsShock) {
    const shockTo = Math.max(10, combined * 10);
    const options = doseOptions('freeChlor', 'low', fc, kl, false, null, shockTo);
    steps.push({
      key: 'shock',
      state: 'low',
      action: ACTION_LABEL.shock.low,
      options,
      notes: [
        orderNote('shock', statuses),
        `Combined chlorine is ${combined} ppm. A shock toward ${shockTo} ppm breaks down chloramines — the cause of the "chlorine smell" and red eyes.`,
      ],
      safety: safetyLineFor('freeChlor', 'low'),
      wait: waitLine('shock'),
      volumeKnown: kl > 0,
    });
  }

  const watchouts = [];
  if (fc != null && statuses.freeChlor === 'ok' && fc < aim - 0.4 && (ctx.climate.uv >= 7 || ctx.climate.season === 'Summer')) {
    watchouts.push('Free chlorine is in range but on the low side for this much sun. A small top-up keeps you ahead of the afternoon.');
  }
  if (combined != null && combined >= 0.2 && combined < 0.5) {
    watchouts.push(`Combined chlorine is ${combined} ppm. If swimmers notice a strong smell or stinging eyes, plan a shock once pH is in range.`);
  }
  if ((num(test?.cyanuricAcid) ?? 0) > 50) {
    watchouts.push('Stabiliser above 50 ppm locks up some of the chlorine. Keep free chlorine toward the top of the range until you can dilute.');
  }
  if (saltPool && fc != null && statuses.freeChlor === 'low' && !needsShock) {
    const d = chlorinatorFor(test, ctx, aim).diagnosis;
    if (d) watchouts.push(d);
  }
  if (!kl) watchouts.push('Add the pool volume in Pool setup to turn these steps into grams and millilitres.');

  // A saved test keeps the score it had when it was logged, like the history.
  const score = test?.healthScore ?? calculateScore(test, ctx.sanitiser, ctx.saltRange, ctx.surface);
  const rows = readingRows(test, ctx);
  const swim = swimVerdict(test, score, ctx.climate.season, now);
  const lsi = lsiView(langelier({
    pH: num(test?.pH),
    calcium: num(test?.calciumHardness),
    alkalinity: num(test?.alkalinity),
    tempC: ctx.climate.tempC,
    tds: num(test?.tds),
  }));

  return {
    steps,
    watchouts,
    swim,
    score,
    rows,
    lsi,
    combined,
    fcAim: aim,
    saltRange: ctx.saltRange,
    headline: headlineFor(score, rows, swim),
    guidance: DOSE_PLAN_GUIDANCE,
  };
}

// ── Logging a different amount ───────────────────────────────

// Grams (or mL) of product per kL that move a reading by one unit. Same
// numbers as dosing.js — used backwards here to say where an amount lands.
const PER_UNIT = {
  'soda ash (sodium carbonate)|pH|low': 60,
  'hydrochloric acid (liquid)|pH|high': 29,
  'dry acid (sodium bisulphate)|pH|high': 38,
  'liquid chlorine (sodium hypochlorite)|freeChlor|low': 8,
  'granular chlorine (calcium hypochlorite)|freeChlor|low': 1.4,
  'liquid chlorine (sodium hypochlorite)|shock|low': 8,
  'granular chlorine (calcium hypochlorite)|shock|low': 1.4,
  'chlorine remover (sodium thiosulphate)|freeChlor|high': 2.5,
  'buffer / bicarb soda (sodium bicarbonate)|alkalinity|low': 1.7,
  'dry acid (sodium bisulphate)|alkalinity|high': 1.9,
  'hydrochloric acid (liquid)|alkalinity|high': 1.6,
  'stabiliser / conditioner (cyanuric acid)|cyanuricAcid|low': 1,
  'calcium chloride (hardness increaser)|calciumHardness|low': 1.5,
  'pool salt|salt|low': 1,
};

const EXPECT_NAME = { pH: 'pH', freeChlor: 'free chlorine', shock: 'free chlorine', alkalinity: 'alkalinity', cyanuricAcid: 'stabiliser', calciumHardness: 'calcium', salt: 'salt' };
const WAIT_SHORT = { alkalinity: '2 hours', pH: '4 hours', freeChlor: '4 hours', shock: 'the morning', cyanuricAcid: 'a day', calciumHardness: 'a few hours', salt: 'once the salt has dissolved' };

export const optionAmount = (o) => (o?.grams > 0 ? o.grams : o?.millilitres > 0 ? o.millilitres : 0);
export const isBuyable = (o) => optionAmount(o) > 0;

// Where a typed amount should land, against the plan amount.
export function differentAmountGuidance({ step, option, amount, test, ctx }) {
  const planned = optionAmount(option);
  if (!(planned > 0) || !(amount > 0)) return null;
  const readingKey = step.key === 'shock' ? 'freeChlor' : step.key;
  const reading = num(test?.[readingKey]);
  const factor = PER_UNIT[`${option.name}|${step.key}|${step.state}`];
  let expected = null;
  if (reading != null && factor && ctx.volumeL > 0) {
    const move = amount / ((ctx.volumeL / 1000) * factor);
    const v = step.state === 'low' ? reading + move : reading - move;
    const value = readingKey === 'pH' ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
    const unit = readingKey === 'pH' ? '' : 'ppm';
    expected = { value, text: unit ? `${value} ${unit}` : String(value) };
  }
  const ratio = amount / planned;
  const big = Math.abs(amount - planned) >= 20;
  const range = rangeFor(readingKey, ctx, test);
  const overTop = expected != null && step.key !== 'shock' && expected.value > range.hi + 1e-9;
  const name = EXPECT_NAME[step.key] ?? 'the level';
  const tail = expected ? ` Expect ${name} of about ${expected.text}.` : '';
  if (ratio < 0.85 && big) return { kind: 'under', text: `That is less than the plan.${tail} Re-test after ${WAIT_SHORT[step.key] ?? 'a few hours'} — you may still be short.` };
  if ((ratio > 1.15 && big) || overTop) {
    return { kind: 'over', text: overTop ? `That may push ${name} a little high (about ${expected.text}).` : `That is more than the plan and may push the level a little high.${tail}` };
  }
  return { kind: 'match', text: expected ? `That matches the plan.${tail}` : 'That is close to the plan amount.' };
}

// "500" + "g" → grams; "1.5" + "L" → millilitres.
export function parseAmount(value, unit) {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === 'g' || unit === 'kg') return { grams: unit === 'kg' ? n * 1000 : n, millilitres: null };
  return { grams: null, millilitres: unit === 'L' ? n * 1000 : n };
}

// Plan amount as a value + unit for the "different amount" form.
export function amountForForm(o) {
  if (o?.grams > 0) return o.grams >= 1000 ? { value: String(Math.round(o.grams / 100) / 10), unit: 'kg' } : { value: String(Math.round(o.grams)), unit: 'g' };
  if (o?.millilitres > 0) return o.millilitres >= 1000 ? { value: String(Math.round(o.millilitres / 100) / 10), unit: 'L' } : { value: String(Math.round(o.millilitres)), unit: 'mL' };
  return { value: '', unit: 'g' };
}

// Short product name for buttons and lists: "liquid chlorine".
export function shortProduct(name) {
  return String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

export function doseLabel(o) {
  if (o?.summary) return o.summary;
  return o?.amount ? `${o.amount} ${shortProduct(o.name)}` : shortProduct(o?.name).replace(/^\w/, (c) => c.toUpperCase());
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
