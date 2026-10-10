// The water record: everything an owner might hand to a builder, an equipment
// maker or a buyer, built from what is already in the app.
//
// This file only prepares the content (dates, labels, CSV text). Drawing the
// PDF is in recordPdf.js. Nothing here talks to the network.

const TZ = 'Australia/Melbourne';

export function formatDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function formatDayTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = formatDay(iso);
  const time = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(d).replace(/\s/g, '').toLowerCase();
  return `${day}, ${time}`;
}

const isoDay = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return p; // YYYY-MM-DD
};

export function sourceLabel(source) {
  return {
    manual: 'Entered by owner', ocr: 'Scanned from printout', voice: 'Spoken by owner', shop_import: 'Past result added by owner',
  }[source] || 'Entered by owner';
}

const EVENT_LABELS = {
  dose: 'Dose added', shock: 'Shock dose', green_treatment: 'Green-pool treatment', treatment: 'Treatment',
  drain_refill: 'Drain / refill', new_equipment: 'New equipment', custom: 'Note',
};
export const eventLabel = (type) => EVENT_LABELS[type] || 'Note';

// Rounded to 2 places so a stray 7.6000000000000005 never reaches the page.
const num = (v) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100) / 100);
const show = (v) => (num(v) === null ? '–' : String(v));

// "chlorine 2 ppm, pH 7.5" from the readings as first saved (see migration 018).
function originalText(orig) {
  if (!orig) return '';
  const bits = [];
  if (orig.free_chlorine != null) bits.push(`chlorine ${orig.free_chlorine}`);
  if (orig.ph != null) bits.push(`pH ${orig.ph}`);
  if (orig.alkalinity != null) bits.push(`alkalinity ${orig.alkalinity}`);
  if (orig.cyanuric_acid != null) bits.push(`cyanuric acid ${orig.cyanuric_acid}`);
  if (orig.calcium != null) bits.push(`calcium ${orig.calcium}`);
  if (orig.salt != null) bits.push(`salt ${orig.salt}`);
  if (orig.tested_at) bits.push(`dated ${formatDay(orig.tested_at)}`);
  return bits.join(', ');
}

export function testRows(tests, scoreFn) {
  return [...(tests || [])]
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map((t) => {
      const notes = [sourceLabel(t.source)];
      if (t.printoutPath) notes.push('Printout photo on file');
      if (t.editedAt) {
        const first = originalText(t.originalReadings);
        notes.push(`Edited ${formatDay(t.editedAt)}${first ? `. First saved as ${first}` : ''}`);
      }
      const score = scoreFn ? scoreFn(t) : t.healthScore;
      return {
        id: t.id || null,
        iso: t.createdAt,
        date: formatDay(t.createdAt),
        isoDay: isoDay(t.createdAt),
        freeChlor: num(t.freeChlor), pH: num(t.pH), alkalinity: num(t.alkalinity),
        cyanuricAcid: num(t.cyanuricAcid), calciumHardness: num(t.calciumHardness),
        salt: num(t.salt), phosphates: num(t.phosphates), tds: num(t.tds),
        score: Number.isFinite(score) ? Math.round(score) : null,
        source: t.source || 'manual',
        edited: !!t.editedAt,
        hasPhoto: !!t.printoutPath,
        printoutPath: t.printoutPath || null,
        notes,
      };
    });
}

export function eventRows(events) {
  return [...(events || [])]
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .map((e) => ({
      iso: e.date, date: formatDay(e.date), isoDay: isoDay(e.date),
      type: e.type || 'custom', label: eventLabel(e.type), title: e.title || '', notes: e.notes || '',
    }));
}

export function equipmentRows(equipment) {
  return (equipment || []).map((e) => ({
    type: e.type || '',
    make: [e.brand, e.model].filter(Boolean).join(' '),
    installed: e.installed_at ? formatDay(e.installed_at) : '',
    notes: e.notes || '',
  }));
}

