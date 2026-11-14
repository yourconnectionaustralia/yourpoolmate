import { useState, useEffect } from 'react';
import { isSaltPool } from '../../lib/healthScore.js';
import { readingProblem } from '../../lib/plan.js';
import PoolLookQuestion from '../../components/PoolLookQuestion.jsx';
import { fmtReading, formatDate } from '../helpers.js';
import { Icon } from '../icons.jsx';

// ─────────────────────────────────────────────────────────────────
// WATER TESTS PAGE
// ─────────────────────────────────────────────────────────────────
// Which logged dose belongs to which step of which test, for databases from
// before migration 021 (the dose row there can't carry its test and step).
// Newer doses carry testId + stepKey and don't need this.
const DOSE_IDS_STORE = 'ypm.doseEvents.v1';

export function readDoseIds(testKey) {
  try { return JSON.parse(localStorage.getItem(DOSE_IDS_STORE) || '{}')[testKey] || {}; } catch { return {}; }
}

export function writeDoseIds(testKey, ids) {
  try {
    const all = JSON.parse(localStorage.getItem(DOSE_IDS_STORE) || '{}');
    all[testKey] = ids;
    localStorage.setItem(DOSE_IDS_STORE, JSON.stringify(all));
  } catch { /* non-fatal */ }
}

