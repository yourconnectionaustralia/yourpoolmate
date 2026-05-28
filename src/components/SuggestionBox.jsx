// ─────────────────────────────────────────────────────────────────
// SuggestionBox.jsx — Figma-style in-app feedback widget
//
// Behaviour:
//   1. Floating "+" FAB at bottom-right is always visible.
//   2. Tap "+" → enter "pin drop" mode. Cursor becomes a crosshair,
//      a translucent overlay invites the user to tap any element.
//   3. Tap anywhere → drop a pin at that viewport position and open
//      a popover with a textarea for the comment.
//   4. Multiple pins persist (localStorage) so the user can navigate
//      across views, drop more pins, then "Submit all" in one batch.
//   5. Submitting POSTs all pins to the `submit-suggestions` Edge
//      Function which writes to Supabase and emails the admin.
//
// Brand:
//   • Ocean #0077B6, Sky #00B4D8, Foam #90E0EF, white surfaces.
//   • Light mode, mobile-first (375px base), flat icons.
//
// Props:
//   • currentView (string)         — passed by App.jsx so pins know
//                                    which page they were dropped on.
//   • supabaseClient (optional)    — pass through if you want auth
//                                    headers. Falls back to anon.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

const STORAGE_KEY = 'poolconnection.suggestionPins.v1';

// Endpoint resolved at runtime against the configured Supabase project
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/submit-suggestions`;

// Brand tokens (kept inline so this widget is drop-in / no CSS file edits required)
const C = {
  ocean: '#0077B6',
  sky: '#00B4D8',
  foam: '#90E0EF',
  white: '#FFFFFF',
  ink: '#0F2A3B',
  mute: '#5B7280',
  line: '#E5EEF3',
  shadow: '0 10px 30px rgba(0,119,182,0.18)',
  shadowSm: '0 4px 14px rgba(0,119,182,0.18)',
};

// Generate a short, URL-safe batch id (no crypto dependency needed)
const newBatchId = () =>
  `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const newPinId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────
