// File: src/lib/shed.js
//
// My Shed (chemicals on hand), the shopping list and Costs.
//
// Rules this module keeps:
//   - Every dollar comes from a price the owner typed. Nothing is guessed.
//   - Stock left = what was bought − what doses drew from it. Nothing else
//     stores a running balance, so undoing a dose puts the stock back by itself.
//   - Amounts are canonical: grams for powders, millilitres for liquids.

import { fmtMass, fmtVol } from './dosing.js';
import { optionAmount, shortProduct } from './plan.js';

export const PRODUCTS = [
  { key: 'bicarb', name: 'Bicarb soda (buffer)', short: 'bicarb', dose: ['buffer / bicarb soda (sodium bicarbonate)'], form: 'mass',
    aliases: ['bicarb', 'bicarbonate', 'buffer', 'baking soda', 'alkalinity up', 'alk up'],
    packs: [{ amount: 2, unit: 'kg' }, { amount: 4, unit: 'kg' }, { amount: 25, unit: 'kg' }] },
  { key: 'soda_ash', name: 'Soda ash (pH up)', short: 'soda ash', dose: ['soda ash (sodium carbonate)'], form: 'mass',
    aliases: ['soda ash', 'ph up', 'ph increaser', 'sodium carbonate'],
    packs: [{ amount: 2, unit: 'kg' }, { amount: 4, unit: 'kg' }] },
  { key: 'hcl', name: 'Hydrochloric acid', short: 'hydrochloric acid', dose: ['hydrochloric acid (liquid)'], form: 'volume',
    aliases: ['hydrochloric', 'hcl', 'muriatic', 'spirit of salt', 'pool acid', 'liquid acid'],
    packs: [{ amount: 2.5, unit: 'L' }, { amount: 5, unit: 'L' }, { amount: 15, unit: 'L' }] },
  { key: 'dry_acid', name: 'Dry acid (pH down)', short: 'dry acid', dose: ['dry acid (sodium bisulphate)'], form: 'mass',
    aliases: ['dry acid', 'bisulphate', 'bisulfate', 'ph down', 'ph reducer'],
    packs: [{ amount: 2, unit: 'kg' }, { amount: 4, unit: 'kg' }] },
  { key: 'liquid_chlorine', name: 'Liquid chlorine', short: 'liquid chlorine', dose: ['liquid chlorine (sodium hypochlorite)'], form: 'volume',
    aliases: ['liquid chlorine', 'sodium hypochlorite', 'liquid hypo', 'liq chlor', 'liquid pool chlorine'],
    packs: [{ amount: 5, unit: 'L' }, { amount: 15, unit: 'L' }] },
  { key: 'cal_hypo', name: 'Granular chlorine', short: 'granular chlorine', dose: ['granular chlorine (calcium hypochlorite)'], form: 'mass',
    aliases: ['granular chlorine', 'cal hypo', 'calcium hypochlorite', 'gran chlor', 'pool chlorine granules', 'shock'],
    packs: [{ amount: 2, unit: 'kg' }, { amount: 4, unit: 'kg' }, { amount: 10, unit: 'kg' }] },
  { key: 'thio', name: 'Chlorine remover', short: 'chlorine remover', dose: ['chlorine remover (sodium thiosulphate)'], form: 'mass',
    aliases: ['chlorine remover', 'thiosulphate', 'thiosulfate', 'dechlor', 'chlorine neutraliser'],
    packs: [{ amount: 1, unit: 'kg' }, { amount: 2, unit: 'kg' }] },
  { key: 'stabiliser', name: 'Stabiliser (cyanuric acid)', short: 'stabiliser', dose: ['stabiliser / conditioner (cyanuric acid)'], form: 'mass',
    aliases: ['stabiliser', 'stabilizer', 'cyanuric', 'conditioner', 'cya', 'sunscreen'],
    packs: [{ amount: 2, unit: 'kg' }, { amount: 4, unit: 'kg' }] },
  { key: 'calcium', name: 'Calcium chloride', short: 'calcium chloride', dose: ['calcium chloride (hardness increaser)'], form: 'mass',
    aliases: ['calcium chloride', 'hardness increaser', 'calcium increaser', 'cal chloride'],
    packs: [{ amount: 2, unit: 'kg' }, { amount: 4, unit: 'kg' }] },
  { key: 'salt', name: 'Pool salt', short: 'pool salt', dose: ['pool salt'], form: 'mass',
    aliases: ['pool salt', 'swimming pool salt', 'salt'],
    packs: [{ amount: 20, unit: 'kg' }] },
];

export const productByKey = (key) => PRODUCTS.find((p) => p.key === key) ?? null;

// Which product a dose option (by its plan name) uses.
export const productKeyForDose = (name) => PRODUCTS.find((p) => p.dose.includes(name))?.key ?? null;

