// The phone's bottom bar: three places the owner chooses, with Test fixed
// in the middle and More fixed on the right. Slots are [left, second, right].

export const NAV_OPTIONS = [
  { view: 'health',    label: 'Home',      long: 'Home (Health Score)' },
  { view: 'plan',      label: 'Plan',      long: 'Plan' },
  { view: 'history',   label: 'History',   long: 'History (chemistry log)' },
  { view: 'chat',      label: 'Ask Mate',  long: 'Ask Mate' },
  { view: 'shed',      label: 'Shed',      long: 'My Shed' },
  { view: 'shop',      label: 'Shopping',  long: 'Shopping list' },
  { view: 'costs',     label: 'Costs',     long: 'Costs' },
  { view: 'fixer',     label: 'Fixer',     long: 'Problem fixer' },
  { view: 'schedule',  label: 'Seasons',   long: 'Seasonal tips' },
  { view: 'setup',     label: 'Setup',     long: 'Pool setup' },
  { view: 'equipment', label: 'Equipment', long: 'Equipment' },
  { view: 'profile',   label: 'Profile',   long: 'Profile' },
];

export const DEFAULT_NAV = ['health', 'plan', 'history'];
export const SLOT_COUNT = 3;

const known = new Set(NAV_OPTIONS.map((o) => o.view));

export function navOption(view) {
  return NAV_OPTIONS.find((o) => o.view === view) ?? null;
}

// Three different, known views. Anything missing or repeated is filled from
// the defaults, then the rest of the list, so the bar is always full.
export function cleanNav(raw) {
  const out = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (known.has(v) && !out.includes(v)) out.push(v);
    if (out.length === SLOT_COUNT) return out;
  }
  for (const v of [...DEFAULT_NAV, ...NAV_OPTIONS.map((o) => o.view)]) {
    if (out.length === SLOT_COUNT) break;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

// Put a view in a slot. If it is already in another slot, the two swap, so a
// view never shows twice.
export function setSlot(nav, index, view) {
  const next = cleanNav(nav);
  if (!known.has(view) || index < 0 || index >= SLOT_COUNT) return next;
  const from = next.indexOf(view);
  if (from === index) return next;
  if (from >= 0) next[from] = next[index];
  next[index] = view;
  return next;
}

export function sameNav(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
