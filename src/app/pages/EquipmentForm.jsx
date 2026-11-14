import { useState } from 'react';
import { EQUIPMENT_BRANDS, EQUIPMENT_MODELS, EQUIPMENT_TYPES } from '../data/equipment.js';

// ─────────────────────────────────────────────────────────────────
// EQUIPMENT FORM (shared by add + edit)
// ─────────────────────────────────────────────────────────────────
export function EquipmentForm({ form, setForm, onSave, onCancel, isNew, saving, error }) {
  const brandOptions = EQUIPMENT_BRANDS[form.type];
  const modelOptions = EQUIPMENT_MODELS[`${form.type}|${form.brand}`];
  // Free-text brand mode: chosen via "Other", or an existing item whose
  // brand isn't in the list for its type.
  const [customBrand, setCustomBrand] = useState(
    () => !!form.brand && !!EQUIPMENT_BRANDS[form.type] && !EQUIPMENT_BRANDS[form.type].includes(form.brand)
  );
  // Same idea for the model dropdown.
  const [customModel, setCustomModel] = useState(
    () => !!form.model && !!modelOptions && !modelOptions.includes(form.model)
  );
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Equipment type</label>
          <select
            className="input"
            value={form.type}
            onChange={e => {
              const type = e.target.value;
              // Changing type invalidates the brand/model lists — clear the
              // model, flip brand to free text if it's not in the new list.
              const list = EQUIPMENT_BRANDS[type];
              setForm(v => ({ ...v, type, model: '' }));
              setCustomBrand(!!form.brand && !!list && !list.includes(form.brand));
              setCustomModel(false);
            }}
          >
            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Brand</label>
          {brandOptions && !customBrand ? (
            <select
              className="input"
              value={brandOptions.includes(form.brand) ? form.brand : ''}
              onChange={e => {
                // Brand drives the model list — always clear the model too.
                setCustomModel(false);
                if (e.target.value === '__other__') {
                  setCustomBrand(true);
                  setForm(v => ({ ...v, brand: '', model: '' }));
                } else {
                  setForm(v => ({ ...v, brand: e.target.value, model: '' }));
                }
              }}
            >
              <option value="">Select a brand</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="__other__">Other</option>
            </select>
          ) : (
            <>
              <input
                className="input"
                placeholder="Brand name"
                value={form.brand}
                onChange={e => setForm(v => ({ ...v, brand: e.target.value }))}
              />
              {brandOptions && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 4, alignSelf: 'flex-start' }}
                  onClick={() => { setCustomBrand(false); setCustomModel(false); setForm(v => ({ ...v, brand: '', model: '' })); }}
                >
                  Choose from the list instead
                </button>
              )}
            </>
          )}
        </div>
        <div className="input-group">
          <label className="input-label">Model</label>
          {modelOptions && !customModel ? (
            <select
              className="input"
              value={modelOptions.includes(form.model) ? form.model : ''}
              onChange={e => {
                if (e.target.value === '__other__') {
                  setCustomModel(true);
                  setForm(v => ({ ...v, model: '' }));
                } else {
                  setForm(v => ({ ...v, model: e.target.value }));
                }
              }}
            >
              <option value="">Select a model</option>
              {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__other__">Other</option>
            </select>
          ) : (
            <>
              <input
                className="input"
                placeholder="Model (if known)"
                value={form.model}
                onChange={e => setForm(v => ({ ...v, model: e.target.value }))}
              />
              {modelOptions && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 4, alignSelf: 'flex-start' }}
                  onClick={() => { setCustomModel(false); setForm(v => ({ ...v, model: '' })); }}
                >
                  Choose from the list instead
                </button>
              )}
            </>
          )}
        </div>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Date installed (if known)</label>
          <input
            className="input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.installed_at || ''}
            onChange={e => setForm(v => ({ ...v, installed_at: e.target.value }))}
          />
        </div>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Notes (optional)</label>
          <input
            className="input"
            placeholder="e.g. Runs 8 hrs/day in summer"
            value={form.notes}
            onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
          />
        </div>
      </div>
      {error && (
        <p role="alert" style={{ fontSize: 17, color: '#e05555', marginTop: 10, marginBottom: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Add equipment' : 'Save changes'}
        </button>
      </div>
    </>
  );
}