export function WaterTestsPage({ testData, onLogTest, onScanTest, onScanStrip, onSpeakTest, poolProfile, saltRange, autoOpenForm, onAutoOpened, stepsLeft = 0, onOpenPlan, rows = [] }) {
  const [showForm, setShowForm] = useState(false);
  const EMPTY_FORM = {
    freeChlor: '', totalChlor: '', pH: '', alkalinity: '', cyanuricAcid: '', calciumHardness: '',
    salt: '', phosphates: '', tds: '',
  };
  const [problem, setProblem] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [look, setLook] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Open the entry form when a nav "Log test" action requests it, then clear the trigger.
  useEffect(() => {
    if (autoOpenForm) {
      setShowForm(true);
      onAutoOpened?.();
    }
  }, [autoOpenForm, onAutoOpened]);

  const saltPool = isSaltPool(poolProfile?.sanitiser);

  // Core fields, plus salt for salt/mineral pools, plus optional advanced fields.
  const formFields = [
    { key: 'freeChlor',       label: 'Free chlorine',    unit: 'ppm', placeholder: '1.0–3.0', group: 'main' },
    { key: 'pH',              label: 'pH',               unit: '',    placeholder: '7.2–7.6', group: 'main' },
    { key: 'alkalinity',      label: 'Total alkalinity', unit: 'ppm', placeholder: '80–120', group: 'main' },
    ...(saltPool ? [{ key: 'salt', label: 'Salt', unit: 'ppm', placeholder: saltRange ? `${saltRange.lo}–${saltRange.hi}` : '3000–5000', group: 'main' }] : []),
    { key: 'cyanuricAcid',    label: 'Cyanuric acid',    unit: 'ppm', placeholder: '30–50', group: 'kit' },
    { key: 'calciumHardness', label: 'Calcium hardness', unit: 'ppm', placeholder: '200–400', group: 'kit' },
    { key: 'totalChlor', label: 'Total chlorine', unit: 'ppm', placeholder: 'optional', group: 'extra' },
    { key: 'phosphates', label: 'Phosphates', unit: 'ppb', placeholder: 'optional', group: 'extra' },
    { key: 'tds',        label: 'Total dissolved solids', unit: 'ppm', placeholder: 'optional', group: 'extra' },
  ];
  // Three short groups instead of one long grid: the readings every test has,
  // the two most strips and kits add, then the rarely-tested extras folded away.
  const fieldsIn = (group) => formFields.filter((f) => f.group === group);
  const mainFields = fieldsIn('main');
  const mainDone = mainFields.filter((f) => form[f.key] !== '').length;
  const fieldGrid = (fields) => (
    <div className="test-form-grid">
      {fields.map(f => (
        <div key={f.key} className="input-group">
          <label className="input-label" htmlFor={`test-${f.key}`}>{f.label}{f.unit ? ` (${f.unit})` : ''}</label>
          <input
            id={`test-${f.key}`}
            className="input"
            type="number"
            inputMode="decimal"
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
          />
        </div>
      ))}
    </div>
  );

  const handleSubmit = async () => {
    // Catch typos (pH 74) before they become a dose for the wrong water.
    const issue = readingProblem(form);
    if (issue) { setProblem(issue.message); return; }
    // The readings cannot show green or cloudy water, so we always ask.
    if (!look) { setProblem('Choose how your pool looks first.'); return; }
    setProblem('');
    setSubmitting(true);
    // Untested fields stay null — they're skipped by the Health Score
    // (weights renormalise) instead of being scored as a 0 reading.
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
    const data = {
      freeChlor: num(form.freeChlor),
      pH: num(form.pH),
      alkalinity: num(form.alkalinity),
      cyanuricAcid: num(form.cyanuricAcid),
      calciumHardness: num(form.calciumHardness),
      poolLook: look,
      createdAt: new Date().toISOString(),
    };
    if (form.salt !== '')       data.salt = num(form.salt);
    if (form.totalChlor !== '') data.totalChlor = num(form.totalChlor);
    if (form.phosphates !== '') data.phosphates = num(form.phosphates);
    if (form.tds !== '')        data.tds = num(form.tds);
    onLogTest(data);
    setSubmitting(false);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setLook('');
  };

  return (
    <div>
      <h1 className="page-title">Water Tests</h1>
      <p className="page-subtitle">Enter a test, read a test strip, scan a printout, or speak the readings</p>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Enter Test Results
        </button>
        <button className="btn btn-ghost" onClick={onScanStrip}>
          <span style={{ display: 'inline-flex' }}>{Icon.camera}</span>
          Read my test strip
        </button>
        <button className="btn btn-ghost" onClick={onScanTest}>
          <span style={{ display: 'inline-flex' }}>{Icon.camera}</span>
          Scan test results
        </button>
        <button className="btn btn-ghost" onClick={onSpeakTest}>
          <span style={{ display: 'inline-flex' }}>{Icon.mic}</span>
          Speak results
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          <div className="test-form-head">
            <h2 className="test-form-title">Your main readings</h2>
            <p className={`test-form-count${mainDone === mainFields.length ? ' is-done' : ''}`} aria-live="polite">
              {mainDone === mainFields.length ? '✓ ' : ''}{mainDone} of {mainFields.length} in
            </p>
          </div>
          <p className="plan-small">These are on every test. They decide the swim call.</p>
          {fieldGrid(mainFields)}
          <h2 className="test-form-title test-form-title-gap">If your kit has them</h2>
          <p className="plan-small">Most strips and pool shop printouts show these too. Leave blank if not.</p>
          {fieldGrid(fieldsIn('kit'))}
          <details className="test-form-extras">
            <summary className="details-summary">Extra readings (total chlorine, phosphates, TDS)</summary>
            <p className="plan-small">With total chlorine, the plan spots chloramines — the cause of the "chlorine smell" — and adds a shock step.</p>
            {fieldGrid(fieldsIn('extra'))}
          </details>
          <PoolLookQuestion value={look} onChange={setLook} idPrefix="entry" />
          {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={submitting || !look}
            >
              {submitting ? (
                <span className="dot-loader">
                  <span/><span/><span/>
                </span>
              ) : 'Save reading'}
            </button>
          </div>
        </div>
      )}

      {/* Test history */}
      {testData ? (
        <>
          <div className="card-section">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Latest reading</div>
            <table className="data-table readings-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Reading</th>
                  <th>Target range</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td style={{ fontWeight: 500, color: 'var(--black)' }}>{fmtReading(r.value, r.unit)}</td>
                    <td className="col-muted">{r.target}</td>
                    <td>
                      <span className={`tag ${r.state === 'ok' ? 'tag-good' : r.state === 'none' ? 'tag-neutral' : 'tag-warn'}`}>
                        {r.state === 'ok' ? '✓ Good' : r.state === 'low' ? 'Low' : r.state === 'high' ? 'High' : '— No data'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 12 }}>
              Logged {formatDate(testData.createdAt)}
            </div>
          </div>

          {/* The steps live on the Plan page, ticked from the history. */}
          <div className="card-section" style={{ marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>What to do</div>
            {stepsLeft > 0 ? (
              <p style={{ fontSize: 17, marginBottom: 12 }}>
                <strong>{stepsLeft} step{stepsLeft === 1 ? '' : 's'} to do</strong>, in order, with amounts for your pool.
              </p>
            ) : (
              <p style={{ fontSize: 17, marginBottom: 12 }}>Nothing left to add for this test.</p>
            )}
            <button className="btn btn-primary" onClick={onOpenPlan}>Open today's plan</button>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.flask}</div>
            <div className="empty-state-title">No tests logged yet</div>
            <div className="empty-state-body">
              Log your first reading above — your Health Score generates instantly.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
