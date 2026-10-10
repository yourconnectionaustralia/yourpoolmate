// Shared description of the water test form: which fields exist, how typed
// text becomes readings, and what counts as a believable reading.
// Used by the Tests page (new test) and the test editor (edit / add a past result).

export function testFormFields(saltPool, saltRange) {
  return [
    { key: 'freeChlor',       label: 'Free chlorine',    unit: 'ppm', placeholder: '1.0–3.0' },
    { key: 'pH',              label: 'pH',               unit: '',    placeholder: '7.2–7.6' },
    { key: 'alkalinity',      label: 'Total alkalinity', unit: 'ppm', placeholder: '80–120' },
    { key: 'cyanuricAcid',    label: 'Cyanuric acid',    unit: 'ppm', placeholder: '30–50' },
    { key: 'calciumHardness', label: 'Calcium hardness', unit: 'ppm', placeholder: '200–400' },
    ...(saltPool ? [{ key: 'salt', label: 'Salt', unit: 'ppm', placeholder: saltRange ? `${saltRange.lo}–${saltRange.hi}` : '3000–4500' }] : []),
    { key: 'phosphates', label: 'Phosphates', unit: 'ppb', placeholder: 'optional' },
    { key: 'tds',        label: 'Total dissolved solids', unit: 'ppm', placeholder: 'optional' },
  ];
}

export const READING_KEYS = ['freeChlor', 'pH', 'alkalinity', 'cyanuricAcid', 'calciumHardness', 'salt', 'phosphates', 'tds'];

export const EMPTY_TEST_FORM = Object.fromEntries(READING_KEYS.map(k => [k, '']));

// Largest believable value for each reading. A typo like 72 for pH is caught
// before it reaches the record.
const MAX_READING = {
  freeChlor: 30, pH: 14, alkalinity: 600, cyanuricAcid: 500,
  calciumHardness: 2000, salt: 10000, phosphates: 10000, tds: 20000,
};

const READING_LABEL = {
  freeChlor: 'Free chlorine', pH: 'pH', alkalinity: 'Total alkalinity', cyanuricAcid: 'Cyanuric acid',
  calciumHardness: 'Calcium hardness', salt: 'Salt', phosphates: 'Phosphates', tds: 'Total dissolved solids',
};

export const parseReading = (s) => {
  if (s === null || s === undefined || s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

// Form strings for an existing test. Untested readings are blank, not 0.
export function formFromTest(test) {
  const form = { ...EMPTY_TEST_FORM };
  for (const k of READING_KEYS) {
    if (test?.[k] !== null && test?.[k] !== undefined) form[k] = String(test[k]);
  }
  return form;
}

// Form strings back to readings. Untested fields stay null so the Health
// Score skips them instead of scoring a 0.
export function testFromForm(form) {
  const out = {};
  for (const k of READING_KEYS) {
    const optional = k === 'salt' || k === 'phosphates' || k === 'tds';
    const v = parseReading(form[k]);
    if (optional) { if (form[k] !== '' && form[k] !== undefined) out[k] = v; }
    else out[k] = v;
  }
  return out;
}

// Returns a plain-words problem, or null when the readings can be saved.
export function validateReadings(form) {
  let any = false;
  for (const k of READING_KEYS) {
    const raw = form[k];
    if (raw === '' || raw === undefined || raw === null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${READING_LABEL[k]} needs to be a number.`;
    if (n < 0) return `${READING_LABEL[k]} can't be below 0.`;
    if (n > MAX_READING[k]) return `${READING_LABEL[k]} of ${raw} looks too high. Check it and try again.`;
    any = true;
  }
  return any ? null : 'Enter at least one reading.';
}

const pad = (n) => String(n).padStart(2, '0');

// YYYY-MM-DD on the device's calendar, for <input type="date">.
export function toDateInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Keep the original time of day when the owner didn't change the date.
// A new date is stored at midday so it never slips across a day boundary.
export function isoFromDateInput(dateStr, originalIso) {
  if (!dateStr) return originalIso || new Date().toISOString();
  if (originalIso && toDateInput(originalIso) === dateStr) return originalIso;
  return new Date(`${dateStr}T12:00:00`).toISOString();
}
