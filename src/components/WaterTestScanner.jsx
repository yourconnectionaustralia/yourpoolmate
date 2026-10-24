// File: src/components/WaterTestScanner.jsx
// Real OCR scanner — replaces the simulated ScanModal.
//
// Flow: pick/take photos → client-side compress → ocr-water-test Edge
// Function (Claude Vision, one call per photo) → review screen ("Here's what
// your shop found") with editable values + confidence → onComplete(readings).
// Several photos (a printout that runs over two pages) are read one by one and
// merged: a later photo only fills readings the earlier ones did not find.
//
// The Edge Function requires an authenticated Supabase session. The app
// currently runs without sign-in, so we transparently create an
// anonymous session on first scan (enable "Allow anonymous sign-ins"
// in Supabase → Authentication → Settings). Anonymous users get a real
// user id, which is what the 10-scans/hour rate limit keys on.

import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompress.js';
import { SCAN_FIELDS, conflictMessage, daysOld, duplicateTest, hasReadings, mergeMeta, mergeScans, volumeNotice } from '../lib/scanMerge.js';
import { isoFromDateInput, toDateInput } from '../lib/testFields.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Edge-function keys → app state keys (see lib/scanMerge.js for the list).
const FIELD_MAP = SCAN_FIELDS.map((f) => ({ ...f, unit: f.app === 'pH' ? '' : 'ppm' }));

const CameraIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

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

const MAX_PHOTOS = 4;

// Read one photo. Throws an Error with a plain-English message.
async function scanPhoto(file, session) {
  const { dataUrl, base64, mediaType, blob } = await compressImage(file);
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
  return { dataUrl, blob, data };
}