export function poolFacts(pool) {
  if (!pool) return [];
  const rows = [
    ['Pool', pool.name],
    ['Type', pool.type],
    ['Shape', pool.shape],
    ['Surface', pool.surface],
    ['Volume', pool.volumeL ? `${Number(pool.volumeL).toLocaleString('en-AU')} litres` : null],
    ['Sanitiser', pool.sanitiser],
    ['Filter', pool.filter],
    ['Year built', pool.yearBuilt ? `${pool.yearBuilt}${pool.yearBuiltApprox ? ' (approximate)' : ''}` : null],
    ['Pool cover', pool.hasCover ? 'Yes' : null],
    ['Fence compliance certificate', pool.fenceCertDate ? formatDay(pool.fenceCertDate) : null],
  ];
  return rows.filter(([, v]) => v);
}

export function ownerFacts(owner) {
  if (!owner) return [];
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
  const place = [owner.suburb, owner.postcode].filter(Boolean).join(' ');
  return [['Owner', name], ['Address', [owner.address, place].filter(Boolean).join(', ')]].filter(([, v]) => v);
}

export function buildRecord({ owner, pool, equipment, tests, events, scoreFn, now = new Date() }) {
  const t = testRows(tests, scoreFn);
  const e = eventRows(events);
  return {
    generatedOn: formatDay(now.toISOString()),
    generatedIso: now.toISOString(),
    owner: ownerFacts(owner),
    pool: poolFacts(pool),
    equipment: equipmentRows(equipment),
    tests: t,
    events: e,
    hasPhosphates: t.some(r => r.phosphates !== null),
    hasTds: t.some(r => r.tds !== null),
    hasSalt: t.some(r => r.salt !== null),
    firstTest: t[0]?.date || null,
    lastTest: t[t.length - 1]?.date || null,
    editedCount: t.filter(r => r.edited).length,
    photoCount: t.filter(r => r.hasPhoto).length,
  };
}

export const RECORD_DISCLAIMER =
  'This record was made by Your Pool Mate from results entered, scanned or spoken by the pool owner. '
  + 'Readings are shown as saved. Any reading that was changed afterwards is marked, with the first saved values. '
  + 'Whether a warranty provider accepts any record is up to that provider and the terms of the warranty.';

// ── CSV ──────────────────────────────────────────────────────

// Quote when needed, and stop a spreadsheet running text as a formula.
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? String(v) : String(v);
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const csvLine = (cells) => cells.map(csvCell).join(',');

export function testsCsv(model) {
  const head = ['Date', 'Free chlorine (ppm)', 'pH', 'Total alkalinity (ppm)', 'Cyanuric acid (ppm)', 'Calcium hardness (ppm)',
    'Salt (ppm)', 'Phosphates (ppb)', 'TDS (ppm)', 'Health score', 'Source', 'Printout photo on file', 'Edited', 'Notes'];
  const lines = [csvLine(head)];
  for (const r of model.tests) {
    lines.push(csvLine([
      r.isoDay, r.freeChlor, r.pH, r.alkalinity, r.cyanuricAcid, r.calciumHardness,
      r.salt, r.phosphates, r.tds, r.score, sourceLabel(r.source),
      r.hasPhoto ? 'Yes' : 'No', r.edited ? 'Yes' : 'No', r.notes.slice(1).join('. '),
    ]));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function eventsCsv(model) {
  const lines = [csvLine(['Date', 'Type', 'What happened', 'Notes'])];
  for (const e of model.events) lines.push(csvLine([e.isoDay, e.label, e.title, e.notes]));
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function recordFileName(kind, ext, now = new Date()) {
  return `your-pool-mate-${kind}-${isoDay(now.toISOString())}.${ext}`;
}

// Standard-font PDFs cannot draw emoji or most non-Latin characters. Keep
// Latin-1 and the common Windows punctuation; anything else becomes "?".
export function pdfSafe(text) {
  return String(text ?? '').replace(/[^ -~ -ÿ–—‘’“”•…]/gu, '?');
}