// Best guess at a product from free text, e.g. a receipt line. Longest alias
// wins, so "pool salt" beats "salt" and "liquid chlorine" beats "chlorine".
export function matchProduct(text) {
  const t = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  if (!t.trim()) return null;
  let best = null;
  let bestLen = 0;
  for (const p of PRODUCTS) {
    for (const a of [p.short, p.name.toLowerCase(), ...p.aliases]) {
      const alias = a.replace(/[^a-z0-9]+/g, ' ').trim();
      if (alias && t.includes(` ${alias} `) && alias.length > bestLen) {
        best = p;
        bestLen = alias.length;
      }
    }
  }
  return best;
}

export const UNITS = { mass: ['g', 'kg'], volume: ['mL', 'L'] };

export const toCanonical = (amount, unit) => (unit === 'kg' || unit === 'L' ? amount * 1000 : amount);

export function formatCanonical(amount, form) {
  if (form === 'volume') return amount >= 1000 ? `${trim1(amount / 1000)} L` : `${Math.round(amount)} mL`;
  return amount >= 1000 ? `${trim1(amount / 1000)} kg` : `${Math.round(amount)} g`;
}

// The amount a plan option prints, for use as a canonical quantity.
export const formatPlanAmount = (amount, form) => (form === 'volume' ? fmtVol(amount) : fmtMass(amount)) ?? formatCanonical(amount, form);

export const itemTotal = (item) => toCanonical(Number(item.packAmount) || 0, item.packUnit) * Math.max(1, Number(item.packs) || 1);

export const hasPrice = (item) => typeof item.priceAud === 'number' && item.priceAud > 0;

// How much each shed item has drawn against it across every dose.
function drawsByItem(doses) {
  const m = new Map();
  for (const d of doses || []) {
    for (const draw of d.shedDraw || []) {
      m.set(draw.itemId, (m.get(draw.itemId) ?? 0) + (Number(draw.amount) || 0));
    }
  }
  return m;
}

