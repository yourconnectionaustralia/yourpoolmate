// File: src/components/ImportShopCsv.jsx
// Add past results from a pool shop's CSV export.
//
//   AddPastChoice   the small "how do you want to add it?" picker
//   ImportShopCsv   choose a file -> (pick which customer you are) -> check -> add
//
// The file is read on this device. Nothing is saved until the owner taps Add,
// rows for other customers are never shown beyond their names, and results the
// record already holds are skipped, so choosing the same file twice is safe.

import { useMemo, useRef, useState } from 'react';
import {
  IMPORT_FIELDS, MAX_FILE_BYTES, MAX_IMPORT_ROWS, exampleCsv, filterCustomers, leftOutHeaders,
  listCustomers, mappingSummary, planImport, readShopCsv,
} from '../lib/shopImport.js';

const plural = (n, one, many) => (n === 1 ? one : many);

// Day, on the device's calendar (the same calendar the file's dates were read on).
const fmtDay = (iso) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

const READING_WORDS = [
  ['freeChlor', 'Chlorine'], ['pH', 'pH'], ['alkalinity', 'Alkalinity'], ['cyanuricAcid', 'Cyanuric acid'],
  ['calciumHardness', 'Calcium'], ['salt', 'Salt'], ['phosphates', 'Phosphates'], ['tds', 'TDS'],
];
const readingsLine = (t) => READING_WORDS.filter(([k]) => t[k] !== null && t[k] !== undefined).map(([k, w]) => `${w} ${t[k]}`).join(' · ');

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

// ── Picker: type one in, or import a file ────────────────────

