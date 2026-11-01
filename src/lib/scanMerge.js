// File: src/lib/scanMerge.js
// Merges the readings from several photos of one water test printout.
//
// A printout can run over two pages, so each photo is read on its own and the
// results are combined. Rules, chosen so a second photo can never quietly
// change a number the owner has already seen:
//   - A reading already on screen is kept. A later photo only fills gaps.
//   - If a later photo reads a different number for the same test, the first
//     value stays and the conflict is reported so the owner can check it.
//   - Confidence is the lowest of the photos.

export const SCAN_FIELDS = [
  { ocr: 'free_chlorine',  app: 'freeChlor',       label: 'Free chlorine' },
  { ocr: 'ph',             app: 'pH',              label: 'pH' },
  { ocr: 'alkalinity',     app: 'alkalinity',      label: 'Total alkalinity' },
  { ocr: 'cyanuric_acid',  app: 'cyanuricAcid',    label: 'Cyanuric acid' },
  { ocr: 'calcium',        app: 'calciumHardness', label: 'Calcium hardness' },
  { ocr: 'salt',           app: 'salt',            label: 'Salt' },
  { ocr: 'total_chlorine', app: 'totalChlor',      label: 'Total chlorine' },
];

import { toDateInput } from './testFields.js';

const RANK = { high: 2, medium: 1, low: 0 };

export const blankValues = () => Object.fromEntries(SCAN_FIELDS.map((f) => [f.app, '']));

const has = (v) => v !== null && v !== undefined && v !== '';

// True when the OCR result has at least one reading.
export function hasReadings(readings) {
  return SCAN_FIELDS.some((f) => has(readings?.[f.ocr]));
}

// existing: app-keyed strings already on screen ({} for a fresh scan).
// results: OCR responses ({ readings, confidence, notes }) in photo order.
export function mergeScans(existing, results, existingConfidence = 'high', existingNotes = null) {
  const values = { ...blankValues(), ...(existing || {}) };
  const conflicts = [];
  let confidence = existingConfidence;
  const notes = new Set(existingNotes ? [existingNotes] : []);

  for (const r of results) {
    for (const f of SCAN_FIELDS) {
      const v = r.readings?.[f.ocr];
      if (!has(v)) continue;
      if (!has(values[f.app])) values[f.app] = String(v);
      else if (Number(values[f.app]) !== Number(v) && !conflicts.some((c) => c.app === f.app)) {
        conflicts.push({ app: f.app, label: f.label, kept: values[f.app], other: String(v) });
      }
    }
    const c = r.confidence || 'low';
    if ((RANK[c] ?? 0) < (RANK[confidence] ?? 0)) confidence = c;
    if (r.notes) notes.add(r.notes);
  }

  return { values, confidence, notes: notes.size ? [...notes].join(' ') : null, conflicts };
}

export function conflictMessage(conflicts) {
  if (!conflicts.length) return '';
  const parts = conflicts.map((c) => `${c.label} (${c.kept} kept, another photo says ${c.other})`);
  return `Your photos disagree on ${parts.join('; ')}. Check which one is right.`;
}

// ── Date and pool size printed on the printout ───────────────

const DAY_MS = 24 * 60 * 60 * 1000;

// Merge the date and volume across photos. The first photo to give one wins;
// a later photo that disagrees is reported, never swapped in.
// existing: { testDate, poolVolumeL } already on screen.
export function mergeMeta(existing, results) {
  let testDate = existing?.testDate || null;
  let poolVolumeL = existing?.poolVolumeL || null;
  const conflicts = [];
  for (const r of results) {
    const d = r.test_date || null;
    if (d) {
      if (!testDate) testDate = d;
      else if (d !== testDate && !conflicts.some((c) => c.key === 'testDate')) {
        conflicts.push({ key: 'testDate', message: `Your photos show different test dates (${testDate} and ${d}). Check the date.` });
      }
    }
    const v = r.pool_volume_l || null;
    if (v) {
      if (!poolVolumeL) poolVolumeL = v;
      else if (Math.abs(v - poolVolumeL) / poolVolumeL > 0.01 && !conflicts.some((c) => c.key === 'poolVolumeL')) {
        conflicts.push({ key: 'poolVolumeL', message: `Your photos show different pool sizes (${poolVolumeL.toLocaleString('en-AU')} L and ${v.toLocaleString('en-AU')} L).` });
      }
    }
  }
  return { testDate, poolVolumeL, conflicts };
}

// Whole days from a YYYY-MM-DD date to today on the device's calendar.
export function daysOld(dateStr, now = new Date()) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - then) / DAY_MS));
}

// The printout's pool size against the owner's own (Pool setup). The plan always
// uses Pool setup; this only tells the owner when the two disagree by more than
// 10%, since shops often estimate. Returns '' when there is nothing to say.
export function volumeNotice(printoutL, setupL) {
  if (!printoutL || !setupL) return '';
  const diff = Math.abs(printoutL - setupL) / setupL;
  if (diff <= 0.1) return '';
  const fmt = (n) => Number(n).toLocaleString('en-AU');
  return `The printout says your pool is ${fmt(printoutL)} L, but Pool setup has ${fmt(setupL)} L. Doses use Pool setup. Shops often estimate, so check which is right.`;
}

// A saved test from the same day with the same readings, so a printout scanned
// twice is caught before it becomes two copies. Needs at least two readings in
// common; every reading both have must match.
export function duplicateTest(history, dateStr, values) {
  const keys = SCAN_FIELDS.map((f) => f.app);
  const mine = keys.filter((k) => has(values?.[k]) && Number.isFinite(Number(values[k])));
  if (!dateStr || mine.length < 2) return null;
  return (history || []).find((t) => {
    if (toDateInput(t.createdAt) !== dateStr) return false;
    const shared = mine.filter((k) => t[k] !== null && t[k] !== undefined && t[k] !== '');
    return shared.length >= 2 && shared.every((k) => Number(t[k]) === Number(values[k]));
  }) || null;
}
