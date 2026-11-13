// File: src/lib/shopImport.js
// Import past water tests from a pool shop's CSV export, so an owner can build
// a record that starts before they joined.
//
// Pure functions only: nothing here talks to the network or the database. The
// file is read on the owner's device. Rows that belong to other customers are
// dropped here and are never shown, saved or sent anywhere.
//
// Pool shops export in many shapes, so columns are matched by name (with a
// manual override in the screen), dates are read day/month/year first (the
// Australian way), and every row is checked before it is offered for saving.

import { READING_KEYS, toDateInput, validateReadings } from './testFields.js';

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB of CSV is years of tests for a whole shop
export const MAX_IMPORT_ROWS = 1000;           // tests added in one go
export const SOURCE = 'shop_import';           // allowed by water_tests_source_check, shown as "Past result"

// ── Fields ───────────────────────────────────────────────────

export const IMPORT_FIELDS = [
  { key: 'date',            label: 'Test date',              required: true },
  { key: 'freeChlor',       label: 'Free chlorine' },
  { key: 'pH',              label: 'pH' },
  { key: 'alkalinity',      label: 'Total alkalinity' },
  { key: 'cyanuricAcid',    label: 'Cyanuric acid' },
  { key: 'calciumHardness', label: 'Calcium hardness' },
  { key: 'salt',            label: 'Salt' },
  { key: 'phosphates',      label: 'Phosphates' },
  { key: 'tds',             label: 'Total dissolved solids' },
];

// ── CSV reading ──────────────────────────────────────────────

function sniffDelimiter(text) {
  const first = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== '') || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const c of first) {
    if (c === '"') inQ = !inQ;
    else if (!inQ && c in counts) counts[c] += 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

// Quoted fields, "" for a quote, line breaks inside quotes, a leading BOM,
// and comma, semicolon or tab separated files. Blank lines are dropped.
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const delim = sniffDelimiter(src);
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += c;
    } else if (c === '"' && cell === '') {
      inQ = true;
    } else if (c === delim) {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// ── Column matching ──────────────────────────────────────────

// "Free Chlorine (ppm)" and "Free chlorine ppm" both become "freechlorine".
const norm = (h) => String(h ?? '')
  .replace(/[(\[][^)\]]*[)\]]/g, ' ')
  .toLowerCase()
  .replace(/\b(ppm|ppb|mg\/l|g\/l|gpl)\b/g, ' ')
  .replace(/[^a-z0-9]/g, '');

// The unit a header states, if any: 'ppm' | 'ppb' | 'g/l' | ''.
export function unitHint(header) {
  const h = String(header ?? '').toLowerCase();
  if (/mg\/l|\bppm\b/.test(h)) return 'ppm';
  if (/(^|[^a-z])g\/l|\bgpl\b|kg\/m3|kg\/m³|g per l/.test(h)) return 'g/l';
  if (/\bppb\b|ug\/l|µg\/l/.test(h)) return 'ppb';
  return '';
}

// Most specific name first. A bare "Chlorine" counts as free chlorine only
// when nothing says "free chlorine".
const EXACT = {
  date: ['testdate', 'dateoftest', 'datetested', 'testedon', 'tested', 'sampledate', 'dateofsample', 'visitdate',
    'testingdate', 'watertestdate', 'testdatetime', 'datetime', 'date'],
  freeChlor: ['freechlorine', 'freechlor', 'freecl', 'chlorinefree', 'fc', 'chlorine', 'chlor', 'cl'],
  pH: ['ph', 'phlevel', 'phvalue'],
  alkalinity: ['totalalkalinity', 'alkalinity', 'totalalk', 'talk', 'ta', 'alk'],
  cyanuricAcid: ['cyanuricacid', 'cyanuricacidlevel', 'cyanuric', 'cya', 'stabiliser', 'stabilizer', 'stabiliserlevel',
    'stabilizerlevel', 'conditioner'],
  calciumHardness: ['calciumhardness', 'calhardness', 'calcium', 'hardness', 'ch'],
  salt: ['salt', 'saltlevel', 'salinity', 'nacl'],
  phosphates: ['phosphates', 'phosphate', 'phosphatelevel', 'po4', 'phos'],
  tds: ['totaldissolvedsolids', 'tds'],
};

const CONTAINS = {
  date: /date/,
  freeChlor: /freechlor|freecl/,
  alkalinity: /alkalinity/,
  cyanuricAcid: /cyanuric|stabili[sz]er/,
  calciumHardness: /calcium/,
  salt: /salinity|^salt/,
  phosphates: /phosphate/,
  tds: /dissolvedsolids/,
};
const NOT_A_TEST_DATE = /birth|dob|expir|due|updated|modified|created|next|renew/;