// poolVolumeL: the volume in Pool setup, to check against the printout's.
// history: saved tests, to warn when this printout is already in the record.
export default function WaterTestScanner({ onClose, onComplete, poolVolumeL = null, history = [] }) {
  const [state, setState] = useState('pick'); // pick | scanning | review | adding | error
  const [preview, setPreview] = useState(null);
  const [values, setValues] = useState({});   // app-keyed editable strings
  const [confidence, setConfidence] = useState('high');
  const [notes, setNotes] = useState(null);
  const [scansLeft, setScansLeft] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [progress, setProgress] = useState(null);   // { n, of } while photos are read
  const [notice, setNotice] = useState('');         // review-screen message after adding photos
  const [testDate, setTestDate] = useState(() => toDateInput(new Date().toISOString()));
  const [dateSource, setDateSource] = useState('today'); // 'printout' | 'today' | 'you'
  const [printoutVolumeL, setPrintoutVolumeL] = useState(null);
  const fileRef = useRef(null);      // camera
  const galleryRef = useRef(null);   // photo library, several at once
  const intent = useRef('replace');  // 'replace' = start over, 'add' = merge into what is on screen

  const choose = (ref, how) => { intent.current = how; ref.current?.click(); };

  const handleFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
    if (!picked.length) return;
    const files = picked.slice(0, MAX_PHOTOS);
    const adding = intent.current === 'add' && state === 'review';
    setNotice('');
    setErrorMsg('');
    setProgress({ n: 1, of: files.length });
    setState(adding ? 'adding' : 'scanning');

    const failBack = (message) => {
      setProgress(null);
      if (adding) { setNotice(message); setState('review'); } else { setErrorMsg(message); setState('error'); }
    };

    let session;
    try {
      session = await ensureSession();
    } catch (err) {
      failBack(err.message || 'Something went wrong — please try again.');
      return;
    }

    const read = [];
    let unreadable = 0;
    let lastNote = null;
    let stopped = '';
    for (let i = 0; i < files.length; i += 1) {
      setProgress({ n: i + 1, of: files.length });
      try {
        const r = await scanPhoto(files[i], session);
        if (hasReadings(r.data.readings)) read.push(r);
        else { unreadable += 1; lastNote = r.data.notes || lastNote; }
      } catch (err) {
        stopped = err.message || 'Something went wrong — please try again.';
        break;
      }
    }

    if (read.length === 0) {
      failBack(stopped || (lastNote
        ? `Couldn't find readings in that photo (${lastNote}). Try a flatter, well-lit shot of the printout.`
        : 'Couldn\'t find any readings in that photo. Try a flatter, well-lit shot of the printout.'));
      return;
    }

    // Merge: keep what is already on screen, fill only the gaps, flag clashes.
    const merged = mergeScans(
      adding ? values : {},
      read.map(r => r.data),
      adding ? confidence : 'high',
      adding ? notes : null,
    );
    const last = read[read.length - 1].data;

    // The test date and pool size printed on the printout. A date the owner has
    // typed is never replaced by a later photo.
    const meta = mergeMeta(
      adding ? { testDate: dateSource === 'printout' ? testDate : null, poolVolumeL: printoutVolumeL } : {},
      read.map(r => r.data),
    );
    if (meta.testDate && dateSource !== 'you') { setTestDate(meta.testDate); setDateSource('printout'); }
    else if (!adding) { setTestDate(toDateInput(new Date().toISOString())); setDateSource('today'); }
    setPrintoutVolumeL(meta.poolVolumeL);

    setValues(merged.values);
    setConfidence(merged.confidence);
    setNotes(merged.notes);
    setScansLeft(typeof last.scans_remaining_this_hour === 'number' ? last.scans_remaining_this_hour : null);
    // The first photo that read anything is the one kept with the test.
    if (!adding || !photoBlob) { setPreview(read[0].dataUrl); setPhotoBlob(read[0].blob); }

    const messages = [];
    if (picked.length > MAX_PHOTOS) messages.push(`Only the first ${MAX_PHOTOS} photos were read.`);
    if (unreadable) messages.push(`${unreadable === 1 ? 'One photo' : `${unreadable} photos`} had no readings that could be read.`);
    if (merged.conflicts.length) messages.push(conflictMessage(merged.conflicts));
    for (const c of meta.conflicts) messages.push(c.message);
    if (stopped) messages.push(stopped);
    setNotice(messages.join(' '));
    setProgress(null);
    setState('review');
  };

  const todayInput = toDateInput(new Date().toISOString());

  const handleUse = () => {
    // Values the OCR couldn't read stay null ("not tested") — they're skipped
    // by the Health Score instead of being scored as a 0 reading.
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
    const result = {
      freeChlor:       num(values.freeChlor),
      pH:              num(values.pH),
      alkalinity:      num(values.alkalinity),
      cyanuricAcid:    num(values.cyanuricAcid),
      calciumHardness: num(values.calciumHardness),
      // The date on the printout, or today. The same midday rule as Add a past result.
      createdAt: isoFromDateInput(testDate > todayInput ? todayInput : testDate, new Date().toISOString()),
      source: 'ocr',
    };
    // Held for the pool-size prompt when Pool setup has no volume yet. Not saved.
    if (printoutVolumeL) result.printoutVolumeL = printoutVolumeL;
    if (values.salt !== '' && values.salt !== undefined) result.salt = num(values.salt);
    if (values.totalChlor !== '' && values.totalChlor !== undefined) result.totalChlor = num(values.totalChlor);
    // The photo is kept with the test as evidence, unless the owner unticked it.
    if (keepPhoto && photoBlob) result.printout = photoBlob;
    onComplete(result);
    onClose();
  };

  const confidenceTag = confidence === 'high'
    ? { cls: 'tag-good', text: 'High confidence' }
    : confidence === 'medium'
      ? { cls: 'tag-warn', text: 'Medium confidence — please check the values' }
      : { cls: 'tag-warn', text: 'Low confidence — please check every value' };

  return (
    // Once photos have been read, a stray tap outside must not throw the
    // readings away: Discard is the only way out of the review screen.
    <div className="modal-backdrop" onClick={state === 'pick' || state === 'error' ? onClose : undefined}>
      <div className="modal-panel modal-panel-tall scanner-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Scan test results</div>

        {/* Two hidden inputs. `capture` makes iPhone and Android open the camera
            straight away with no photo library, so the gallery needs its own
            input without it. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFiles}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFiles}
        />

        {state === 'pick' && (
          <>
            <div className="modal-body">
              Take a photo of your pool shop's printed water test. Your Pool Mate reads the values for you — you check them before anything is saved.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: 56, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                onClick={() => choose(fileRef, 'replace')}
              >
                <span style={{ display: 'flex' }}>{CameraIcon}</span>
                Take a photo
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ minHeight: 56, fontSize: 17 }}
                onClick={() => choose(galleryRef, 'replace')}
              >
                Choose from your photos
              </button>
              <span style={{ fontSize: 15, color: 'var(--gray-mid)', textAlign: 'center' }}>
                Printout runs over two pages? Pick up to {MAX_PHOTOS} photos at once.
              </span>
            </div>
          </>
        )}

        {(state === 'scanning') && (
          <div style={{
            minHeight: 200, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24,
          }}>
            {preview && (
              <img src={preview} alt="Your water test photo"
                   style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 'var(--r-md)', opacity: 0.85 }} />
            )}
            <div className="dot-loader"><span/><span/><span/></div>
            <span style={{ fontSize: 17, color: 'var(--gray-mid)' }}>
              {progress && progress.of > 1 ? `Reading photo ${progress.n} of ${progress.of}…` : 'Reading your test results…'}
            </span>
          </div>
        )}

        {(state === 'review' || state === 'adding') && (
          <>
            <div className="modal-body" style={{ marginBottom: 12 }}>
              Here's what your shop found. Check the values, fix anything that's off, then use them.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignItems: 'center' }}>
              <span className={`tag ${confidenceTag.cls}`}>{confidenceTag.text}</span>
              {scansLeft !== null && (
                <span style={{ fontSize: 17, color: 'var(--gray-light)' }}>{scansLeft} scans left this hour</span>
              )}
            </div>
            {notes && (
              <div style={{
                fontSize: 17, color: 'var(--gray-mid)', background: 'var(--gray-bg)',
                borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 16,
              }}>
                {notes}
              </div>
            )}
            {notice && (
              <p role="status" style={{ fontSize: 17, color: 'var(--amber)', marginBottom: 12 }}>{notice}</p>
            )}
            {duplicateTest(history, testDate, values) && (
              <p role="status" style={{ fontSize: 17, color: 'var(--amber)', marginBottom: 12 }}>
                You already have a test from {new Date(`${testDate}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} with these readings. Using them again adds a second copy.
              </p>
            )}
            {volumeNotice(printoutVolumeL, poolVolumeL) && (
              <p role="status" style={{ fontSize: 17, color: 'var(--amber)', marginBottom: 12 }}>{volumeNotice(printoutVolumeL, poolVolumeL)}</p>
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
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label" htmlFor="scan-date">Date of test</label>
              <input
                id="scan-date"
                className="input"
                type="date"
                max={todayInput}
                value={testDate}
                onChange={e => { setTestDate(e.target.value || todayInput); setDateSource('you'); }}
              />
              <p style={{ fontSize: 15, color: 'var(--gray-mid)', marginTop: 6 }}>
                {dateSource === 'printout' && 'Read from the printout. '}
                {dateSource === 'today' && 'No date found on the printout, so this is today. Change it if the test was done earlier. '}
                {daysOld(testDate) >= 2 && `These readings are ${daysOld(testDate)} days old, so your Health Score page will show them that way.`}
              </p>
            </div>
            <label className="keep-photo">
              <input type="checkbox" checked={keepPhoto} onChange={e => setKeepPhoto(e.target.checked)} />
              <span>Keep {photoBlob ? 'the first photo' : 'this photo'} with the test. It is proof of the result, and only you can see it.</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={state === 'adding'} onClick={() => choose(galleryRef, 'add')}>
                {state === 'adding' && progress ? `Reading photo ${progress.n} of ${progress.of}…` : 'Add more photos'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={state === 'adding'} onClick={() => choose(fileRef, 'add')}>
                Take another photo
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={state === 'adding'} onClick={() => { setNotice(''); setValues({}); setPhotoBlob(null); setPreview(null); setPrintoutVolumeL(null); setDateSource('today'); setTestDate(todayInput); setState('pick'); }}>
                Start again with a different photo
              </button>
            </div>
          </>
        )}

        {state === 'error' && (
          <div style={{
            minHeight: 140, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            marginBottom: 24, textAlign: 'center',
          }}>
            <span style={{ fontSize: 17, color: 'var(--gray-dark)', maxWidth: 360 }}>{errorMsg}</span>
            <span style={{ fontSize: 17, color: 'var(--gray-light)' }}>
              You can always type the readings in manually — it takes under a minute.
            </span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {(state === 'review' || state === 'adding') ? 'Discard' : 'Cancel'}
          </button>
          {(state === 'error') && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => choose(galleryRef, 'replace')}>
                Choose from your photos
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => choose(fileRef, 'replace')}>
                Take a photo
              </button>
            </>
          )}
          {(state === 'review' || state === 'adding') && (
            <button className="btn btn-primary btn-sm" disabled={state === 'adding'} onClick={handleUse}>
              Use these readings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
