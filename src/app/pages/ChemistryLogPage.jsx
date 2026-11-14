import { useState } from 'react';
import { PoolIcon } from '../../components/PoolIcon.jsx';
import WaterTrendChart from '../../components/WaterTrendChart.jsx';
import { isCareEvent } from '../../lib/equipmentCare.js';
import RecordExport from '../../components/RecordExport.jsx';
import { calciumBand } from '../../lib/healthScore.js';
import ShareReport from '../../components/ShareReport.jsx';
import { fmtReading, formatDate, scoreFor } from '../helpers.js';
import { Icon } from '../icons.jsx';

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOG PAGE
// ─────────────────────────────────────────────────────────────────
// "Untested for more than 2 months" threshold.
const GAP_DAYS = 60;

// Manual event types offered in the "Add event" form.
const EVENT_TYPE_OPTIONS = [
  { value: 'green_treatment', label: 'Green-pool treatment' },
  { value: 'shock',           label: 'Shock dose' },
  { value: 'drain_refill',    label: 'Drain / refill' },
  { value: 'new_equipment',   label: 'New equipment' },
  { value: 'custom',          label: 'Other / custom' },
];

function eventMeta(type) {
  if (isCareEvent(type)) return { color: 'var(--color-sky)', label: 'Equipment care' };
  return {
    green_treatment: { color: 'var(--green)',     label: 'Green-pool treatment' },
    shock:           { color: 'var(--blue)',      label: 'Shock dose' },
    dose:            { color: 'var(--amber)',     label: 'Dose added' },
    new_equipment:   { color: 'var(--color-sky)', label: 'New equipment' },
    drain_refill:    { color: 'var(--blue)',      label: 'Drain / refill' },
    treatment:       { color: 'var(--green)',     label: 'Treatment' },
    custom:          { color: 'var(--gray-mid)',  label: 'Event' },
  }[type] || { color: 'var(--gray-mid)', label: 'Event' };
}

// Auto-detect stretches with no test for > 2 months (incl. an ongoing gap to today).
function deriveGaps(history) {
  if (!history || history.length === 0) return [];
  const sorted = history.slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = +new Date(sorted[i - 1].createdAt);
    const b = +new Date(sorted[i].createdAt);
    const days = Math.round((b - a) / 86400000);
    if (days > GAP_DAYS) gaps.push({ start: sorted[i - 1].createdAt, end: sorted[i].createdAt, days });
  }
  const last = +new Date(sorted[sorted.length - 1].createdAt);
  const sinceDays = Math.round((Date.now() - last) / 86400000);
  if (sinceDays > GAP_DAYS) {
    gaps.push({ start: sorted[sorted.length - 1].createdAt, end: new Date().toISOString(), days: sinceDays, ongoing: true });
  }
  return gaps;
}