export function AddPastChoice({ onType, onImport, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel modal-panel-tall" role="dialog" aria-modal="true" aria-labelledby="apc-title"
           onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" id="apc-title">Add past results</div>
        <div className="modal-body" style={{ marginBottom: 16 }}>
          Fill in the tests from before you joined, so your record starts earlier.
        </div>
        <div className="past-choice">
          <button type="button" className="btn btn-ghost past-choice-btn" onClick={onType}>
            <span className="past-choice-title">Type in one result</span>
            <span className="past-choice-note">Add a single test with the date it was done.</span>
          </button>
          <button type="button" className="btn btn-ghost past-choice-btn" onClick={onImport}>
            <span className="past-choice-title">Import from my pool shop</span>
            <span className="past-choice-note">Add many tests at once from a CSV file your pool shop gives you.</span>
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Import ───────────────────────────────────────────────────

export default function ImportShopCsv({ existingTests = [], onImport, onClose }) {
  const [step, setStep] = useState('pick');          // pick | who | review | done
  const [file, setFile] = useState(null);            // { name, read }
  const [mapping, setMapping] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerKey, setCustomerKey] = useState(null);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');              // '' | 'reading' | 'saving'
  const [added, setAdded] = useState(0);
  const inputRef = useRef(null);

  const needsDate = !!mapping && mapping.date == null;
  const plan = useMemo(() => {
    if (!file || !mapping || mapping.date == null) return null;
    return planImport({
      headers: file.read.headers, rows: file.read.rows, mapping,
      customerCols: file.read.customerCols, customerKey, existingTests,
    });
  }, [file, mapping, customerKey, existingTests]);

  const chosen = customers.find((c) => c.key === customerKey) || null;
  const many = customers.length > 10;                // a whole-shop file: don't list everyone

  const reset = () => {
    setFile(null); setMapping(null); setCustomers([]); setCustomerKey(null); setQuery('');
    setProblem(''); setStep('pick');
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setProblem('');
    if (/\.(xlsx|xls|xlsm|ods|numbers|pdf)$/i.test(f.name)) {
      setProblem('That isn\'t a CSV file. Open it in your spreadsheet app, choose Save As or Export, pick CSV, then choose the new file here.');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setProblem('That file is too big (over 8 MB). Ask your pool shop for a shorter date range.');
      return;
    }
    setBusy('reading');
    try {
      const text = await f.text();
      if (text.slice(0, 2000).includes('\u0000')) {
        setProblem('That doesn\'t look like a CSV file. Ask your pool shop to send it as CSV.');
        return;
      }
      const read = readShopCsv(text);
      if (read.error || !read.rows.length) {
        setProblem('We couldn\'t find any tests in that file. A CSV needs a column for the date and one for each reading.');
        return;
      }
      const list = listCustomers(read.rows, read.customerCols);
      setFile({ name: f.name, read });
      setMapping(read.mapping);
      setCustomers(list);
      setQuery('');
      if (list.length > 1) { setCustomerKey(null); setStep('who'); } else { setCustomerKey(list[0]?.key ?? null); setStep('review'); }
    } catch (err) {
      console.error('Could not read import file:', err);
      setProblem('We couldn\'t open that file. Try saving it as a CSV again.');
    } finally {
      setBusy('');
    }
  };

  const add = async () => {
    if (!plan || !plan.toAdd.length || plan.tooMany) return;
    setBusy('saving'); setProblem('');
    try {
      const n = await onImport(plan.toAdd.map((x) => x.test));
      setAdded(n);
      setStep('done');
    } catch (err) {
      console.error('Shop import failed:', err);
      const some = err?.saved?.length || 0;
      setProblem(some
        ? `${some} ${plural(some, 'test was', 'tests were')} added before the connection dropped. Check your connection and tap Add again. We'll only add the rest.`
        : "That didn't save, so nothing was added. Check your connection and try again.");
    } finally {
      setBusy('');
    }
  };

  const downloadExample = () => saveBlob(new Blob([exampleCsv()], { type: 'text/csv;charset=utf-8' }), 'your-pool-mate-import-example.csv');

  const working = busy !== '';

  return (
    <div className="modal-backdrop" onClick={working ? undefined : onClose}>
      <div className="modal-panel modal-panel-tall import-panel" role="dialog" aria-modal="true"
           aria-labelledby="import-title" onClick={(e) => e.stopPropagation()}>

        {step === 'pick' && (
          <>
            <div className="modal-title" id="import-title">Import from your pool shop</div>
            <div className="modal-body" style={{ marginBottom: 12 }}>
              Ask your pool shop to send your water test history as a CSV file (a spreadsheet saved as .csv).
              Choose it here and we'll show you what's in it before anything is added.
            </div>
            <p className="import-note">The file is read on this device. Nothing is saved until you tap Add.</p>
            <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain,.txt" style={{ display: 'none' }} onChange={onFile} />
            {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
            <div className="import-stack">
              <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={working}>
                {busy === 'reading' ? 'Reading your file…' : 'Choose CSV file'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={downloadExample} disabled={working}>
                Get an example file
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={working}>Cancel</button>
            </div>
          </>
        )}

        {step === 'who' && (
          <>
            <div className="modal-title" id="import-title">Which customer are you?</div>
            <div className="modal-body" style={{ marginBottom: 12 }}>
              This file has {customers.length} customers. Pick yourself. Only your tests are added, and everyone else's are ignored.
            </div>
            {(many || customers.length > 5) && (
              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label" htmlFor="import-who">Type your name</label>
                <input id="import-who" className="input" value={query} autoComplete="off"
                       onChange={(e) => setQuery(e.target.value)} />
              </div>
            )}
            <WhoList customers={customers} query={query} many={many}
                     onPick={(c) => { setCustomerKey(c.key); setStep('review'); }} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Choose a different file</button>
            </div>
          </>
        )}

        {step === 'review' && file && (
          <>
            <div className="modal-title" id="import-title">Check before adding</div>
            <div className="modal-body" style={{ marginBottom: 12 }}>
              {chosen ? <>Tests for <strong>{chosen.label}</strong> in </> : 'Tests in '}
              <span className="import-file">{file.name}</span>
            </div>

            <div aria-live="polite">
              {needsDate && (
                <div className="callout callout-action import-callout">
                  <div className="callout-body"><strong>We couldn't find the date column.</strong> Pick it below, then check the readings.</div>
                </div>
              )}
              {plan && plan.toAdd.length > 0 && !plan.tooMany && (
                <div className="callout callout-success import-callout">
                  <div className="callout-body">
                    <strong>{plan.toAdd.length} {plural(plan.toAdd.length, 'test', 'tests')} ready to add</strong>
                    {plan.first && <>, from {fmtDay(plan.first)} to {fmtDay(plan.last)}.</>}
                  </div>
                </div>
              )}
              {plan && plan.tooMany && (
                <div className="callout callout-alert import-callout">
                  <div className="callout-body">
                    <strong>That's more than {MAX_IMPORT_ROWS.toLocaleString('en-AU')} tests.</strong> Ask your pool shop for a
                    shorter date range, or split the file, and add it in parts.
                  </div>
                </div>
              )}
              {plan && !plan.toAdd.length && !plan.tooMany && (
                <div className="callout callout-info import-callout">
                  <div className="callout-body">
                    <strong>Nothing new to add.</strong>{' '}
                    {plan.duplicates > 0 && !plan.skipped.length
                      ? 'Every test in this file is already in your record.'
                      : 'We couldn\'t use any of the rows in this file. Check the columns below.'}
                  </div>
                </div>
              )}
            </div>

            {plan && plan.toAdd.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Newest to add</div>
                <ul className="import-preview">
                  {plan.toAdd.slice(-3).reverse().map((x) => (
                    <li key={x.line}>
                      <strong>{fmtDay(x.test.createdAt)}</strong>
                      {readingsLine(x.test)}
                    </li>
                  ))}
                  {plan.toAdd.length > 3 && <li>…and {plan.toAdd.length - 3} older {plural(plan.toAdd.length - 3, 'test', 'tests')}</li>}
                </ul>
              </>
            )}

            {plan && (
              <div className="import-facts">
                {plan.usesSlashDates && (
                  <p className="import-note">
                    {plan.order === 'mdy'
                      ? 'Dates are read month/day/year, because this file has dates like 10/25/2025.'
                      : 'Dates are read day/month/year, so 8/10/2025 is 8 October 2025.'}
                  </p>
                )}
                {plan.duplicates > 0 && (
                  <p className="import-note">
                    {plan.duplicates} {plural(plan.duplicates, 'test is', 'tests are')} already in your record, so we'll skip {plural(plan.duplicates, 'it', 'them')}.
                  </p>
                )}
                {plan.ignoredCells > 0 && (
                  <p className="import-note">
                    {plan.ignoredCells === 1
                      ? 'One reading in the file wasn\'t a plain number (like "<0.1"), so we left it blank.'
                      : `${plan.ignoredCells} readings in the file weren't plain numbers (like "<0.1"), so we left them blank.`}
                  </p>
                )}
                {plan.skipped.length > 0 && (
                  <>
                    <p className="import-note" style={{ marginBottom: 4 }}>
                      {plan.skipped.length} {plural(plan.skipped.length, 'row', 'rows')} can't be added:
                    </p>
                    <ul className="import-skipped">
                      {plan.skipped.slice(0, 5).map((s) => <li key={s.line}>{s.label}</li>)}
                      {plan.skipped.length > 5 && <li>…and {plan.skipped.length - 5} more</li>}
                    </ul>
                  </>
                )}
              </div>
            )}

            <ColumnPicker read={file.read} mapping={mapping} onChange={setMapping}
                          open={needsDate || !file.read.matched} />

            {problem && <p role="alert" className="test-editor-problem">{problem}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={customers.length > 1 ? () => { setCustomerKey(null); setStep('who'); } : reset} disabled={working}>
                Back
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={add}
                      disabled={working || !plan || !plan.toAdd.length || plan.tooMany}>
                {busy === 'saving' ? 'Adding…' : plan && plan.toAdd.length
                  ? `Add ${plan.toAdd.length} ${plural(plan.toAdd.length, 'test', 'tests')}`
                  : 'Add tests'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="modal-title" id="import-title">All added</div>
            <div className="callout callout-success import-callout">
              <div className="callout-body">
                <strong>{added} {plural(added, 'test', 'tests')} added to your record.</strong>
              </div>
            </div>
            <p className="import-note">
              They're in your Chemistry log with a "Past result" tag, and in your PDF and spreadsheet downloads.
              You can edit or delete any of them from the log.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Names to pick from. A whole-shop file stays hidden until the owner types.
function WhoList({ customers, query, many, onPick }) {
  const typed = query.trim().length >= 2;
  const matches = filterCustomers(customers, query);
  const shown = many ? (typed ? matches.slice(0, 6) : []) : matches;
  if (many && !typed) {
    return <p className="import-note">Type at least 2 letters of your name to find yourself.</p>;
  }
  if (!shown.length) {
    return <p className="import-note" role="status">No one by that name in this file. Check the spelling, or choose a different file.</p>;
  }
  return (
    <div className="past-choice" role="group" aria-label="Customers in this file">
      {shown.map((c) => (
        <button key={c.key} type="button" className="btn btn-ghost past-choice-btn" onClick={() => onPick(c)}>
          <span className="past-choice-title">{c.label}</span>
          <span className="past-choice-note">{c.count} {plural(c.count, 'row', 'rows')}</span>
        </button>
      ))}
      {many && matches.length > shown.length && (
        <p className="import-note" role="status">{matches.length - shown.length} more match. Keep typing to narrow it down.</p>
      )}
    </div>
  );
}

// "Which column is which", for when the guess is off.
function ColumnPicker({ read, mapping, onChange, open }) {
  const rows = mappingSummary(read.headers, mapping);
  const left = leftOutHeaders(read.headers, mapping, read.customerCols);
  return (
    <details className="import-columns" open={open}>
      <summary>Check the columns</summary>
      <div className="import-columns-body">
        {IMPORT_FIELDS.map((f) => {
          const row = rows.find((r) => r.key === f.key);
          return (
            <div className="input-group" key={f.key}>
              <label className="input-label" htmlFor={`import-col-${f.key}`}>{f.label}{f.required ? ' (needed)' : ''}</label>
              <select id={`import-col-${f.key}`} className="input" value={row.column ?? ''}
                      onChange={(e) => onChange({ ...mapping, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">{f.required ? 'Choose a column…' : 'Not in this file'}</option>
                {read.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </select>
              {row.note && <span className="import-note" style={{ margin: '4px 0 0' }}>{row.note}</span>}
            </div>
          );
        })}
        {left.length > 0 && (
          <p className="import-note" style={{ margin: 0 }}>
            Not used: {left.slice(0, 8).join(', ')}{left.length > 8 ? `, and ${left.length - 8} more` : ''}.
          </p>
        )}
      </div>
    </details>
  );
}
