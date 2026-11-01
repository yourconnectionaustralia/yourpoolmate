// Choose the three buttons on the phone's bottom bar. Test stays in the
// middle and More stays on the right, so everything else is always reachable.
import { useEffect, useState } from 'react';
import { DEFAULT_NAV, NAV_OPTIONS, navOption, sameNav, setSlot } from '../lib/navSlots.js';

const SLOT_NAMES = ['First button', 'Second button', 'After Test'];

export default function NavEditor({ nav, onSave, onClose }) {
  const [draft, setDraft] = useState(nav);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label = (v) => navOption(v)?.label ?? v;

  return (
    <div className="modal-backdrop nav-editor-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nav-editor" role="dialog" aria-modal="true" aria-labelledby="nav-editor-title">
        <h2 id="nav-editor-title" className="nav-editor-title">Your bottom bar</h2>
        <p className="plan-small">Pick the three screens you use most. Test stays in the middle, and everything else is under More.</p>

        <div className="nav-editor-preview" aria-hidden="true">
          <span>{label(draft[0])}</span>
          <span>{label(draft[1])}</span>
          <span className="is-test">+ Test</span>
          <span>{label(draft[2])}</span>
          <span>More</span>
        </div>

        {SLOT_NAMES.map((name, i) => (
          <div key={name} className="input-group">
            <label className="input-label" htmlFor={`nav-slot-${i}`}>{name}</label>
            <select
              id={`nav-slot-${i}`}
              className="input"
              value={draft[i]}
              onChange={(e) => setDraft((d) => setSlot(d, i, e.target.value))}
            >
              {NAV_OPTIONS.map((o) => <option key={o.view} value={o.view}>{o.long}</option>)}
            </select>
          </div>
        ))}

        <div className="nav-editor-actions">
          {!sameNav(draft, DEFAULT_NAV) && (
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(DEFAULT_NAV)}>Reset</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => { onSave(draft); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
