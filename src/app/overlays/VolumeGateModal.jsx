import { useState } from 'react';
import { rectangularVolumeLitres } from '../../lib/poolVolume.js';

// ─────────────────────────────────────────────────────────────────
// VOLUME GATE — blocks saving a test until a pool volume is known.
// ─────────────────────────────────────────────────────────────────
export function VolumeGateModal({ onCancel, onConfirm, suggestedL = null }) {
  const [litres, setLitres] = useState('');
  const [dims, setDims] = useState({ length: '', width: '', depth: '' });

  const estimate = rectangularVolumeLitres(dims.length, dims.width, dims.depth);

  const value = parseInt(litres, 10);
  const valid = Number.isFinite(value) && value > 0;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">One quick thing — your pool volume</div>
        <div className="modal-body" style={{ marginBottom: 16 }}>
          Your dose recommendations are calculated from your pool's volume. Enter it once
          and we'll remember it for every future test.
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label" htmlFor="vg-litres">Pool volume (litres)</label>
          <input
            id="vg-litres"
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 50000"
            value={litres}
            onChange={e => setLitres(e.target.value)}
          />
        </div>

        {suggestedL && (
          <div style={{ fontSize: 17, marginBottom: 16 }}>
            Your printout says <strong>{suggestedL.toLocaleString('en-AU')} L</strong>. Shops often estimate, so check it looks right.{' '}
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setLitres(String(suggestedL))}>
              Use this
            </button>
          </div>
        )}

        <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginBottom: 8 }}>
          Not sure? Estimate it from the pool's size (metres):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { key: 'length', label: 'Length' },
            { key: 'width',  label: 'Width' },
            { key: 'depth',  label: 'Avg depth' },
          ].map(f => (
            <div key={f.key} className="input-group">
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
        {estimate && (
          <div style={{ fontSize: 17, marginBottom: 16 }}>
            Estimated ≈ <strong>{estimate.toLocaleString()} L</strong>{' '}
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setLitres(String(estimate))}
            >
              Use this
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Not now</button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!valid}
            onClick={() => onConfirm(value)}
          >
            Save volume &amp; log test
          </button>
        </div>
      </div>
    </div>
  );
}
