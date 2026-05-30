import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase.js';

// ─────────────────────────────────────────────────────────────────
// Page label map — must match the activeView keys in App.jsx
// ─────────────────────────────────────────────────────────────────
const PAGE_LABELS = {
  health:    'Health Score',
  tests:     'Water Tests',
  history:   'Chemistry Log',
  setup:     'Pool Setup',
  equipment: 'Equipment',
  schedule:  'Seasonal Tips',
  profile:   'Profile',
};

const STORAGE_KEY = 'ypm_feedback_round';

// ─────────────────────────────────────────────────────────────────
// FEEDBACK OVERLAY
// Floating panel for beta feedback rounds.
// Notes accumulate across page navigation (localStorage) until
// the user is ready to submit the full round to Supabase.
// ─────────────────────────────────────────────────────────────────
export default function FeedbackOverlay({ activeView }) {
  const [open, setOpen]               = useState(false);
  const [notes, setNotes]             = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  });
  const [currentNote, setCurrentNote] = useState('');
  const [roundLabel, setRoundLabel]   = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [placing, setPlacing]         = useState(false);   // crosshair pin-placement mode
  const [pendingPin, setPendingPin]   = useState(null);    // {x, y, page} captured, awaiting note text
  const [openPinIdx, setOpenPinIdx]   = useState(null);    // which placed pin's bubble is showing
  const textareaRef                   = useRef(null);

  // Keep localStorage in sync with notes state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (open && textareaRef.current) {
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Allow Esc to cancel pin-placement mode
  useEffect(() => {
    if (!placing) return;
    const onKey = (e) => { if (e.key === 'Escape') cancelPlacing(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing]);

  // Enter placement mode: hide the panel so the whole page is tappable
  const startPlacing = () => { setOpen(false); setPlacing(true); };
  const cancelPlacing = () => { setPlacing(false); setOpen(true); };

  // Capture the tap/click location (document coordinates survive scrolling)
  const handlePlaceClick = (e) => {
    setPendingPin({ x: Math.round(e.pageX), y: Math.round(e.pageY), page: activeView });
    setPlacing(false);
    setOpen(true);
  };

  const addNote = () => {
    const text = currentNote.trim();
    if (!text) return;
    setNotes(prev => [
      ...prev,
      {
        page:       pendingPin ? pendingPin.page : activeView,
        page_label: PAGE_LABELS[pendingPin ? pendingPin.page : activeView] || activeView,
        note:       text,
        x:          pendingPin ? pendingPin.x : null,
        y:          pendingPin ? pendingPin.y : null,
        added_at:   new Date().toISOString(),
      },
    ]);
    setCurrentNote('');
    setPendingPin(null);
    textareaRef.current?.focus();
  };

  const removeNote = (index) => {
    setNotes(prev => prev.filter((_, i) => i !== index));
    setOpenPinIdx(null);
  };

  // Pins for the current page (placed notes only), kept in original order so
  // their numbers match the in-panel list.
  const pagePins = notes
    .map((n, i) => ({ ...n, _idx: i }))
    .filter(n => n.page === activeView && n.x != null && n.y != null);

  const clearRound = () => {
    if (!window.confirm('Clear all notes in this round?')) return;
    setNotes([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const submitRound = async () => {
    if (notes.length === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback_rounds').insert({
        round_label: roundLabel.trim() || `Round – ${new Date().toLocaleDateString('en-AU')}`,
        notes,
        device_info: navigator.userAgent,
      });
      if (error) throw error;
      setNotes([]);
      setRoundLabel('');
      localStorage.removeItem(STORAGE_KEY);
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setOpen(false); }, 2400);
    } catch {
      alert('Could not submit — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group notes by page_label for display
  const grouped = notes.reduce((acc, n, i) => {
    if (!acc[n.page_label]) acc[n.page_label] = [];
    acc[n.page_label].push({ ...n, _idx: i });
    return acc;
  }, {});

  return (
    <>
      {/* Floating action button */}
      <button
        className="feedback-fab"
        onClick={() => setOpen(v => !v)}
        aria-label="Open feedback panel"
        title="Feedback"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {notes.length > 0 && (
          <span className="feedback-fab-badge">{notes.length}</span>
        )}
      </button>

      {/* Placed-feedback pins for the current page (document-anchored) */}
      {pagePins.length > 0 && !placing && (
        <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 307 }}>
          {pagePins.map((n, i) => (
            <div
              key={n._idx}
              style={{ position: 'absolute', left: n.x, top: n.y, pointerEvents: 'auto' }}
            >
              <button
                onClick={() => setOpenPinIdx(prev => (prev === n._idx ? null : n._idx))}
                aria-label={`Feedback pin ${i + 1}`}
                style={{
                  position: 'absolute', left: 0, top: 0,
                  transform: 'translate(-50%, -50%)',
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--water-deep)', color: 'var(--white)',
                  border: '2px solid var(--white)', boxShadow: 'var(--shadow-float)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {i + 1}
              </button>

              {openPinIdx === n._idx && (
                <div style={{
                  position: 'absolute', left: 0, top: 6,
                  transform: 'translateX(-50%)',
                  width: 200, background: 'var(--white)',
                  border: 'var(--border)', borderRadius: 'var(--r-sm)',
                  boxShadow: 'var(--shadow-modal)', padding: '10px 12px', zIndex: 1,
                }}>
                  <div style={{ fontSize: 12, color: 'var(--gray-dark)', lineHeight: 1.5, marginBottom: 6 }}>
                    {n.note}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--gray-light)' }}>{n.x}, {n.y}</span>
                    <button
                      onClick={() => removeNote(n._idx)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 11, padding: 0, textDecoration: 'underline' }}
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

      {/* Pin-placement capture layer */}
      {placing && (
        <div
          onClick={handlePlaceClick}
          style={{
            position: 'fixed', inset: 0, zIndex: 320,
            cursor: 'crosshair',
            background: 'rgba(35,131,226,0.06)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: 'calc(var(--topnav-h) + 12px)', left: '50%',
              transform: 'translateX(-50%)', cursor: 'default',
              background: 'var(--water-deep)', color: 'var(--white)',
              borderRadius: 'var(--r-full)', padding: '8px 14px',
              fontSize: 13, fontWeight: 500, boxShadow: 'var(--shadow-float)',
              display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap',
            }}
          >
            <span>Tap the spot you want to flag</span>
            <button
              onClick={cancelPlacing}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.2)', color: 'var(--white)',
                borderRadius: 'var(--r-xs)', padding: '3px 8px', fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Backdrop + panel */}
      {open && (
        <>
          <div className="feedback-backdrop" onClick={() => setOpen(false)} />
          <div className="feedback-panel">

            {/* Header */}
            <div className="feedback-panel-header">
              <span className="feedback-panel-title">Feedback round</span>
              {notes.length > 0 && (
                <span className="feedback-round-count">
                  {notes.length} note{notes.length !== 1 ? 's' : ''}
                </span>
              )}
              <button className="feedback-panel-close" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {submitted ? (
              <div className="feedback-success">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 12 10 18 20 6"/>
                </svg>
                <span>Round submitted — thank you!</span>
              </div>
            ) : (
              <div className="feedback-panel-body">

                {/* Add a note for the current page */}
                <div className="feedback-add-section">
                  <div className="feedback-page-label">
                    Page: <strong>{PAGE_LABELS[activeView] || activeView}</strong>
                  </div>

                  {/* Pin-to-spot control */}
                  {pendingPin ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'var(--water-pale)', color: 'var(--water-mid)',
                      borderRadius: 'var(--r-sm)', padding: '7px 10px', marginBottom: 8,
                      fontSize: 12, fontWeight: 500,
                    }}>
                      <span aria-hidden="true">📍</span>
                      <span style={{ flex: 1 }}>
                        Pinned at {pendingPin.x}, {pendingPin.y} — add your note below
                      </span>
                      <button
                        onClick={() => setPendingPin(null)}
                        aria-label="Clear pin"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--water-mid)', padding: 0, display: 'flex' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', marginBottom: 8, justifyContent: 'center' }}
                      onClick={startPlacing}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                        <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>
                      </svg>
                      Pin a spot on the page
                    </button>
                  )}

                  <textarea
                    ref={textareaRef}
                    className="feedback-textarea"
                    placeholder={pendingPin ? 'What needs changing at this spot?' : 'What needs changing on this page?'}
                    value={currentNote}
                    onChange={e => setCurrentNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
                    rows={3}
                  />
                  <div style={{ fontSize: 11, color: 'var(--gray-light)', marginTop: 4 }}>
                    ⌘↵ to add
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={addNote}
                    disabled={!currentNote.trim()}
                  >
                    {pendingPin ? 'Add pinned note' : 'Add to round'}
                  </button>
                </div>

                {/* Notes accumulated so far */}
                {notes.length > 0 && (
                  <div className="feedback-notes-section">
                    <div className="feedback-notes-header">
                      <span className="feedback-notes-label">This round</span>
                      <button className="feedback-clear-link" onClick={clearRound}>Clear all</button>
                    </div>

                    {Object.entries(grouped).map(([pageLabel, pageNotes]) => (
                      <div key={pageLabel} className="feedback-page-group">
                        <div className="feedback-page-group-name">{pageLabel}</div>
                        {pageNotes.map(n => (
                          <div key={n._idx} className="feedback-note-row">
                            <span className="feedback-note-text">
                              {n.x != null && (
                                <span
                                  title={`Pinned at ${n.x}, ${n.y}`}
                                  style={{ color: 'var(--water-mid)', fontWeight: 600, marginRight: 4 }}
                                >📍</span>
                              )}
                              {n.note}
                            </span>
                            <button
                              className="feedback-note-remove"
                              onClick={() => removeNote(n._idx)}
                              aria-label="Remove note"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Round label + submit */}
                    <div className="feedback-submit-section">
                      <input
                        className="input"
                        style={{ fontSize: 13, marginBottom: 8 }}
                        placeholder="Round name (optional) — e.g. Beta round 1"
                        value={roundLabel}
                        onChange={e => setRoundLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitRound(); }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%' }}
                        onClick={submitRound}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <span className="dot-loader"><span/><span/><span/></span>
                        ) : (
                          `Submit round · ${notes.length} note${notes.length !== 1 ? 's' : ''}`
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
