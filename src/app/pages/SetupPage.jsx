import { useState } from 'react';
import { isSaltPool } from '../../lib/healthScore.js';
import { rectangularVolumeLitres } from '../../lib/poolVolume.js';
import { CURRENT_YEAR, FILTER_TYPES, POOL_SHAPES, POOL_SURFACES, POOL_TYPES, SANITISER_TYPES } from '../data/poolOptions.js';
import { Icon } from '../icons.jsx';

// ─────────────────────────────────────────────────────────────────
// SETUP PAGE
// ─────────────────────────────────────────────────────────────────
export function SetupPage({ poolProfile, onSave }) {
  const [form, setForm] = useState(() => ({
    name: 'Backyard pool',
    type: 'In-ground',
    shape: 'Rectangular',
    surface: 'Pebble / pebblecrete',
    volumeL: 32000,
    sanitiser: 'Chlorine (granular/liquid)',
    filter: 'Sand',
    yearBuilt: '',
    yearBuiltApprox: false,
    hasCover: false,
    fenceCertDate: '',
    pumpHoursPerDay: '',
    pumpHoursSummer: '',
    pumpHoursAutumn: '',
    pumpHoursWinter: '',
    pumpHoursSpring: '',
    pumpScheduleNote: '',
    chlorinatorOutputPercent: '',
    chlorinatorCellGPerHour: '',
    ...Object.fromEntries(Object.entries(poolProfile || {}).map(([k, v]) => [k, v ?? (k === 'id' ? null : '')])),
  }));
  const [saved, setSaved] = useState(false);
  const saltPool = isSaltPool(form.sanitiser);
  // Volume estimator inputs (metres)
  const [dims, setDims] = useState({ length: '', width: '', depth: '' });

  const set = (key, value) => { setForm(v => ({ ...v, [key]: value })); setSaved(false); };

  const volumeEstimate = rectangularVolumeLitres(dims.length, dims.width, dims.depth);

  const handleSave = () => {
    // Volume is held as a raw string while editing (so the field can sit
    // empty instead of snapping back to a sticky 0) — coerce on save only.
    onSave({ ...form, volumeL: parseFloat(form.volumeL) || 0 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= 1960; y--) yearOptions.push(y);

  return (
    <div>
      <h1 className="page-title">Pool setup</h1>
      <p className="page-subtitle">Your pool details power accurate dosing calculations</p>

      <div className="card-section">
        <div className="eyebrow" style={{ marginBottom: 16 }}>Pool details</div>

        {/* Pool name */}
        <div className="input-group">
          <label className="input-label">Pool name</label>
          <input
            className="input"
            placeholder="e.g. Backyard pool"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        {/* Volume — primary input, full width */}
        <div className="input-group">
          <label className="input-label">Volume (litres)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 32000"
            value={form.volumeL === 0 ? '' : form.volumeL}
            onChange={e => set('volumeL', e.target.value)}
          />
          <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 4 }}>
            {parseFloat(form.volumeL) > 0
              ? `≈ ${(parseFloat(form.volumeL) / 1000).toLocaleString('en-AU', { maximumFractionDigits: 1 })} kL`
              : 'Length × width × average depth (m) × 1,000 = litres'}
          </div>

          {/* Volume calculator (beta feedback: asked for on both devices) */}
          <details style={{ marginTop: 8 }}>
            <summary style={{
              fontSize: 17, color: 'var(--blue)', cursor: 'pointer',
              minHeight: 44, display: 'flex', alignItems: 'center',
            }}>
              Not sure? Work it out from your pool's size
            </summary>
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginBottom: 8 }}>
                Measure in metres. Average depth = (shallow end + deep end) ÷ 2.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { key: 'length', label: 'Length' },
                  { key: 'width',  label: 'Width' },
                  { key: 'depth',  label: 'Avg depth' },
                ].map(f => (
                  <div key={f.key} className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">{f.label}</label>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      placeholder="m"
                      value={dims[f.key]}
                      onChange={e => setDims(v => ({ ...v, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {volumeEstimate && (
                <div style={{ fontSize: 17, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Estimated ≈ <strong>{volumeEstimate.toLocaleString('en-AU')} L</strong></span>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => set('volumeL', String(volumeEstimate))}
                  >
                    Use this
                  </button>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Type + Shape */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Type</label>
            <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
              {POOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Shape</label>
            <select className="input" value={form.shape} onChange={e => set('shape', e.target.value)}>
              {POOL_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Surface + Sanitiser */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Pool surface</label>
            <select className="input" value={form.surface} onChange={e => set('surface', e.target.value)}>
              {POOL_SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Sanitiser type</label>
            <select className="input" value={form.sanitiser} onChange={e => set('sanitiser', e.target.value)}>
              {SANITISER_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Filter + Year built */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Filter type</label>
            <select className="input" value={form.filter} onChange={e => set('filter', e.target.value)}>
              {FILTER_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Year built (if known)</label>
            <select className="input" value={form.yearBuilt} onChange={e => set('yearBuilt', e.target.value)}>
              <option value="">Not sure</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Year-built approximate note (only when a year is chosen) */}
        {form.yearBuilt && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 17, color: 'var(--gray-mid)', cursor: 'pointer', marginTop: -4, marginBottom: 16,
          }}>
            <input
              type="checkbox"
              checked={form.yearBuiltApprox}
              onChange={e => set('yearBuiltApprox', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--water-deep)', cursor: 'pointer' }}
            />
            This is an approximate year / best guess
          </label>
        )}

        {/* Fencing certificate date — part of the compliance record */}
        <div className="input-group">
          <label className="input-label" htmlFor="fence-cert-date">Pool fencing certificate date (if you have one)</label>
          <input
            id="fence-cert-date"
            className="input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.fenceCertDate || ''}
            onChange={e => set('fenceCertDate', e.target.value)}
          />
          <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 4 }}>
            The date on your fencing compliance certificate — part of your pool's
            record, handy at sale or inspection time.
          </div>
        </div>

        {/* Pool cover Y/N */}
        <div className="input-group">
          <label className="input-label">Pool cover</label>
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Pool cover">
            {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(opt => {
              const active = form.hasCover === opt.v;
              return (
                <button
                  key={opt.l}
                  type="button"
                  onClick={() => set('hasCover', opt.v)}
                  aria-pressed={active}
                  style={{
                    flex: 1, minHeight: 44,
                    borderRadius: 'var(--r-sm)',
                    border: active ? '1px solid var(--water-deep)' : 'var(--border)',
                    background: active ? 'var(--water-pale)' : 'var(--white)',
                    color: active ? 'var(--water-deep)' : 'var(--gray-mid)',
                    fontSize: 17, fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pump run and chlorinator — they turn the chlorine step into
            "turn the chlorinator up" before "buy liquid chlorine". */}
        <div className="eyebrow" style={{ margin: '24px 0 12px' }}>Pump and chlorinator</div>
        <div className="input-group">
          <span className="input-label" id="pump-hours-label">Daily pump hours</span>
          <div className="chip-row" role="group" aria-labelledby="pump-hours-label">
            {[4, 6, 8, 10, 12].map(h => (
              <button
                key={h}
                type="button"
                className={`chip${Number(form.pumpHoursPerDay) === h ? ' is-on' : ''}`}
                aria-pressed={Number(form.pumpHoursPerDay) === h}
                onClick={() => set('pumpHoursPerDay', Number(form.pumpHoursPerDay) === h ? '' : h)}
              >
                {h} h
              </button>
            ))}
          </div>
          <details style={{ marginTop: 8 }}>
            <summary className="details-summary">Different hours each season?</summary>
            <div className="season-hours">
              {[['pumpHoursSummer', 'Summer'], ['pumpHoursAutumn', 'Autumn'], ['pumpHoursWinter', 'Winter'], ['pumpHoursSpring', 'Spring']].map(([k, label]) => (
                <div key={k} className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" htmlFor={`setup-${k}`}>{label}</label>
                  <input id={`setup-${k}`} className="input" type="number" inputMode="numeric" min={0} max={24} placeholder="hours"
                         value={form[k]} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="setup-pump-note">Pump timer note (optional)</label>
          <input id="setup-pump-note" className="input" maxLength={200} placeholder="e.g. mornings in summer, shorter run in winter"
                 value={form.pumpScheduleNote} onChange={e => set('pumpScheduleNote', e.target.value)} />
        </div>
        {saltPool && (
          <>
            <div className="input-group">
              <span className="input-label" id="chl-output-label">Chlorinator output</span>
              <div className="chip-row" role="group" aria-labelledby="chl-output-label">
                {[40, 60, 80, 100].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`chip${Number(form.chlorinatorOutputPercent) === p ? ' is-on' : ''}`}
                    aria-pressed={Number(form.chlorinatorOutputPercent) === p}
                    onClick={() => set('chlorinatorOutputPercent', Number(form.chlorinatorOutputPercent) === p ? '' : p)}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="setup-cell">Cell size, grams an hour at 100% (optional)</label>
              <input id="setup-cell" className="input" type="number" inputMode="decimal" min={1} max={100} placeholder="from the chlorinator's manual"
                     value={form.chlorinatorCellGPerHour} onChange={e => set('chlorinatorCellGPerHour', e.target.value)} />
              <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 4 }}>
                Leave blank and we use the model on your equipment list.
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          {saved && (
            <span style={{ fontSize: 17, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {Icon.check} Saved
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            Save setup
          </button>
        </div>
      </div>

      <div className="callout callout-info" style={{ marginTop: 16 }}>
        <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
          {Icon.info}
        </span>
        <div className="callout-body">
          Accurate pool volume is the most important setup detail — it determines every dose recommendation.
          If unsure, use the calculator: <strong>length × width × average depth (m) × 1,000</strong> = litres.
        </div>
      </div>
    </div>
  );
}