// Shed items with what is left in each, oldest first (first in, first used).
export function shedWithStock(items, doses) {
  const used = drawsByItem(doses);
  return [...(items || [])]
    .map((item) => {
      const total = itemTotal(item);
      const remaining = Math.max(0, Math.round((total - (used.get(item.id) ?? 0)) * 100) / 100);
      return { ...item, total, remaining, ratio: total > 0 ? remaining / total : 0 };
    })
    .sort((a, b) => String(a.boughtAt || '').localeCompare(String(b.boughtAt || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export const remainingFor = (stock, productKey) => stock.filter((s) => s.productKey === productKey).reduce((sum, s) => sum + s.remaining, 0);

// Take `amount` of the dose's product out of the shed, oldest first.
// Returns the draws to store on the dose, and its cost from typed prices
// (null when nothing drawn had a price).
export function drawForDose(stock, doseName, amount) {
  const key = productKeyForDose(doseName);
  if (!key || !(amount > 0)) return { draws: [], costAud: null, shortBy: 0 };
  let left = amount;
  const draws = [];
  let cents = 0;
  let priced = false;
  for (const s of stock) {
    if (s.productKey !== key || s.remaining <= 0 || left <= 0) continue;
    const take = Math.min(s.remaining, left);
    left -= take;
    draws.push({ itemId: s.id, amount: Math.round(take * 100) / 100 });
    if (hasPrice(s) && s.total > 0) {
      cents += Math.round((take * s.priceAud * 100) / s.total);
      priced = true;
    }
  }
  // Anything the shed did not cover is priced from the newest typed price for
  // that product, if there is one.
  if (left > 0) {
    const unit = latestUnitPrice(stock, key);
    if (unit) {
      cents += Math.round(left * unit * 100);
      priced = true;
    }
  }
  return { draws, costAud: priced ? cents / 100 : null, shortBy: Math.max(0, Math.round(left * 100) / 100) };
}

// Dollars per gram (or mL) from the newest purchase with a typed price.
export function latestUnitPrice(items, productKey) {
  const priced = (items || [])
    .filter((s) => s.productKey === productKey && hasPrice(s) && itemTotal(s) > 0)
    .sort((a, b) => String(b.boughtAt || '').localeCompare(String(a.boughtAt || '')));
  return priced.length ? priced[0].priceAud / itemTotal(priced[0]) : null;
}

export function enoughInShed(stock, doseName, amount) {
  const key = productKeyForDose(doseName);
  return Boolean(key) && amount > 0 && remainingFor(stock, key) + 1e-6 >= amount;
}

// Products running out: under three weeks left at the owner's own pace.
export function lowStock(stock, doses, now = new Date()) {
  const out = [];
  for (const key of [...new Set(stock.map((s) => s.productKey))]) {
    const left = remainingFor(stock, key);
    const p = productByKey(key);
    if (!p || left <= 0) continue;
    const uses = (doses || [])
      .filter((d) => productKeyForDose(d.product) === key)
      .map((d) => ({ at: new Date(d.date).getTime(), amount: (d.shedDraw?.length ? d.shedDraw.reduce((a, b) => a + b.amount, 0) : Number(d.grams || d.millilitres) || 0) }))
      .filter((u) => Number.isFinite(u.at) && u.amount > 0)
      .sort((a, b) => a.at - b.at);
    if (!uses.length) continue;
    const days = Math.max(7, (now.getTime() - uses[0].at) / 864e5);
    const perWeek = (uses.reduce((a, b) => a + b.amount, 0) / days) * 7;
    const weeks = perWeek > 0 ? left / perWeek : null;
    if (weeks != null && weeks <= 3) {
      out.push({ key, name: p.short, weeksLeft: Math.round(weeks * 10) / 10, remaining: left, label: formatCanonical(left, p.form) });
    }
  }
  return out;
}

// The newest pack size the owner bought for a product, to round a shopping
// list item up to whole packs.
export function ownerPack(items, productKey) {
  const mine = (items || []).filter((s) => s.productKey === productKey && Number(s.packAmount) > 0);
  if (!mine.length) return null;
  const newest = [...mine].sort((a, b) => String(b.boughtAt || '').localeCompare(String(a.boughtAt || '')))[0];
  return { amount: Number(newest.packAmount), unit: newest.packUnit };
}

// How much to buy for `need` (canonical), rounded to the owner's pack size
// when we know it.
export function buyQuantity(need, form, pack) {
  if (!(need > 0)) return { quantity: 0, label: 'As the label says', packs: null };
  if (!pack) return { quantity: Math.round(need * 100) / 100, label: formatPlanAmount(need, form), packs: null };
  const size = toCanonical(pack.amount, pack.unit);
  if (!(size > 0)) return { quantity: need, label: formatPlanAmount(need, form), packs: null };
  const packs = Math.max(1, Math.ceil(need / size - 1e-9));
  return { quantity: packs * size, label: `${packs} × ${trim1(pack.amount)} ${pack.unit}`, packs };
}

// Short name for any shopping or dose product.
export const productName = (productKey, fallback) => productByKey(productKey)?.short ?? shortProduct(fallback);

// What this plan needs from the shop: for each step still to do, the first
// option with an amount, less what the shed already holds.
export function planShortfall({ plan, stock, doneKeys = new Set(), testId = null }) {
  const out = [];
  for (const step of plan?.steps || []) {
    if (doneKeys.has(step.key)) continue;
    // A free first choice (turn the chlorinator up, let the sun take it)
    // means nothing needs buying for this step.
    if (step.options[0] && !(optionAmount(step.options[0]) > 0)) continue;
    const option = step.options.find((o) => optionAmount(o) > 0);
    if (!option) continue;
    const key = productKeyForDose(option.name);
    const need = optionAmount(option);
    const have = key ? remainingFor(stock, key) : 0;
    const short = Math.max(0, Math.round((need - have) * 100) / 100);
    const form = option.grams > 0 ? 'mass' : 'volume';
    const pack = key ? ownerPack(stock, key) : null;
    out.push({
      stepKey: step.key,
      stepTitle: step.action,
      testId,
      product: option.name,
      productKey: key,
      form,
      need,
      have,
      short,
      covered: short <= 0,
      buy: short > 0 ? buyQuantity(short, form, pack) : null,
    });
  }
  return out;
}

// Dollars for a shopping item from the owner's own last price, or null.
export function shopEstimate(item, items) {
  if (!item.productKey || !(item.quantity > 0)) return null;
  const unit = latestUnitPrice(items, item.productKey);
  return unit ? Math.round(item.quantity * unit * 100) / 100 : null;
}

// Plain text of the list, for sharing to a phone's messages.
export function shopListText(list, title = 'Pool shopping list') {
  const needed = (list || []).filter((i) => i.status !== 'bought');
  if (!needed.length) return `${title}\nNothing to buy.`;
  return `${title}\n${needed.map((i) => `• ${i.quantityLabel ? `${i.quantityLabel} ` : ''}${productName(i.productKey, i.product)}${i.stepTitle ? ` — ${i.stepTitle}` : ''}`).join('\n')}`;
}

// ── Costs ────────────────────────────────────────────────────

export const PERIODS = {
  '30d': { label: '30 days', days: 30, bucket: 'week' },
  '90d': { label: '90 days', days: 90, bucket: 'week' },
  '12m': { label: '12 months', days: 365, bucket: 'month' },
};

const inWindow = (iso, w) => {
  const t = new Date(iso).getTime();
  return t > w.start.getTime() && t <= w.end.getTime();
};

// `offset` steps back whole periods (0 = the one ending now).
export function periodWindow(period, offset = 0, now = new Date()) {
  const len = PERIODS[period].days * 864e5;
  const end = new Date(now.getTime() - offset * len);
  const start = new Date(end.getTime() - len);
  const fmt = (d) => new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', ...(period === '12m' ? { year: 'numeric' } : {}),
  }).format(d);
  return {
    current: { start, end },
    previous: { start: new Date(start.getTime() - len), end: start },
    label: offset === 0 ? `Last ${PERIODS[period].label}` : `${fmt(start)} – ${fmt(end)}`,
  };
}

export const isDoseEvent = (e) => e?.type === 'dose';

export function doseCost(dose) {
  return typeof dose.costAud === 'number' && dose.costAud > 0 ? dose.costAud : null;
}

const isFreeDose = (d) => /chlorinator|sunlight|reduce naturally/i.test(d.product || d.title || '');

export function spendTotal(events, w) {
  let cents = 0;
  let doses = 0;
  let free = 0;
  let unpriced = 0;
  for (const d of (events || []).filter((e) => isDoseEvent(e) && inWindow(e.date, w))) {
    doses += 1;
    const c = doseCost(d);
    if (c) cents += Math.round(c * 100);
    else if (isFreeDose(d)) free += 1;
    else unpriced += 1;
  }
  return { aud: cents / 100, doses, free, unpriced };
}

export function spendBreakdown(events, w) {
  const m = new Map();
  for (const d of (events || []).filter((e) => isDoseEvent(e) && inWindow(e.date, w))) {
    const c = doseCost(d) ?? 0;
    const name = d.product ? (isFreeDose(d) ? 'Chlorinator and other free steps' : productName(productKeyForDose(d.product), d.product)) : d.title;
    const row = m.get(name) ?? { name, aud: 0, doses: 0 };
    row.aud = Math.round((row.aud + c) * 100) / 100;
    row.doses += 1;
    m.set(name, row);
  }
  return [...m.values()].sort((a, b) => b.aud - a.aud || b.doses - a.doses);
}

export function spendBuckets(events, period, w) {
  const starts = [];
  if (PERIODS[period].bucket === 'week') {
    for (let t = w.start.getTime(); t < w.end.getTime(); t += 7 * 864e5) starts.push(new Date(t));
  } else {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(w.end);
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(d.getUTCMonth() - i);
      starts.push(d);
    }
  }
  return starts.map((start, i) => {
    const end = i < starts.length - 1 ? starts[i + 1] : w.end;
    const inside = (events || []).filter((e) => {
      if (!isDoseEvent(e)) return false;
      const t = new Date(e.date).getTime();
      return t >= start.getTime() && (i === starts.length - 1 ? t <= end.getTime() : t < end.getTime());
    });
    return {
      label: PERIODS[period].bucket === 'week'
        ? new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short' }).format(start)
        : new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'short' }).format(start),
      aud: inside.reduce((a, e) => a + Math.round((doseCost(e) ?? 0) * 100), 0) / 100,
      doses: inside.length,
    };
  });
}

