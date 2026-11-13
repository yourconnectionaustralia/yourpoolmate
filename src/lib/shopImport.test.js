import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exampleCsv, filterCustomers, guessMapping, inferSlashOrder, leftOutHeaders, listCustomers, mappingSummary,
  parseCsv, parseDateCell, parseNumberCell, planImport, readShopCsv, unitHint, MAX_IMPORT_ROWS,
} from './shopImport.js';
import { buildRecord, testsCsv } from './recordExport.js';
import { toDateInput } from './testFields.js';

const NOW = new Date('2026-11-12T10:00:00');
const plan = (csv, extra = {}) => {
  const f = readShopCsv(csv);
  return { f, p: planImport({ ...f, existingTests: [], now: NOW, ...extra }) };
};

// ── CSV reading ──────────────────────────────────────────────

test('parseCsv: quotes, embedded commas, quote escapes and line breaks inside quotes', () => {
  const rows = parseCsv('a,b,c\r\n"1,5","say ""hi""","line\nbreak"\r\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1,5', 'say "hi"', 'line\nbreak']]);
});

test('parseCsv: byte order mark, blank lines, semicolons and tabs', () => {
  assert.deepEqual(parseCsv('﻿x;y\n\n1;2\n'), [['x', 'y'], ['1', '2']]);
  assert.deepEqual(parseCsv('x\ty\n1\t2'), [['x', 'y'], ['1', '2']]);
});

test('parseCsv: a quote in the middle of a field is kept as text', () => {
  assert.deepEqual(parseCsv('a,b\n5" pipe,ok'), [['a', 'b'], ['5" pipe', 'ok']]);
});

// ── Column matching ──────────────────────────────────────────

test('guessMapping: the app\'s own export headers', () => {
  const m = guessMapping(['Date', 'Free chlorine (ppm)', 'pH', 'Total alkalinity (ppm)', 'Cyanuric acid (ppm)',
    'Calcium hardness (ppm)', 'Salt (ppm)', 'Phosphates (ppb)', 'TDS (ppm)', 'Health score', 'Source']);
  assert.deepEqual(m, { date: 0, freeChlor: 1, pH: 2, alkalinity: 3, cyanuricAcid: 4, calciumHardness: 5, salt: 6, phosphates: 7, tds: 8 });
});

test('guessMapping: short shop names', () => {
  const m = guessMapping(['Test Date', 'FC', 'pH', 'TA', 'CYA', 'CH', 'Salinity', 'PO4']);
  assert.deepEqual(m, { date: 0, freeChlor: 1, pH: 2, alkalinity: 3, cyanuricAcid: 4, calciumHardness: 5, salt: 6, phosphates: 7, tds: null });
});

test('guessMapping: total chlorine is never read as free chlorine; a bare Chlorine is', () => {
  assert.equal(guessMapping(['Date', 'Total Chlorine', 'pH']).freeChlor, null);
  assert.equal(guessMapping(['Date', 'Chlorine', 'Total Chlorine', 'pH']).freeChlor, 1);
  assert.equal(guessMapping(['Date', 'Chlorine', 'Free Chlorine', 'pH']).freeChlor, 2);
});

test('guessMapping: other dates in the file are not the test date', () => {
  const m = guessMapping(['Customer', 'Date of Birth', 'Next Test Due', 'Tested', 'pH']);
  assert.equal(m.date, 3);
});

test('unitHint', () => {
  assert.equal(unitHint('Salt (g/L)'), 'g/l');
  assert.equal(unitHint('Salt mg/L'), 'ppm');
  assert.equal(unitHint('Phosphates (ppb)'), 'ppb');
  assert.equal(unitHint('Phosphate ppm'), 'ppm');
  assert.equal(unitHint('pH'), '');
});

test('readShopCsv: skips title lines above the header', () => {
  const f = readShopCsv('Pool Shop Pty Ltd\nWater test history\n\nDate,FC,pH\n1/10/2025,2,7.4\n');
  assert.equal(f.matched, true);
  assert.deepEqual(f.headers, ['Date', 'FC', 'pH']);
  assert.equal(f.rows.length, 1);
});

test('readShopCsv: no usable header comes back unmatched so the owner can pick columns', () => {
  const f = readShopCsv('a,b,c\n1,2,3\n');
  assert.equal(f.matched, false);
  assert.equal(f.mapping.date, null);
  assert.deepEqual(readShopCsv('only one line'), { error: 'EMPTY' });
});

// ── Numbers and dates ────────────────────────────────────────

