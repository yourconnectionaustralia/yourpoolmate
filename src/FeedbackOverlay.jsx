import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase.js';

// ─────────────────────────────────────────────────────────────────
// Page label map — must match the activeView keys in App.jsx
// ─────────────────────────────────────────────────────────────────
function getAUSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'Autumn';
  if (m >= 6 && m <= 8) return 'Winter';
  if (m >= 9 && m <= 11) return 'Spring';
  return 'Summer';
}

const PAGE_LABELS = {
  health:    'Health Score',
  tests:     'Water Tests',
  history:   'Chemistry Log',
  setup:     'Pool Setup',
  equipment: 'Equipment',
  schedule:  `${getAUSeason()} Tips`,
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

  const addNote = () => {
    const text = currentNote.trim();
    if (!text) return;
    setNotes(prev => [
      ...prev,
      {
        page:       activeView,
        page_label: PAGE_LABELS[activeView] || activeView,
        note:       text,
        added_at:   new Date().toISOString(),
      },
    ]);
    setCurrentNote('');
    textareaRef.current?.focus();
  };

  const removeNote = (index) => setNotes(prev => prev.filter((_, i) => i !== index));

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
                  <textarea
                    ref={textareaRef}
                    className="feedback-textarea"
                    placeholder="What needs changing on this page?"
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
                    Add to round
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
                            <span className="feedback-note-text">{n.note}</span>
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