// Score summary for a window, for Insights and the home teaser.
export function scoreSummary(tests, w, prev) {
  const pts = (win) => (tests || []).filter((t) => t.healthScore != null && inWindow(t.createdAt, win));
  const now = pts(w);
  const before = prev ? pts(prev) : [];
  const avg = (list) => (list.length ? Math.round(list.reduce((a, t) => a + t.healthScore, 0) / list.length) : null);
  const average = avg(now);
  const previousAverage = avg(before);
  return {
    tests: now.length,
    average,
    previousAverage,
    latest: now.length ? now[now.length - 1].healthScore : null,
    best: now.length ? Math.max(...now.map((t) => t.healthScore)) : null,
    greenShare: now.length ? Math.round((now.filter((t) => t.healthScore >= 80).length / now.length) * 100) : null,
    change: average != null && previousAverage != null ? average - previousAverage : null,
  };
}

// Longest gap between tests inside a window, in days.
export function testingRhythm(tests, w) {
  const times = (tests || []).filter((t) => inWindow(t.createdAt, w)).map((t) => new Date(t.createdAt).getTime()).sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < times.length; i += 1) gap = Math.max(gap, Math.round((times[i] - times[i - 1]) / 864e5));
  return { count: times.length, longestGapDays: gap };
}

export function formatAud(n) {
  const v = Math.round(n * 100) / 100;
  const cents = Math.round(v * 100) % 100 !== 0;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 }).format(v);
}

function trim1(n) {
  return (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');
}