test('parseNumberCell', () => {
  assert.deepEqual(parseNumberCell('7.4'), { value: 7.4 });
  assert.deepEqual(parseNumberCell('0'), { value: 0 });
  assert.deepEqual(parseNumberCell(' 2.5 ppm '), { value: 2.5 });
  assert.deepEqual(parseNumberCell('3,200'), { value: 3200 });
  assert.deepEqual(parseNumberCell('7,4'), { value: 7.4 });
  for (const e of ['', '-', 'N/A', 'nil']) assert.deepEqual(parseNumberCell(e), { empty: true });
  for (const b of ['<0.1', '>50', 'high', '7.4.1']) assert.deepEqual(parseNumberCell(b), { bad: true });
});

test('parseDateCell: day/month/year first, ISO, words and spreadsheet numbers', () => {
  const ymd = (p) => p && `${p.y}-${p.m}-${p.d}`;
  assert.equal(ymd(parseDateCell('8/10/2025')), '2025-10-8');
  assert.equal(ymd(parseDateCell('8/10/25')), '2025-10-8');
  assert.equal(ymd(parseDateCell('8-10-2025')), '2025-10-8');
  assert.equal(ymd(parseDateCell('8/10/2025', 'mdy')), '2025-8-10');
  assert.equal(ymd(parseDateCell('2025-10-08')), '2025-10-8');
  assert.equal(ymd(parseDateCell('2025-10-08T14:30:00Z')), '2025-10-8');
  assert.equal(ymd(parseDateCell('8 Oct 2025')), '2025-10-8');
  assert.equal(ymd(parseDateCell('08-Oct-25')), '2025-10-8');
  assert.equal(ymd(parseDateCell('October 8, 2025')), '2025-10-8');
  assert.equal(ymd(parseDateCell('45658')), '2025-1-1');   // 1 Jan 2025 as a spreadsheet number
  assert.equal(ymd(parseDateCell('45938')), '2025-10-8');
});

test('parseDateCell: times, midday default and impossible dates', () => {
  const t = parseDateCell('8/10/2025 2:30 PM');
  assert.deepEqual([t.h, t.mi, t.hasTime], [14, 30, true]);
  const noon = parseDateCell('8/10/2025');
  assert.deepEqual([noon.h, noon.mi, noon.hasTime], [12, 0, false]);
  assert.equal(parseDateCell('12:05 AM 8/10/2025'), null);
  assert.equal(parseDateCell('31/02/2025'), null);
  assert.equal(parseDateCell('32/01/2025'), null);
  assert.equal(parseDateCell('yesterday'), null);
  assert.equal(parseDateCell(''), null);
  assert.equal(parseDateCell('1/1/1985'), null);
});

test('inferSlashOrder: day first unless the file proves month first', () => {
  assert.equal(inferSlashOrder(['8/10/2025', '9/10/2025']), 'dmy');
  assert.equal(inferSlashOrder(['10/8/2025', '10/25/2025']), 'mdy');
  assert.equal(inferSlashOrder(['25/10/2025', '10/25/2025']), 'dmy');
  assert.equal(inferSlashOrder(['2025-10-08']), 'dmy');
});

// ── Planning ─────────────────────────────────────────────────

test('planImport: a clean file is added oldest first, with midday times and source shop_import', () => {
  const { p } = plan('Date,FC,pH,TA,CYA,CH\n14/10/2025,2.5,7.4,100,40,320\n2/9/2025,1,7.8,90,35,300\n');
  assert.equal(p.toAdd.length, 2);
  assert.equal(p.skipped.length, 0);
  assert.equal(toDateInput(p.toAdd[0].test.createdAt), '2025-09-02');
  assert.equal(toDateInput(p.toAdd[1].test.createdAt), '2025-10-14');
  assert.equal(new Date(p.toAdd[0].test.createdAt).getHours(), 12);
  assert.equal(p.toAdd[0].test.source, 'shop_import');
  assert.equal(p.usesSlashDates, true);
  assert.equal(p.order, 'dmy');
  assert.equal(p.toAdd[1].test.pH, 7.4);
  assert.equal(p.toAdd[1].test.salt, undefined); // optional readings the file lacks are left off
});

test('planImport: a reading of 0 is kept, and a blank is not turned into 0', () => {
  const { p } = plan('Date,FC,pH,TA\n1/10/2025,0,7.4,\n');
  assert.equal(p.toAdd[0].test.freeChlor, 0);
  assert.equal(p.toAdd[0].test.alkalinity, null);
});

