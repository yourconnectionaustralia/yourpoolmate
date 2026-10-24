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
