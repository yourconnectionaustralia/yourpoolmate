// "Download your water record" card on the Chemistry log.
// PDF for handing to a builder, an equipment maker or a buyer; CSV for a spreadsheet.

import { useState } from 'react';
import { buildRecord, eventsCsv, recordFileName, testsCsv } from '../lib/recordExport.js';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Fetch one printout photo and read its size, as a JPEG data URL for the PDF.
async function loadPhoto(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('photo fetch failed');
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  const dims = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
  return { dataUrl, ...dims };
}

export default function RecordExport({ owner, pool, equipment, tests, events, scoreFn, getPhotoUrl }) {
  const [busy, setBusy] = useState('');       // '' | 'pdf' | 'csv'
  const [progress, setProgress] = useState('');
  const [problem, setProblem] = useState('');
  const [withPhotos, setWithPhotos] = useState(true);

  const model = () => buildRecord({ owner, pool, equipment, tests, events, scoreFn });
  const photoCount = tests.filter(t => t.printoutPath).length;

  const downloadPdf = async () => {
    setProblem(''); setBusy('pdf'); setProgress('Building your record…');
    try {
      const m = model();
      const photos = [];
      let skipped = 0;
      if (withPhotos) {
        const withPhoto = m.tests.filter(r => r.printoutPath);
        for (let i = 0; i < withPhoto.length; i++) {
          setProgress(`Adding printout photo ${i + 1} of ${withPhoto.length}…`);
          try {
            const p = await loadPhoto(await getPhotoUrl(withPhoto[i].printoutPath));
            photos.push({ label: withPhoto[i].date, ...p });
          } catch { skipped += 1; }
        }
      }
      setProgress('Finishing the PDF…');
      const { buildRecordPdf } = await import('../lib/recordPdf.js');
      const blob = await buildRecordPdf(m, { photos });
      saveBlob(blob, recordFileName('water-record', 'pdf'));
      if (skipped) setProblem(`Your record downloaded, but ${skipped} printout photo${skipped === 1 ? '' : 's'} couldn't be added. Try again, or leave photos out.`);
    } catch (err) {
      console.error('Record export failed:', err);
      setProblem("Couldn't build the PDF. Check your connection and try again.");
    } finally {
      setBusy(''); setProgress('');
    }
  };

  const downloadCsv = (kind) => {
    setProblem('');
    try {
      const m = model();
      const body = kind === 'tests' ? testsCsv(m) : eventsCsv(m);
      saveBlob(new Blob([body], { type: 'text/csv;charset=utf-8' }),
        recordFileName(kind === 'tests' ? 'water-tests' : 'events', 'csv'));
    } catch (err) {
      console.error('CSV export failed:', err);
      setProblem("Couldn't build the spreadsheet. Try again.");
    }
  };

  return (
    <div className="card-section record-export">
      <div className="eyebrow" style={{ marginBottom: 8 }}>Your water record</div>
      <p className="record-export-body">
        A dated record of every test, dose and event{photoCount ? ', with your printout photos' : ''}. Hand it to a
        builder, an equipment maker or a buyer.
      </p>
      {photoCount > 0 && (
        <label className="keep-photo" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} disabled={!!busy} />
          <span>Include my {photoCount} printout photo{photoCount === 1 ? '' : 's'} (a bigger file)</span>
        </label>
      )}
      <div className="record-export-actions">
        <button className="btn btn-primary" onClick={downloadPdf} disabled={!!busy || tests.length === 0}>
          {busy === 'pdf' ? 'Working…' : 'Download PDF'}
        </button>
        <button className="btn btn-ghost" onClick={() => downloadCsv('tests')} disabled={!!busy || tests.length === 0}>
          Tests spreadsheet (CSV)
        </button>
        <button className="btn btn-ghost" onClick={() => downloadCsv('events')} disabled={!!busy || events.length === 0}>
          Events spreadsheet (CSV)
        </button>
      </div>
      {progress && <p className="record-export-body" role="status" style={{ marginTop: 10 }}>{progress}</p>}
      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
    </div>
  );
}
