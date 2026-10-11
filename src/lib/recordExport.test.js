import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRecord, csvCell, eventsCsv, formatDay, pdfSafe, recordFileName, testsCsv,
} from './recordExport.js';

const tests = [
  { id: 'b', createdAt: '2026-10-08T02:00:00Z', freeChlor: 0.5, pH: 7.9, alkalinity: 70, cyanuricAcid: 38, calciumHardness: 290,
    source: 'ocr', printoutPath: 'u/b.jpg', editedAt: '2026-10-09T01:00:00Z',
    originalReadings: { ph: 7.5, free_chlorine: 2, tested_at: '2026-10-08T02:00:00Z' } },
  { id: 'a', createdAt: '2026-10-01T02:00:00Z', freeChlor: 0, pH: 7.4, alkalinity: 100, cyanuricAcid: null, calciumHardness: 300, salt: 3500, source: 'manual' },
];
const events = [
  { date: '2026-10-09T01:00:00Z', type: 'dose', title: 'Added 2.3 kg bicarb', notes: 'Raise Total Alkalinity · pool 45,000 L' },
  { date: '2026-10-02T01:00:00Z', type: 'shock', title: 'Shock dose', notes: '=cmd|\' /C calc\'!A0' },
];
const model = buildRecord({
  owner: { firstName: 'Margaret', lastName: 'T', address: '1 Bay St', suburb: 'Frankston', postcode: '3199' },
  pool: { name: 'Back pool', type: 'In-ground', volumeL: 45000, sanitiser: 'Salt', yearBuilt: 2012, yearBuiltApprox: true },
  equipment: [{ type: 'Pump', brand: 'Astral', model: 'Viron', installed_at: '2024-01-05T00:00:00Z' }],
  tests, events, scoreFn: (t) => (t.id === 'a' ? 96 : 61), now: new Date('2026-10-10T02:00:00Z'),
});

test('tests are listed oldest first with a score and plain-words notes', () => {
  assert.deepEqual(model.tests.map(t => t.id), ['a', 'b']);
  assert.equal(model.tests[0].score, 96);
  assert.equal(model.tests[0].freeChlor, 0); // a real zero reading is kept
  assert.deepEqual(model.tests[1].notes.slice(0, 2), ['Scanned from printout', 'Printout photo on file']);
  assert.match(model.tests[1].notes[2], /^Edited 9 Oct 2026\. First saved as chlorine 2, pH 7\.5, dated 8 Oct 2026$/);
});

test('summary facts', () => {
  assert.equal(model.firstTest, '1 Oct 2026');
  assert.equal(model.lastTest, '8 Oct 2026');
  assert.equal(model.editedCount, 1);
  assert.equal(model.photoCount, 1);
  assert.equal(model.hasSalt, true);
  assert.equal(model.hasTds, false);
  assert.deepEqual(model.owner, [['Owner', 'Margaret T'], ['Address', '1 Bay St, Frankston 3199']]);
  assert.deepEqual(model.pool.find(([k]) => k === 'Volume'), ['Volume', '45,000 litres']);
  assert.deepEqual(model.pool.find(([k]) => k === 'Year built'), ['Year built', '2012 (approximate)']);
  assert.equal(model.equipment[0].make, 'Astral Viron');
});

test('events are listed oldest first with labels', () => {
  assert.deepEqual(model.events.map(e => e.label), ['Shock dose', 'Dose added']);
});

test('csv cells are quoted and formulas are defused', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell(0), '0');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(-1), '-1'); // numbers are not text
});

test('tests csv has a header, one line per test and Excel-friendly BOM', () => {
  const csv = testsCsv(model);
  const lines = csv.replace('﻿', '').trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^Date,Free chlorine \(ppm\),pH/);
  assert.match(lines[1], /^2026-10-01,0,7\.4,100,,300,3500,,,96,Entered by owner,No,No,$/);
  assert.match(lines[2], /^2026-10-08,0\.5,7\.9,70,38,290,,,,61,Scanned from printout,Yes,Yes,/);
  assert.ok(csv.startsWith('﻿'));
});

test('events csv defuses a formula in the notes', () => {
  assert.match(eventsCsv(model), /'=cmd/);
});

test('file names carry the date, in Melbourne time', () => {
  assert.equal(recordFileName('water-record', 'pdf', new Date('2026-10-09T14:00:00Z')), 'your-pool-mate-water-record-2026-10-10.pdf');
  assert.equal(formatDay('2026-10-10T13:30:00Z'), '11 Oct 2026');
});

test('pdf text drops characters a standard font cannot draw', () => {
  assert.equal(pdfSafe('pH 7.4 – good ✓ 👍'), 'pH 7.4 – good ? ?');
  assert.equal(pdfSafe('café “ok”'), 'café “ok”');
});