// { date, freeChlor, pH, ... } -> column index or null.
export function guessMapping(headerCells) {
  const names = headerCells.map(norm);
  const used = new Set();
  const mapping = {};
  for (const { key } of IMPORT_FIELDS) {
    let found = -1;
    for (const syn of EXACT[key]) {
      found = names.findIndex((n, i) => n === syn && !used.has(i));
      if (found >= 0) break;
    }
    if (found < 0 && CONTAINS[key]) {
      found = names.findIndex((n, i) => !used.has(i) && CONTAINS[key].test(n) && !(key === 'date' && NOT_A_TEST_DATE.test(n)));
    }
    mapping[key] = found >= 0 ? found : null;
    if (found >= 0) used.add(found);
  }
  return mapping;
}

const readingCount = (m) => READING_KEYS.filter((k) => m[k] != null).length;

// Who a row belongs to. A shop may export every customer in one file.
export function guessCustomerColumns(headerCells) {
  const names = headerCells.map(norm);
  const idx = (list) => names.findIndex((n) => list.includes(n));
  const first = idx(['firstname', 'first', 'givenname', 'forename']);
  const last = idx(['lastname', 'last', 'surname', 'familyname']);
  const full = idx(['customername', 'customer', 'clientname', 'client', 'fullname', 'accountname', 'contactname', 'name']);
  const id = idx(['customerid', 'customerno', 'customernumber', 'customercode', 'custid', 'custno', 'accountno',
    'accountnumber', 'accountid', 'clientid', 'clientno', 'memberid']);
  const email = idx(['emailaddress', 'email']);
  const nameCols = first >= 0 && last >= 0 ? [first, last] : full >= 0 ? [full] : [];
  const idCols = id >= 0 ? [id] : [];
  const emailCols = !nameCols.length && !idCols.length && email >= 0 ? [email] : [];
  return { nameCols, idCols, emailCols };
}

const cellAt = (row, i) => (i == null || i < 0 ? '' : String(row[i] ?? '').trim());

function customerOf(row, cols) {
  const keyCols = [...cols.nameCols, ...cols.idCols, ...cols.emailCols];
  if (!keyCols.length) return null;
  const key = keyCols.map((i) => cellAt(row, i).toLowerCase()).join('|');
  if (!key.replace(/\|/g, '')) return null;
  let label = cols.nameCols.map((i) => cellAt(row, i)).filter(Boolean).join(' ');
  if (!label && cols.idCols.length) label = `Customer ${cellAt(row, cols.idCols[0])}`;
  if (!label) label = cellAt(row, cols.emailCols[0]);
  return { key, label: label.slice(0, 80) };
}