// Auto "new equipment" markers, pulled from the equipment register.
// The install date (owner-entered) beats the row's created_at when known.
function deriveEquipmentEvents(equipment) {
  return (equipment || []).filter(e => e.installed_at || e.created_at).map(e => {
    const make = [e.brand, e.model].filter(Boolean).join(' ');
    return {
      id: `eq-${e.id}`,
      type: 'new_equipment',
      title: make ? `${e.type}: ${make}` : e.type,
      date: e.installed_at || e.created_at,
      source: 'auto',
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOG PAGE  (trend graph + events + history table)
// ─────────────────────────────────────────────────────────────────
export function ChemistryLogPage({ history, events = [], equipment = [], poolProfile, saltRange, onAddEvent, onDeleteEvent, onEditTest, onAddPastTest, onViewPrintout, owner, getPhotoUrl }) {
  const today = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'green_treatment', title: '', date: today, notes: '' });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submitEvent = () => {
    if (!form.title.trim()) return;
    onAddEvent?.({
      type: form.type,
      title: form.title.trim(),
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      notes: form.notes.trim(),
    });
    setForm({ type: 'green_treatment', title: '', date: today, notes: '' });
    setShowForm(false);
  };

  if (!history || history.length === 0) {
    return (
      <div>
        <h1 className="page-title">Chemistry log</h1>
        <p className="page-subtitle">Your test history over time</p>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.droplet}</div>
            <div className="empty-state-title">No history yet</div>
            <div className="empty-state-body">
              Log two or more water tests and your chemistry trends will appear here.
            </div>
            {onAddPastTest && (
              <button className="btn btn-ghost btn-sm" onClick={onAddPastTest}>+ Add a past result</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const scored = history.map(t => ({ ...t, score: scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover) }));
  const equipEvents = deriveEquipmentEvents(equipment);
  const allEvents = [...events, ...equipEvents].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const gaps = deriveGaps(history);

  return (
    <div>
      <h1 className="page-title">Chemistry log</h1>
      <p className="page-subtitle">{history.length} tests logged</p>

      {/* Trend graph */}
      <div className="card-section">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Trends over time</div>
        {history.length < 2 ? (
          <p style={{ fontSize: 17, color: 'var(--gray-mid)', marginBottom: 12 }}>
            One test logged. Log another and the line graph will chart your trend.
          </p>
        ) : null}
        <WaterTrendChart history={scored} events={allEvents} gaps={gaps} saltRange={saltRange} calciumBand={calciumBand(poolProfile?.surface)} />
      </div>

      {/* Events */}
      <div className="card-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="eyebrow" style={{ margin: 0 }}>Pool events</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ Add event'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: 16 }}>
            <div className="input-group">
              <label className="input-label">Event type</label>
              <select className="input" value={form.type} onChange={e => setField('type', e.target.value)}>
                {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Description</label>
              <input
                className="input"
                placeholder="e.g. Treated green pool — 2 L liquid chlorine + flocculant"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Date</label>
              <input className="input" type="date" max={today} value={form.date} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Notes (optional)</label>
              <input className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={submitEvent} disabled={!form.title.trim()}>
              Save event
            </button>
          </div>
        )}

        {allEvents.length === 0 && gaps.length === 0 ? (
          <p style={{ fontSize: 17, color: 'var(--gray-mid)' }}>
            No events yet. Add green-pool treatments, shock doses or equipment changes to see them on your timeline.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gaps.map((g, i) => (
              <div key={`gap-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-line)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--amber)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--gray-dark)' }}>
                    Untested for {g.days} days{g.ongoing ? ' (ongoing)' : ''}
                  </div>
                  <div style={{ fontSize: 17, color: 'var(--gray-mid)' }}>
                    {formatDate(g.start)} → {g.ongoing ? 'now' : formatDate(g.end)} · auto-detected
                  </div>
                </div>
                <span className="tag tag-warn">Gap</span>
              </div>
            ))}
            {allEvents.slice().reverse().map((e) => {
              const m = eventMeta(e.type);
              const isAuto = e.source === 'auto';
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-line)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--gray-dark)' }}>{e.title}</div>
                    <div style={{ fontSize: 17, color: 'var(--gray-mid)' }}>
                      {m.label} · {formatDate(e.date)}{e.notes ? ` · ${e.notes}` : ''}
                    </div>
                  </div>
                  {isAuto ? (
                    <span className="tag tag-neutral">auto</span>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label="Delete event"
                      onClick={() => onDeleteEvent?.(e.id)}
                      style={{ minWidth: 44, minHeight: 44, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <PoolIcon name="close" size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecordExport
        owner={owner}
        pool={poolProfile}
        equipment={equipment}
        tests={history}
        events={events}
        scoreFn={(t) => scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover)}
        getPhotoUrl={getPhotoUrl}
      />

      <ShareReport
        saltRange={saltRange}
        pool={poolProfile}
        tests={history}
        events={events}
        scoreFn={(t) => scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover)}
      />

      {/* All tests: each can be edited or deleted from here */}
      <div className="card-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div className="eyebrow" style={{ margin: 0 }}>All tests</div>
          {onAddPastTest && (
            <button className="btn btn-ghost btn-sm" onClick={onAddPastTest}>+ Add a past result</button>
          )}
        </div>
        <div className="test-list">
          {history.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((t) => {
            const score = scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover);
            const scoreClass = score >= 80 ? 'tag-good' : score >= 60 ? 'tag-warn' : 'tag-bad';
            return (
              <div className="test-row" key={t.id || t.createdAt}>
                <div className="test-row-date">
                  {formatDate(t.createdAt)} <span className={`tag ${scoreClass}`}>{score}</span>
                  {t.source === 'shop_import' && <span className="tag tag-neutral" style={{ marginLeft: 6 }}>Past result</span>}
                </div>
                <div className="test-row-readings">
                  Chlorine {fmtReading(t.freeChlor, 'ppm')} · pH {fmtReading(t.pH, '')} · Alkalinity {fmtReading(t.alkalinity, 'ppm')}
                </div>
                {t.editedAt && (
                  <div className="test-row-edited">
                    Edited {formatDate(t.editedAt)}.{originalSummary(t.originalReadings) ? ` First saved as ${originalSummary(t.originalReadings)}.` : ''}
                  </div>
                )}
                {t.id && onEditTest && (
                  <div className="test-row-actions">
                    {t.printoutPath && onViewPrintout && (
                      <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}
                              aria-label={`View the printout photo from ${formatDate(t.createdAt)}`}
                              onClick={() => onViewPrintout(t.printoutPath)}>Photo</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ minHeight: 44, minWidth: 64 }}
                            aria-label={`Edit the test from ${formatDate(t.createdAt)}`}
                            onClick={() => onEditTest(t)}>Edit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// "pH 7.5, chlorine 2 ppm, alkalinity 100 ppm" from the readings as first saved.
function originalSummary(orig) {
  if (!orig) return '';
  const bits = [];
  if (orig.free_chlorine != null) bits.push(`chlorine ${orig.free_chlorine} ppm`);
  if (orig.ph != null) bits.push(`pH ${orig.ph}`);
  if (orig.alkalinity != null) bits.push(`alkalinity ${orig.alkalinity} ppm`);
  return bits.join(', ');
}