export function SuggestionBox({ currentView = 'unknown' }) {
  const [pins, setPins] = useState([]);          // {id, view, x, y, text, createdAt}
  const [dropMode, setDropMode] = useState(false);
  const [openPinId, setOpenPinId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);      // {kind:'ok'|'err', msg:string}

  // ── Load + persist pins ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPins(JSON.parse(raw));
    } catch (e) {
      // ignore — corrupt JSON, treat as empty
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch (e) {
      // quota — silently drop, the worst case is they re-add this session's pins
    }
  }, [pins]);

  // ── Drop mode handlers ──
  // Use pointerdown (not click) so mobile touch fires immediately — no 300ms delay.
  // e.clientX / e.clientY work identically for mouse, stylus, and finger.
  const handleViewportPointerDown = useCallback(
    (e) => {
      if (!dropMode) return;

      // Ignore taps on our own widget chrome (FAB, panel, pins, popovers)
      const target = e.target;
      if (target.closest('[data-sb-chrome]')) return;

      e.preventDefault();
      e.stopPropagation();

      const id = newPinId();
      const pin = {
        id,
        view: currentView,
        path: typeof window !== 'undefined' ? window.location.pathname : '/',
        x: e.clientX,
        y: e.clientY,
        text: '',
        createdAt: new Date().toISOString(),
      };
      setPins((prev) => [...prev, pin]);
      setOpenPinId(id);
      setDropMode(false);
    },
    [dropMode, currentView]
  );

  useEffect(() => {
    if (!dropMode) return;
    // Capture phase so we beat any inner handlers on the page
    document.addEventListener('pointerdown', handleViewportPointerDown, true);
    document.body.style.cursor = 'crosshair';
    return () => {
      document.removeEventListener('pointerdown', handleViewportPointerDown, true);
      document.body.style.cursor = '';
    };
  }, [dropMode, handleViewportPointerDown]);

  // ── Pin CRUD ──
  const updatePin = (id, patch) =>
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const removePin = (id) =>
    setPins((prev) => prev.filter((p) => p.id !== id));

  const clearAll = () => {
    setPins([]);
    setOpenPinId(null);
  };

  // ── Submit batch ──
  const submitAll = async () => {
    const populated = pins.filter((p) => p.text.trim().length > 0);
    if (populated.length === 0) {
      setToast({ kind: 'err', msg: 'Add a comment to at least one pin first.' });
      return;
    }
    setSubmitting(true);

    const batchId = newBatchId();
    const payload = {
      batchId,
      submittedAt: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      viewport: {
        w: typeof window !== 'undefined' ? window.innerWidth : null,
        h: typeof window !== 'undefined' ? window.innerHeight : null,
      },
      pins: populated.map((p) => ({
        id: p.id,
        view: p.view,
        path: p.path,
        x: Math.round(p.x),
        y: Math.round(p.y),
        text: p.text.trim(),
        createdAt: p.createdAt,
      })),
    };

    try {
      // Attach the user's JWT if signed in, otherwise anon key (Edge Function accepts both)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || SUPABASE_ANON_KEY;

      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body || 'submission failed'}`);
      }

      setToast({ kind: 'ok', msg: `Thanks — ${populated.length} suggestion${populated.length === 1 ? '' : 's'} sent.` });
      clearAll();
      setPanelOpen(false);
    } catch (err) {
      setToast({ kind: 'err', msg: `Could not send: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  const pinsOnThisView = pins.filter((p) => p.view === currentView);

  return (
    <>
      {/* Drop-mode tint */}
      {dropMode && (
        <div
          data-sb-chrome
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,119,182,0.06)',
            backdropFilter: 'saturate(1.05)',
            zIndex: 9990,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Drop-mode coachmark — includes a visible cancel button for mobile (no Esc key) */}
      {dropMode && (
        <div
          data-sb-chrome
          role="status"
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: C.ocean,
            color: C.white,
            padding: '8px 8px 8px 14px',
            borderRadius: 999,
            font: '500 13px/1.3 "DM Sans", system-ui, sans-serif',
            boxShadow: C.shadow,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.foam, flexShrink: 0 }} />
          Tap anywhere to mark feedback
          <button
            type="button"
            data-sb-chrome
            onClick={() => setDropMode(false)}
            aria-label="Cancel pin drop"
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              borderRadius: 999,
              color: C.white,
              font: '600 12px/1 "DM Sans", system-ui, sans-serif',
              padding: '5px 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Drop-mode Escape key (desktop fallback) */}
      {dropMode && <EscapeListener onEscape={() => setDropMode(false)} />}

      {/* Render all pins on this view */}
      {pinsOnThisView.map((p) => (
        <PinMarker
          key={p.id}
          pin={p}
          isOpen={openPinId === p.id}
          onOpen={() => setOpenPinId(p.id)}
          onClose={() => setOpenPinId(null)}
          onChange={(text) => updatePin(p.id, { text })}
          onDelete={() => {
            removePin(p.id);
            setOpenPinId(null);
          }}
        />
      ))}

      {/* Suggestions panel */}
      {panelOpen && (
        <SuggestionsPanel
          pins={pins}
          submitting={submitting}
          onClose={() => setPanelOpen(false)}
          onJump={(pin) => {
            setOpenPinId(pin.id);
            setPanelOpen(false);
          }}
          onDelete={removePin}
          onClearAll={clearAll}
          onSubmit={submitAll}
        />
      )}

      {/* Floating action button */}
      <div
        data-sb-chrome
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 9995,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        {pins.length > 0 && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            style={{
              ...fabSecondaryStyle,
              padding: '8px 12px',
              borderRadius: 999,
              font: '600 12px/1 "DM Sans", system-ui, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            aria-label={`Review ${pins.length} pending suggestions`}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: C.ocean,
              color: C.white,
              font: '600 11px/1 "DM Sans", system-ui, sans-serif',
            }}>
              {pins.length}
            </span>
            Review &amp; send
          </button>
        )}

        <button
          type="button"
          onClick={() => setDropMode((m) => !m)}
          aria-label={dropMode ? 'Cancel feedback pin' : 'Drop a feedback pin'}
          aria-pressed={dropMode}
          style={{
            ...fabPrimaryStyle,
            background: dropMode ? C.ink : C.ocean,
            transform: dropMode ? 'rotate(45deg)' : 'rotate(0)',
            transition: 'transform 160ms ease, background 160ms ease',
          }}
        >
          <PlusIcon />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          data-sb-chrome
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 90,
            transform: 'translateX(-50%)',
            background: toast.kind === 'ok' ? C.ocean : '#B0263C',
            color: C.white,
            padding: '10px 16px',
            borderRadius: 10,
            font: '500 13px/1.4 "DM Sans", system-ui, sans-serif',
            boxShadow: C.shadow,
            zIndex: 10001,
            maxWidth: 'calc(100vw - 36px)',
          }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}