// Customers in the file, biggest history first.
export function listCustomers(rows, cols) {
  const by = new Map();
  for (const row of rows) {
    const c = customerOf(row, cols);
    if (!c) continue;
    const hit = by.get(c.key);
    if (hit) hit.count += 1; else by.set(c.key, { ...c, count: 1 });
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// Reads the CSV text. Titles above the header row are skipped (a row near the
// top that has a date column and at least one reading column is the header).
export function readShopCsv(text) {
  const grid = parseCsv(text);
  if (grid.length < 2) return { error: 'EMPTY' };
  let headerRow = -1;
  let mapping = null;
  for (let i = 0; i < Math.min(grid.length - 1, 10); i++) {
    const m = guessMapping(grid[i]);
    if (m.date != null && readingCount(m) > 0) { headerRow = i; mapping = m; break; }
  }
  const matched = headerRow >= 0;
  if (!matched) { headerRow = 0; mapping = guessMapping(grid[0]); }
  const headers = grid[headerRow].map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`);
  return {
    headers,
    rows: grid.slice(headerRow + 1),
    mapping,
    matched,
    customerCols: guessCustomerColumns(headers),
  };
}

// ── Numbers ──────────────────────────────────────────────────

// -> { value } | { empty: true } | { bad: true }
// "7.4", "2.5 ppm", "3,200" and "7,4" are numbers. "<0.1", "nil" and "n/a" are not.
export function parseNumberCell(raw) {
  let s = String(raw ?? '').trim();
  if (s === '' || /^(-|–|—|n\/?a|nil|nd|none|null)$/i.test(s)) return { empty: true };
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
  const m = s.match(/^([-+]?\d+(?:\.\d+)?)\s*[a-zA-Z/%µ³ ]*$/);
  if (!m) return { bad: true };
  const value = parseFloat(m[1]);
  return Number.isFinite(value) ? { value } : { bad: true };
}

// The app keeps salt in ppm and phosphates in ppb. Convert when the header says otherwise.
function toAppUnit(key, value, header) {
  const unit = unitHint(header);
  if (key === 'salt' && unit === 'g/l') return value * 1000;
  if (key === 'phosphates' && unit === 'ppm') return value * 1000;
  return value;
}

export function unitNote(key, header) {
  const unit = unitHint(header);
  if (key === 'salt' && unit === 'g/l') return 'g/L, saved as ppm';
  if (key === 'phosphates' && unit === 'ppm') return 'ppm, saved as ppb';
  return '';
}

// ── Dates ────────────────────────────────────────────────────

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const SLASH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)(?:[,\s]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?)?/i;
const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/;
const DAY_MON_YEAR = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{4}|\d{2})(?!\d)(?:[,\s]+(\d{1,2}):(\d{2})\s*([ap]m)?)?/i;
const MON_DAY_YEAR = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/;

const fullYear = (y) => {
  const n = Number(y);
  if (String(y).length === 4) return n;
  return n < 70 ? 2000 + n : 1900 + n;
};

function hour24(h, ampm) {
  let n = Number(h);
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (n === 12) n = pm ? 12 : 0; else if (pm) n += 12;
  }
  return n;
}

// 8/10/2025 is 8 October unless the file proves otherwise (a first number
// above 12 means day first; a second number above 12 and no first above 12
// means month first).
export function inferSlashOrder(cells) {
  let dayFirst = false;
  let monthFirst = false;
  for (const raw of cells) {
    const m = String(raw ?? '').trim().match(SLASH);
    if (!m) continue;
    if (Number(m[1]) > 12) dayFirst = true;
    if (Number(m[2]) > 12) monthFirst = true;
  }
  return monthFirst && !dayFirst ? 'mdy' : 'dmy';
}

// -> { y, m, d, h, mi, hasTime } | null
export function parseDateCell(raw, order = 'dmy') {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let y; let m; let d; let h = 12; let mi = 0; let hasTime = false;
  let hit;
  if ((hit = s.match(ISO))) {
    [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
    if (hit[4] !== undefined) { h = Number(hit[4]); mi = Number(hit[5]); hasTime = true; }
  } else if ((hit = s.match(SLASH))) {
    const a = Number(hit[1]); const b = Number(hit[2]);
    [d, m] = order === 'mdy' ? [b, a] : [a, b];
    y = fullYear(hit[3]);
    if (hit[4] !== undefined) { h = hour24(hit[4], hit[6]); mi = Number(hit[5]); hasTime = true; }
  } else if ((hit = s.match(DAY_MON_YEAR))) {
    d = Number(hit[1]); m = MONTHS[hit[2].slice(0, 3).toLowerCase()]; y = fullYear(hit[3]);
    if (hit[4] !== undefined) { h = hour24(hit[4], hit[6]); mi = Number(hit[5]); hasTime = true; }
  } else if ((hit = s.match(MON_DAY_YEAR))) {
    m = MONTHS[hit[1].slice(0, 3).toLowerCase()]; d = Number(hit[2]); y = Number(hit[3]);
  } else if (/^\d{5}(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 60000) {
    // A spreadsheet date saved as a plain number (days since 30 Dec 1899).
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    [y, m, d] = [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  } else {
    return null;
  }
  if (!m || !d || !y || y < 1990 || y > 2100) return null;
  if (h > 23 || mi > 59) { h = 12; mi = 0; hasTime = false; }
  const probe = new Date(y, m - 1, d, h, mi);
  if (Number.isNaN(probe.getTime()) || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null;
  return { y, m, d, h, mi, hasTime };
}

// Same rule as the Add a past result form: no time in the file means midday.
const isoOf = (p) => new Date(p.y, p.m - 1, p.d, p.h, p.mi).toISOString();

// ── Planning an import ───────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100;

// One test = one day and its readings. Used to spot results already saved.
export function testKey(day, t) {
  return [day, ...READING_KEYS.map((k) => (t[k] === null || t[k] === undefined ? '' : round2(Number(t[k]))))].join('|');
}

const tidyProblem = (s) => s.replace(/\s*Check it and try again\.$/, '');

// Turns the file into a list the owner can check before anything is saved.
//   status: 'add' | 'duplicate' | 'skip'
export function planImport({ headers, rows, mapping, customerCols, customerKey = null, existingTests = [], now = new Date() }) {
  const today = toDateInput(now.toISOString());
  const seen = new Set((existingTests || []).map((t) => testKey(toDateInput(t.createdAt), t)));
  const dateCells = mapping.date == null ? [] : rows.map((r) => cellAt(r, mapping.date));
  const order = inferSlashOrder(dateCells);
  const usesSlashDates = dateCells.some((c) => SLASH.test(c));
  const items = [];
  let ignoredCells = 0;

  rows.forEach((row, i) => {
    if (!row.some((c) => String(c ?? '').trim() !== '')) return;
    if (customerKey != null) {
      const c = customerOf(row, customerCols);
      if (!c || c.key !== customerKey) return;
    }
    // Blank and title lines are dropped on the way in, so a row number would not match the
    // owner's spreadsheet. `line` only keeps items apart; `label` is what the owner reads.
    const line = i;
    const dateRaw = cellAt(row, mapping.date).slice(0, 24);
    const parsed = parseDateCell(dateRaw, order);
    const skip = (reason, label) => items.push({ line, status: 'skip', reason, label: label || `${dateRaw}: ${reason}` });

    if (!parsed) {
      return dateRaw
        ? skip(`Date "${dateRaw}" isn't one we can read`, `Date "${dateRaw}" isn't one we can read`)
        : skip('No date', 'A row with no date');
    }
    const day = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    if (day > today) return skip('Dated in the future');

    const test = {};
    const form = {};
    for (const k of READING_KEYS) {
      const col = mapping[k];
      if (col == null) continue;
      const r = parseNumberCell(row[col]);
      if (r.value !== undefined) {
        const v = round2(toAppUnit(k, r.value, headers[col]));
        test[k] = v;
        form[k] = String(v);
      } else if (r.bad) {
        ignoredCells += 1;
      }
    }
    if (!Object.keys(test).length) return skip('No readings on this row');
    const issue = validateReadings(form);
    if (issue) return skip(tidyProblem(issue));

    const key = testKey(day, test);
    const item = {
      line, day,
      test: {
        freeChlor: test.freeChlor ?? null, pH: test.pH ?? null, alkalinity: test.alkalinity ?? null,
        cyanuricAcid: test.cyanuricAcid ?? null, calciumHardness: test.calciumHardness ?? null,
        ...(test.salt !== undefined ? { salt: test.salt } : {}),
        ...(test.phosphates !== undefined ? { phosphates: test.phosphates } : {}),
        ...(test.tds !== undefined ? { tds: test.tds } : {}),
        createdAt: isoOf(parsed),
        source: SOURCE,
      },
    };
    if (seen.has(key)) {
      items.push({ ...item, status: 'duplicate', reason: 'Already in your record' });
    } else {
      seen.add(key);
      items.push({ ...item, status: 'add' });
    }
  });

  const toAdd = items.filter((x) => x.status === 'add').sort((a, b) => a.test.createdAt.localeCompare(b.test.createdAt));
  return {
    items,
    toAdd,
    duplicates: items.filter((x) => x.status === 'duplicate').length,
    skipped: items.filter((x) => x.status === 'skip'),
    ignoredCells,
    order,
    usesSlashDates,
    first: toAdd[0]?.test.createdAt ?? null,
    last: toAdd[toAdd.length - 1]?.test.createdAt ?? null,
    tooMany: toAdd.length > MAX_IMPORT_ROWS,
  };
}

// Which columns were matched, in words, for the "check the columns" panel.
export function mappingSummary(headers, mapping) {
  return IMPORT_FIELDS.map((f) => {
    const col = mapping[f.key];
    return {
      key: f.key,
      label: f.label,
      required: !!f.required,
      column: col == null ? null : col,
      header: col == null ? null : headers[col],
      note: col == null || f.key === 'date' ? '' : unitNote(f.key, headers[col]),
    };
  });
}

// Header names we are not importing, so the owner can see nothing was lost by accident.
export function leftOutHeaders(headers, mapping, customerCols) {
  const used = new Set(Object.values(mapping).filter((v) => v != null));
  const identity = new Set([...customerCols.nameCols, ...customerCols.idCols, ...customerCols.emailCols]);
  return headers.filter((_, i) => !used.has(i) && !identity.has(i));
}

// A small file a pool shop (or the owner) can copy the layout from.
export function exampleCsv() {
  const lines = [
    'Date,Free chlorine (ppm),pH,Total alkalinity (ppm),Cyanuric acid (ppm),Calcium hardness (ppm),Salt (ppm),Phosphates (ppb)',
    '2025-01-14,2.5,7.4,100,40,320,4000,100',
    '2025-02-11,1.5,7.6,90,45,310,3900,200',
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

// Matches the customers list while the owner types their name.
export function filterCustomers(customers, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return customers;
  return customers.filter((c) => c.label.toLowerCase().includes(q));
}
