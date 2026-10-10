// Draws the water record as a PDF. The content comes from buildRecord() in
// recordExport.js. jsPDF is loaded only when the owner taps Download, so it
// does not slow down opening the app.

import { RECORD_DISCLAIMER, pdfSafe } from './recordExport.js';

const PAGE_W = 297;
const PAGE_H = 210;
const M = 14;                       // page margin, mm
const CONTENT_W = PAGE_W - M * 2;
const OCEAN = [11, 119, 153];
const INK = [19, 38, 46];
const MUTED = [78, 102, 113];
const LINE = [220, 233, 238];

// photos: [{ label, dataUrl, width, height }] — one per page after the tables.
export async function buildRecordPdf(model, { photos = [], title = 'Water record' } = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = M;

  const setInk = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const text = (s, x, yy, opts) => doc.text(pdfSafe(s), x, yy, opts);
  const lines = (s, w) => doc.splitTextToSize(pdfSafe(s), w);
  const room = (h) => { if (y + h > PAGE_H - 16) { doc.addPage(); y = M; return true; } return false; };

  // ── Title ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); setInk(OCEAN);
  text(title, M, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); setInk(MUTED);
  text(`Your Pool Mate  ·  made ${model.generatedOn}`, M, y + 15);
  y += 24;

  // ── Owner + pool facts, two columns ──
  const facts = [...model.owner, ...model.pool];
  if (facts.length) {
    const colW = CONTENT_W / 2;
    const perCol = Math.ceil(facts.length / 2);
    doc.setFontSize(11);
    facts.forEach(([k, v], i) => {
      const col = i < perCol ? 0 : 1;
      const row = i < perCol ? i : i - perCol;
      const x = M + col * colW;
      const yy = y + row * 6;
      doc.setFont('helvetica', 'bold'); setInk(MUTED); text(k, x, yy);
      doc.setFont('helvetica', 'normal'); setInk(INK);
      text(String(v), x + 48, yy, { maxWidth: colW - 52 });
    });
    y += perCol * 6 + 4;
  }

  if (model.equipment.length) {
    room(14 + model.equipment.length * 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setInk(OCEAN); text('Equipment', M, y); y += 6;
    doc.setFontSize(11);
    for (const e of model.equipment) {
      const bits = [e.type, e.make, e.installed ? `installed ${e.installed}` : ''].filter(Boolean).join('  ·  ');
      doc.setFont('helvetica', 'normal'); setInk(INK); text(bits, M, y); y += 6;
    }
    y += 2;
  }

  // ── Summary ──
  room(20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); setInk(INK);
  const summary = model.tests.length
    ? `${model.tests.length} water test${model.tests.length === 1 ? '' : 's'}, ${model.firstTest} to ${model.lastTest}. `
      + `${model.photoCount} printout photo${model.photoCount === 1 ? '' : 's'} on file. `
      + `${model.editedCount} test${model.editedCount === 1 ? '' : 's'} edited after first save.`
    : 'No water tests have been logged yet.';
  const sl = lines(summary, CONTENT_W);
  sl.forEach((l, i) => text(l, M, y + i * 5.5));
  y += sl.length * 5.5 + 6;

  // ── Disclaimer ──
  const dl = lines(RECORD_DISCLAIMER, CONTENT_W);
  room(dl.length * 4.5 + 6);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(9); setInk(MUTED);
  dl.forEach((l, i) => text(l, M, y + i * 4.5));
  y += dl.length * 4.5 + 6;


  // ── Table helper (repeats its header on each new page) ──
  const table = (cols, rows, rowFn) => {
    const head = () => {
      doc.setFillColor(234, 246, 250); doc.rect(M, y - 4.5, CONTENT_W, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); setInk(OCEAN);
      let x = M;
      for (const c of cols) { text(c.label, c.align === 'right' ? x + c.w - 2 : x + 2, y, c.align === 'right' ? { align: 'right' } : undefined); x += c.w; }
      y += 5;
    };
    room(20); head();
    doc.setFontSize(9.5);
    for (const r of rows) {
      const cells = rowFn(r);
      const wrapped = cols.map((c, i) => lines(cells[i] ?? '', c.w - 4));
      const h = Math.max(...wrapped.map(w => w.length)) * 4.6 + 3;
      if (y + h > PAGE_H - 16) { doc.addPage(); y = M + 4; head(); doc.setFontSize(9.5); }
      let x = M;
      cols.forEach((c, i) => {
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); setInk(INK);
        wrapped[i].forEach((l, k) => text(l, c.align === 'right' ? x + c.w - 2 : x + 2, y + k * 4.6, c.align === 'right' ? { align: 'right' } : undefined));
        x += c.w;
      });
      y += h;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.line(M, y - 3, M + CONTENT_W, y - 3);
    }
    y += 4;
  };

  // ── Water tests ──
  room(30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setInk(OCEAN); text('Water tests', M, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setInk(MUTED);
  text('Free Cl = free chlorine (ppm).  Alk = total alkalinity (ppm).  CYA = cyanuric acid (ppm).  Calcium = calcium hardness (ppm).  A dash means not tested.', M, y);
  y += 7;

  const num = (w, label, key) => ({ w, label, key, align: 'right' });
  const cols = [
    { w: 25, label: 'Date', key: 'date' },
    num(17, 'Free Cl', 'freeChlor'), num(13, 'pH', 'pH'), num(15, 'Alk', 'alkalinity'),
    num(15, 'CYA', 'cyanuricAcid'), num(18, 'Calcium', 'calciumHardness'),
    ...(model.hasSalt ? [num(15, 'Salt', 'salt')] : []),
    ...(model.hasPhosphates ? [num(17, 'Phos ppb', 'phosphates')] : []),
    ...(model.hasTds ? [num(15, 'TDS', 'tds')] : []),
    num(14, 'Score', 'score'),
  ];
  const used = cols.reduce((a, c) => a + c.w, 0);
  cols.push({ w: CONTENT_W - used, label: 'Notes', key: 'notes' });

  if (model.tests.length) {
    table(cols, model.tests, (r) => cols.map(c => {
      if (c.key === 'notes') return r.notes.join('. ');
      if (c.key === 'date') return r.date;
      return r[c.key] === null || r[c.key] === undefined ? '–' : String(r[c.key]);
    }));
  }

  // ── Doses and events ──
  if (model.events.length) {
    room(30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setInk(OCEAN); text('Doses and events', M, y); y += 7;
    table(
      [{ w: 25, label: 'Date' }, { w: 38, label: 'Type' }, { w: 110, label: 'What happened' }, { w: CONTENT_W - 173, label: 'Notes' }],
      model.events,
      (e) => [e.date, e.label, e.title, e.notes],
    );
  }

  // ── Printout photos, one per page ──
  for (const p of photos) {
    doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setInk(OCEAN);
    text(`Printout photo: ${p.label}`, M, M + 4);
    const maxW = CONTENT_W; const maxH = PAGE_H - M * 2 - 24;
    const scale = Math.min(maxW / p.width, maxH / p.height);
    const w = p.width * scale; const h = p.height * scale;
    doc.addImage(p.dataUrl, 'JPEG', M + (maxW - w) / 2, M + 10, w, h);
  }

  // ── Footer on every page ──
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setInk(MUTED);
    text('Your Pool Mate  ·  yourpoolmate.com.au', M, PAGE_H - 8);
    text(`Page ${i} of ${total}`, PAGE_W - M, PAGE_H - 8, { align: 'right' });
  }

  return doc.output('blob');
}