test('planImport: rows that cannot be trusted are skipped with a reason', () => {
  const { p } = plan([
    'Date,FC,pH,TA',
    '1/10/2025,2,72,100',      // pH typo
    'not a date,2,7.4,100',
    '2/10/2025,,,',            // nothing measured
    '3/10/2025,2,7.4,100',     // fine
    '12/11/2027,2,7.4,100',    // future
  ].join('\n'));
  assert.equal(p.toAdd.length, 1);
  assert.equal(p.skipped.length, 4);
  const reasons = p.skipped.map((s) => s.reason).join(' | ');
  assert.match(reasons, /pH of 72 looks too high/);
  assert.doesNotMatch(reasons, /Check it and try again/);
  assert.match(reasons, /isn't one we can read/);
  assert.match(reasons, /No readings on this row/);
  assert.match(reasons, /future/);
  // The owner reads dates, not row numbers (blank and title lines are dropped on the way in).
  const labels = p.skipped.map((s) => s.label);
  assert.ok(labels.includes('1/10/2025: pH of 72 looks too high.'));
  assert.ok(labels.includes('Date "not a date" isn\'t one we can read'));
  assert.ok(labels.includes('2/10/2025: No readings on this row'));
  assert.ok(labels.every((l) => !/^Row \d/.test(l)));
});

test('planImport: unreadable cells like "<0.1" are left blank, not guessed, and counted', () => {
  const { p } = plan('Date,FC,pH,Phosphates\n1/10/2025,<0.1,7.4,nil\n');
  assert.equal(p.toAdd[0].test.freeChlor, null);
  assert.equal(p.ignoredCells, 1);
});

test('planImport: salt in g/L and phosphates in ppm are converted to the app units', () => {
  const { p } = plan('Date,pH,Salt (g/L),Phosphate (ppm)\n1/10/2025,7.4,4.2,0.1\n');
  assert.equal(p.toAdd[0].test.salt, 4200);
  assert.equal(p.toAdd[0].test.phosphates, 100);
});

test('planImport: results already in the record, or listed twice, are not added again', () => {
  const csv = 'Date,FC,pH\n1/10/2025,2,7.4\n1/10/2025,2,7.4\n1/10/2025,3,7.6\n5/10/2025,2,7.4\n';
  const existing = [{ createdAt: new Date(2025, 9, 5, 9, 0).toISOString(), freeChlor: 2, pH: 7.4, alkalinity: null, cyanuricAcid: null, calciumHardness: null }];
  const { p } = plan(csv, { existingTests: existing });
  assert.equal(p.toAdd.length, 2);          // 1 Oct 2/7.4 and 1 Oct 3/7.6 (two real tests that day)
  assert.equal(p.duplicates, 2);            // the repeat, and 5 Oct which is already saved
});

test('planImport: importing the same file twice adds nothing the second time', () => {
  const csv = 'Date,FC,pH\n1/10/2025,2,7.4\n8/10/2025,2.5,7.5\n';
  const first = plan(csv).p;
  const saved = first.toAdd.map((x) => x.test);
  const again = plan(csv, { existingTests: saved }).p;
  assert.equal(again.toAdd.length, 0);
  assert.equal(again.duplicates, 2);
});

test('planImport: month-first files are read as month first', () => {
  const { p } = plan('Date,FC,pH\n10/25/2025,2,7.4\n10/8/2025,2,7.4\n');
  assert.equal(p.order, 'mdy');
  assert.deepEqual(p.toAdd.map((x) => toDateInput(x.test.createdAt)), ['2025-10-08', '2025-10-25']);
});

test('planImport: more than the limit is flagged', () => {
  const lines = ['Date,pH'];
  for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) lines.push(`1/1/2020,${(6 + (i % 200) / 100).toFixed(2)}`);
  const { p } = plan(lines.join('\n'));
  assert.equal(p.toAdd.length, MAX_IMPORT_ROWS + 1 - p.duplicates);
  assert.equal(p.tooMany, p.toAdd.length > MAX_IMPORT_ROWS);
});

// ── Whole-shop exports ───────────────────────────────────────

const SHOP = [
  'Customer,Phone,Date,Free Cl,pH,Alk',
  'Margaret Thompson,0400 111 222,1/10/2025,2,7.4,100',
  'Dave Nguyen,0400 333 444,2/10/2025,1,7.8,90',
  'Margaret Thompson,0400 111 222,8/10/2025,3,7.2,110',
  'Dave Nguyen,0400 333 444,9/10/2025,2,7.6,95',
  'Margaret Thompson,0400 111 222,15/10/2025,1.5,7.5,105',
].join('\n');