export default SuggestionBox;

// ─────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────

function PinMarker({ pin, isOpen, onOpen, onClose, onChange, onDelete }) {
  // Keep the popover within the viewport
  const popover = isOpen ? (
    <PinPopover
      x={pin.x}
      y={pin.y}
      value={pin.text}
      onChange={onChange}
      onClose={onClose}
      onDelete={onDelete}
    />
  ) : null;

  return (
    <>
      <button
        data-sb-chrome
        type="button"
        onClick={onOpen}
        aria-label={pin.text ? `Edit comment: ${pin.text.slice(0, 40)}` : 'Add comment'}
        style={{
          position: 'fixed',
          left: pin.x - 14,
          top: pin.y - 28,
          width: 28,
          height: 28,
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          background: pin.text ? '#0077B6' : '#00B4D8',
          border: '2px solid #FFFFFF',
          boxShadow: '0 4px 14px rgba(0,119,182,0.35)',
          color: '#FFFFFF',
          cursor: 'pointer',
          padding: 0,
          zIndex: 9996,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ transform: 'rotate(45deg)', font: '600 12px/1 "DM Sans", system-ui, sans-serif' }}>
          {pin.text ? '•' : '+'}
        </span>
      </button>
      {popover}
    </>
  );
}

function PinPopover({ x, y, value, onChange, onClose, onDelete }) {
  const ref = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  // Position the popover so it stays in viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
  const W = Math.min(280, vw - 24);
  const H = 168;
  let left = x + 14;
  let top = y + 6;
  if (left + W > vw - 8) left = Math.max(8, x - W - 14);
  if (top + H > vh - 8) top = Math.max(8, y - H - 14);

  // Close on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target)) return;
      if (e.target.closest('[data-sb-pin-marker]')) return;
      onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div
      data-sb-chrome
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top,
        width: W,
        background: '#FFFFFF',
        border: '1px solid #E5EEF3',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,119,182,0.18)',
        padding: 12,
        zIndex: 9997,
        font: '400 13px/1.45 "DM Sans", system-ui, sans-serif',
        color: '#0F2A3B',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ font: '600 12px/1 "Space Grotesk", system-ui, sans-serif', letterSpacing: 0.4, textTransform: 'uppercase', color: '#5B7280' }}>
          Your comment
        </strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={iconBtnStyle}
        >
          ✕
        </button>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What feels off, missing, or worth changing?"
        rows={4}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          padding: 8,
          border: '1px solid #E5EEF3',
          borderRadius: 8,
          font: '400 13px/1.45 "DM Sans", system-ui, sans-serif',
          color: '#0F2A3B',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#00B4D8')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#E5EEF3')}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={onDelete} style={{ ...btnGhostStyle, color: '#B0263C' }}>
          Delete pin
        </button>
        <button type="button" onClick={onClose} style={btnPrimaryStyle}>
          Save
        </button>
      </div>
    </div>
  );
}

