// File: src/components/WaterTestScanner.jsx
// Real OCR scanner — replaces the simulated ScanModal.
//
// Flow: pick/take photo → client-side compress → ocr-water-test Edge
// Function (Claude Vision) → review screen ("Here's what your shop
// found") with editable values + confidence → onComplete(readings).
//
// The Edge Function requires an authenticated Supabase session. The app
// currently runs without sign-in, so we transparently create an
// anonymous session on first scan (enable "Allow anonymous sign-ins"
// in Supabase → Authentication → Settings). Anonymous users get a real
// user id, which is what the 10-scans/hour rate limit keys on.

import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Edge-function keys → app state keys
const FIELD_MAP = [
  { ocr: 'free_chlorine', app: 'freeChlor',       label: 'Free chlorine',    unit: 'ppm' },
  { ocr: 'ph',            app: 'pH',              label: 'pH',               unit: ''    },
  { ocr: 'alkalinity',    app: 'alkalinity',      label: 'Total alkalinity', unit: 'ppm' },
  { ocr: 'cyanuric_acid', app: 'cyanuricAcid',    label: 'Cyanuric acid',    unit: 'ppm' },
  { ocr: 'calcium',       app: 'calciumHardness', label: 'Calcium hardness', unit: 'ppm' },
  { ocr: 'salt',          app: 'salt',            label: 'Salt',             unit: 'ppm' },
];

const MAX_DIMENSION = 1600;   // px — plenty for printout text
const JPEG_QUALITY = 0.85;

const CameraIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

// Downscale + re-encode the photo so uploads are fast and cheap.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      resolve({ dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file doesn\'t look like a photo — try again.')); };
    img.src = url;
  });
}

// Make sure we have a session the Edge Function will accept.
async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.session) {
    throw new Error('Couldn\'t start a secure session. Check your connection and try again.');
  }
  return data.session;
}

export default function WaterTestScanner({ onClose, onComplete }) {
  const [state, setState] = useState('pick'); // pick | scanning | review | error
  const [preview, setPreview] = useState(null);
  const [values, setValues] = useState({});   // app-keyed editable strings
  const [confidence, setConfidence] = useState('high');
  const [notes, setNotes] = useState(null);
  const [scansLeft, setScansLeft] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-picking the same file
    setState('scanning');
    setErrorMsg('');

    try {
      const { dataUrl, base64, mediaType } = await compressImage(file);
      setPreview(dataUrl);

      const session = await ensureSession();

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-water-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const friendly = {
          RATE_LIMITED: data.error || 'Scan limit reached — try again in an hour.',
          IMAGE_TOO_LARGE: 'That photo is too large — try again, a bit further from the page is fine.',
          NOT_CONFIGURED: 'Scanning isn\'t available right now — you can still type the readings in.',
        }[data.code] || data.error || 'Couldn\'t read the photo right now — please try again.';
        throw new Error(friendly);
      }

      const readings = data.readings || {};
      const found = FIELD_MAP.filter(f => readings[f.ocr] !== null && readings[f.ocr] !== undefined);

      if (found.length === 0) {
        setState('error');
        setErrorMsg(
          data.notes
            ? `Couldn't find readings in that photo (${data.notes}). Try a flatter, well-lit shot of the printout.`
            : 'Couldn\'t find any readings in that photo. Try a flatter, well-lit shot of the printout.'
        );
        return;
      }

      const next = {};
      for (const f of FIELD_MAP) {
        const v = readings[f.ocr];
        next[f.app] = (v === null || v === undefined) ? '' : String(v);
      }
      setValues(next);
      setConfidence(data.confidence || 'low');
      setNotes(data.notes || null);
      setScansLeft(typeof data.scans_remaining_this_hour === 'number' ? data.scans_remaining_this_hour : null);
      setState('review');
    } catch (err) {
      setState('error');
      setErrorMsg(err.message || 'Something went wrong — please try again.');
    }
  };

  const handleUse = () => {
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
    const result = {
      freeChlor:       num(values.freeChlor),
      pH:              num(values.pH),
      alkalinity:      num(values.alkalinity),
      cyanuricAcid:    num(values.cyanuricAcid),
      calciumHardness: num(values.calciumHardness),
      createdAt: new Date().toISOString(),
      source: 'ocr',
    };
    if (values.salt !== '' && values.salt !== undefined) result.salt = num(values.salt);
    onComplete(result);
    onClose();
  };

  const confidenceTag = confidence === 'high'
    ? { cls: 'tag-good', text: 'High confidence' }
    : confidence === 'medium'
      ? { cls: 'tag-warn', text: 'Medium confidence — please check the values' }
      : { cls: 'tag-warn', text: 'Low confidence — please check every value' };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Scan test results</div>

        {/* Hidden file input — opens camera on mobile */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        {state === 'pick' && (
          <>
            <div className="modal-body">
              Take a photo of your pool shop's printed water test. Your Pool Mate reads the values for you — you check them before anything is saved.
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
              style={{
                border: 'var(--border)', borderRadius: 'var(--r-md)',
                minHeight: 160, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 24, background: 'var(--gray-bg)',
                cursor: 'pointer', color: 'var(--gray-mid)',
              }}
            >
              <span style={{ display: 'flex' }}>{CameraIcon}</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Take a photo</span>
              <span style={{ fontSize: 12, color: 'var(--gray-light)' }}>or choose one from your gallery</span>
            </div>
          </>
        )}

        {state === 'scanning' && (
          <div style={{
            minHeight: 200, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24,
          }}>
            {preview && (
              <img src={preview} alt="Your water test photo"
                   style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 'var(--r-md)', opacity: 0.85 }} />
            )}
            <div className="dot-loader"><span/><span/><span/></div>
            <span style={{ fontSize: 13, color: 'var(--gray-mid)' }}>Reading your test results…</span>
          </div>
        )}

        {state === 'review' && (
          <>
            <div className="modal-body" style={{ marginBottom: 12 }}>
              Here's what your shop found. Check the values, fix anything that's off, then use them.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignItems: 'center' }}>
              <span className={`tag ${confidenceTag.cls}`}>{confidenceTag.text}</span>
              {scansLeft !== null && (
                <span style={{ fontSize: 12, color: 'var(--gray-light)' }}>{scansLeft} scans left this hour</span>
              )}
            </div>
            {notes && (
              <div style={{
                fontSize: 13, color: 'var(--gray-mid)', background: 'var(--gray-bg)',
                borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 16,
              }}>
                {notes}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {FIELD_MAP.filter(f => f.app !== 'salt' || values.salt !== '').map(f => (
                <div key={f.app} className="input-group">
                  <label className="input-label" htmlFor={`scan-${f.app}`}>
                    {f.label}{f.unit ? ` (${f.unit})` : ''}
                  </label>
                  <input
                    id={`scan-${f.app}`}
                    className="input"
                    type="number"
                    inputMode="decimal"
                    placeholder="Not read"
                    value={values[f.app] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.app]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {state === 'error' && (
          <div style={{
            minHeight: 140, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            marginBottom: 24, textAlign: 'center',
          }}>
            <span style={{ fontSize: 14, color: 'var(--gray-dark)', maxWidth: 360 }}>{errorMsg}</span>
            <span style={{ fontSize: 13, color: 'var(--gray-light)' }}>
              You can always type the readings in manually — it takes under a minute.
            </span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {state === 'review' ? 'Discard' : 'Cancel'}
          </button>
          {(state === 'error') && (
            <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
              Try another photo
            </button>
          )}
          {state === 'review' && (
            <button className="btn btn-primary btn-sm" onClick={handleUse}>
              Use these readings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
