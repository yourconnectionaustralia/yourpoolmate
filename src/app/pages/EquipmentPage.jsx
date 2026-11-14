import { useState, useEffect } from 'react';
import { PoolIcon, equipmentIconName } from '../../components/PoolIcon.jsx';
import EquipmentCare from '../../components/EquipmentCare.jsx';
import { EQUIPMENT_PROMPTS } from '../data/equipment.js';
import { formatDate } from '../helpers.js';
import { Icon } from '../icons.jsx';
import { EquipmentForm } from './EquipmentForm.jsx';

// ─────────────────────────────────────────────────────────────────
// EQUIPMENT PAGE
// ─────────────────────────────────────────────────────────────────
export function EquipmentPage({ equipment, onAdd, onUpdate, onDelete, autoOpenAdd, onAutoOpened, careItems = [], onCareDone }) {
  const EMPTY_FORM = { type: 'Pump', brand: '', model: '', notes: '', installed_at: '' };
  const [mode, setMode] = useState('list'); // 'list' | 'new' | item-id string
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startNew = () => { setForm(EMPTY_FORM); setError(''); setMode('new'); };
  // Opening the form from a checklist row pre-fills the type, so the owner
  // never picks it twice.
  const startNewOfType = (type) => { setForm({ ...EMPTY_FORM, type }); setError(''); setMode('new'); };

  // Types still missing — these are the rows the checklist offers.
  const addedTypes = new Set((equipment || []).map(e => e.type));
  const remaining = EQUIPMENT_PROMPTS.filter(pr => !addedTypes.has(pr.type));

  // The walkthrough finishes on "Add my equipment" and lands here. The
  // checklist is now the add UI, so make sure it is what they see.
  useEffect(() => {
    if (autoOpenAdd) {
      setMode('list');
      onAutoOpened?.();
    }
  }, [autoOpenAdd, onAutoOpened]);
  const startEdit = (item) => {
    setForm({
      // Normalise the pre-July-2026 type label so the select matches an option.
      type: item.type === 'Salt Chlorinator' ? 'Chlorinator' : item.type,
      brand: item.brand || '',
      model: item.model || '',
      notes: item.notes || '',
      installed_at: item.installed_at || '',
    });
    setError('');
    setMode(item.id);
  };
  // Save waits for the DB and keeps the form open on failure — a silent
  // console-only error here was beta feedback ("Can't add").
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (mode === 'new') {
        await onAdd(form);
      } else {
        await onUpdate({ ...form, id: mode });
      }
      setMode('list');
    } catch (err) {
      console.error('Equipment save failed:', err);
      setError("Couldn't save that — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Equipment</h1>
        {mode === 'list' && equipment.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={startNew}>+ Add</button>
        )}
      </div>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>Pump, filter, heater, and pool hardware</p>

      {/* Existing equipment list */}
      {equipment.length > 0 && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          {equipment.map((item, i) => (
            <div key={item.id}>
              {mode === item.id ? (
                <div style={{ padding: '16px 0' }}>
                  <div className="eyebrow" style={{ marginBottom: 12 }}>Edit {item.type}</div>
                  <EquipmentForm
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    onCancel={() => setMode('list')}
                    isNew={false}
                    saving={saving}
                    error={error}
                  />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: i < equipment.length - 1 ? 'var(--border)' : 'none',
                }}>
                  <span style={{ flexShrink: 0, color: 'var(--blue)', display: 'inline-flex' }}>
                    <PoolIcon name={equipmentIconName(item.type)} size={22} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--black)' }}>{item.type}</div>
                    <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginTop: 2 }}>
                      {[item.brand, item.model].filter(Boolean).join(' · ') || 'No brand/model added'}
                    </div>
                    {item.installed_at && (
                      <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 2 }}>
                        Installed {formatDate(item.installed_at)}
                      </div>
                    )}
                    {item.notes && (
                      <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 2 }}>{item.notes}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(item)}
                      style={{ fontSize: 17 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDelete(item.id)}
                      style={{ fontSize: 17, color: '#e05555' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <EquipmentCare items={careItems} onDone={onCareDone} />

      {/* Add new inline form */}
      {mode === 'new' && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Add {form.type && form.type !== 'Other' ? form.type.toLowerCase() : 'equipment'}
          </div>
          <EquipmentForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={() => setMode('list')}
            isNew={true}
            saving={saving}
            error={error}
          />
        </div>
      )}

      {/* Checklist — one row per equipment type not yet added. A row leaves
          the list the moment that type has an entry, so what's left on screen
          is exactly what's still missing. */}
      {mode === 'list' && remaining.length > 0 && (
        <div className="card-section">
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {equipment.length === 0 ? 'Add your equipment' : 'Still to add'}
          </div>
          <p style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.5, marginBottom: 12 }}>
            {equipment.length === 0
              ? "Add whatever you have — skip anything you don't. Each one sharpens your reminders."
              : "Anything else on your pool? Skip what you don't have."}
          </p>

          {remaining.map((pr, i) => (
            <div
              key={pr.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: i < remaining.length - 1 ? 'var(--border)' : 'none',
              }}
            >
              <span style={{ flexShrink: 0, color: 'var(--blue)', display: 'inline-flex' }}>
                <PoolIcon name={equipmentIconName(pr.type)} size={22} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--black)' }}>{pr.type}</div>
                <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginTop: 2 }}>{pr.why}</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => startNewOfType(pr.type)}
              >
                Add
              </button>
            </div>
          ))}

          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => startNewOfType('Other')}
          >
            Something else? Add it manually
          </button>
        </div>
      )}

      {/* Every prompted type is covered. */}
      {mode === 'list' && remaining.length === 0 && equipment.length > 0 && (
        <div className="callout callout-success" style={{ marginBottom: 8 }}>
          <span className="callout-icon" style={{ color: 'var(--green)', display: 'inline-flex' }}>
            {Icon.check}
          </span>
          <div className="callout-body">
            That's your whole setup logged. Use <strong>+ Add</strong> if you add another
            piece of gear later.
          </div>
        </div>
      )}

    </div>
  );
}