function SuggestionsPanel({ pins, submitting, onClose, onJump, onDelete, onClearAll, onSubmit }) {
  const populated = pins.filter((p) => p.text.trim().length > 0);
  return (
    <>
      <div
        data-sb-chrome
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,42,59,0.35)',
          zIndex: 9998,
        }}
      />
      <aside
        data-sb-chrome
        role="dialog"
        aria-label="Pending suggestions"
        style={{
          position: 'fixed',
          right: 0, top: 0, bottom: 0,
          width: 'min(420px, 100vw)',
          background: '#FFFFFF',
          boxShadow: '0 10px 30px rgba(0,119,182,0.18)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          font: '400 14px/1.5 "DM Sans", system-ui, sans-serif',
          color: '#0F2A3B',
        }}
      >
        <header style={{ padding: '14px 16px', borderBottom: '1px solid #E5EEF3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '600 16px/1.2 "Space Grotesk", system-ui, sans-serif' }}>Your suggestions</div>
            <div style={{ font: '400 12px/1.4 "DM Sans", system-ui, sans-serif', color: '#5B7280', marginTop: 2 }}>
              {pins.length} pin{pins.length === 1 ? '' : 's'} · {populated.length} with comment{populated.length === 1 ? '' : 's'}
            </div>
          </div>
          <button type="button" onClick={onClose} style={iconBtnStyle} aria-label="Close">✕</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 16px' }}>
          {pins.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#5B7280' }}>
              <p style={{ margin: 0 }}>No pins yet.</p>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                Close this panel and tap the <strong>+</strong> button to drop your first one.
              </p>
            </div>
          )}
          {pins.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #E5EEF3',
                borderRadius: 10,
                padding: 12,
                margin: 8,
                background: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ font: '600 12px/1 "Space Grotesk", system-ui, sans-serif', color: '#0077B6', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  {p.view || 'unknown view'}
                </span>
                <button type="button" onClick={() => onDelete(p.id)} style={{ ...iconBtnStyle, color: '#B0263C' }} aria-label="Delete pin">
                  ✕
                </button>
              </div>
              <div style={{ font: '400 13px/1.5 "DM Sans", system-ui, sans-serif', color: '#0F2A3B', whiteSpace: 'pre-wrap' }}>
                {p.text.trim() ? p.text : <em style={{ color: '#5B7280' }}>No comment yet</em>}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => onJump(p)} style={btnGhostStyle}>
                  Edit on page
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer style={{ padding: 12, borderTop: '1px solid #E5EEF3', display: 'flex', gap: 8, justifyContent: 'space-between', background: '#F7FBFD' }}>
          <button type="button" onClick={onClearAll} disabled={pins.length === 0} style={{ ...btnGhostStyle, color: '#B0263C' }}>
            Clear all
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || populated.length === 0}
            style={{ ...btnPrimaryStyle, opacity: submitting || populated.length === 0 ? 0.6 : 1 }}
          >
            {submitting ? 'Sending…' : `Send ${populated.length || ''} suggestion${populated.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      </aside>
    </>
  );
}

function EscapeListener({ onEscape }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscape]);
  return null;
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared inline styles
// ─────────────────────────────────────────────────────────────────
const fabPrimaryStyle = {
  width: 52,
  height: 52,
  borderRadius: '50%',
  border: 'none',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 10px 30px rgba(0,119,182,0.35)',
};

const fabSecondaryStyle = {
  background: '#FFFFFF',
  color: '#0F2A3B',
  border: '1px solid #E5EEF3',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(0,119,182,0.18)',
};

const iconBtnStyle = {
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  color: '#5B7280',
  font: '600 16px/1 "DM Sans", system-ui, sans-serif',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
};

const btnPrimaryStyle = {
  background: '#0077B6',
  color: '#FFFFFF',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 8,
  font: '600 13px/1 "DM Sans", system-ui, sans-serif',
  cursor: 'pointer',
};

const btnGhostStyle = {
  background: 'transparent',
  color: '#0F2A3B',
  border: '1px solid #E5EEF3',
  padding: '8px 12px',
  borderRadius: 8,
  font: '500 13px/1 "DM Sans", system-ui, sans-serif',
  cursor: 'pointer',
};