test('listCustomers finds every customer, biggest history first', () => {
  const f = readShopCsv(SHOP);
  const list = listCustomers(f.rows, f.customerCols);
  assert.deepEqual(list.map((c) => [c.label, c.count]), [['Margaret Thompson', 3], ['Dave Nguyen', 2]]);
  assert.deepEqual(filterCustomers(list, 'dav').map((c) => c.label), ['Dave Nguyen']);
  assert.equal(filterCustomers(list, '').length, 2);
});

test('only the chosen customer\'s rows are read; the others are never planned', () => {
  const f = readShopCsv(SHOP);
  const key = listCustomers(f.rows, f.customerCols).find((c) => c.label === 'Dave Nguyen').key;
  const p = planImport({ ...f, customerKey: key, existingTests: [], now: NOW });
  assert.equal(p.toAdd.length, 2);
  assert.equal(p.items.length, 2);
  assert.ok(p.toAdd.every((x) => [7.8, 7.6].includes(x.test.pH)));
});

test('customer columns: first and last name, or an id when there is no name', () => {
  const a = readShopCsv('First Name,Last Name,Date,pH\nAnn,Lee,1/10/2025,7.4\nBo,Kim,1/10/2025,7.5\n');
  assert.deepEqual(listCustomers(a.rows, a.customerCols).map((c) => c.label).sort(), ['Ann Lee', 'Bo Kim']);
  const b = readShopCsv('Customer ID,Date,pH\n1042,1/10/2025,7.4\n2210,1/10/2025,7.5\n');
  assert.deepEqual(listCustomers(b.rows, b.customerCols).map((c) => c.label).sort(), ['Customer 1042', 'Customer 2210']);
});

test('a file with no customer column has no customers to choose from', () => {
  const f = readShopCsv('Date,pH\n1/10/2025,7.4\n');
  assert.deepEqual(listCustomers(f.rows, f.customerCols), []);
});

// ── Summary and round trip ───────────────────────────────────

test('mappingSummary and leftOutHeaders say what was used and what was not', () => {
  const f = readShopCsv('Customer,Date,Free Chlorine,Total Chlorine,pH,Salt (g/L)\nAnn,1/10/2025,2,2.5,7.4,4\n');
  const s = mappingSummary(f.headers, f.mapping);
  assert.equal(s.find((x) => x.key === 'freeChlor').header, 'Free Chlorine');
  assert.equal(s.find((x) => x.key === 'salt').note, 'g/L, saved as ppm');
  assert.equal(s.find((x) => x.key === 'tds').header, null);
  assert.deepEqual(leftOutHeaders(f.headers, f.mapping, f.customerCols), ['Total Chlorine']);
});

// The app's CSV writes the Melbourne calendar day; the importer reads days on the
// device's calendar. They agree on any Australian device, so only run this there.
const onAustralianCalendar = toDateInput('2026-10-01T02:00:00Z') === '2026-10-01' && toDateInput('2026-10-08T02:00:00Z') === '2026-10-08';

test('the app\'s own tests CSV can be imported back', { skip: !onAustralianCalendar && 'device calendar is not Australian' }, () => {
  const tests = [
    { id: 'a', createdAt: '2026-10-01T02:00:00Z', freeChlor: 0, pH: 7.4, alkalinity: 100, cyanuricAcid: null, calciumHardness: 300, salt: 3500, source: 'manual' },
    { id: 'b', createdAt: '2026-10-08T02:00:00Z', freeChlor: 0.5, pH: 7.9, alkalinity: 70, cyanuricAcid: 38, calciumHardness: 290, source: 'ocr', printoutPath: 'u/b.jpg' },
  ];
  const csv = testsCsv(buildRecord({ tests, events: [], equipment: [], owner: null, pool: null }));
  const { f, p } = plan(csv);
  assert.equal(f.matched, true);
  assert.equal(p.toAdd.length, 2);
  assert.equal(p.toAdd[0].test.freeChlor, 0);
  assert.equal(p.toAdd[0].test.salt, 3500);
  assert.equal(p.toAdd[1].test.cyanuricAcid, 38);
  // Already saved, so nothing doubles up.
  assert.equal(plan(csv, { existingTests: tests }).p.toAdd.length, 0);
});

test('the example file imports cleanly', () => {
  const { f, p } = plan(exampleCsv());
  assert.equal(f.matched, true);
  assert.equal(p.toAdd.length, 2);
  assert.equal(p.skipped.length, 0);
  assert.equal(p.toAdd[0].test.phosphates, 100);
});
