// File: src/components/VoiceTestEntry.jsx
// Beta: speak water-test readings with the browser Web Speech API.
//
// Flow: tap to speak → live transcript → editable review → onComplete.
// Nothing is saved from speech alone. Raw audio is never stored; only the
// transcript (in this modal) and the numbers the user confirms leave here.
// The parent runs the same guardAndSave path as a typed test and a scan.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  VOICE_FIELDS,
  blankVoiceForm,
  formValuesFromTranscript,
  voiceReadingsFromForm,
} from '../lib/parseVoiceReadings.js';

const LANGS = ['en-AU', 'en-GB', 'en-US'];

const MicIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

function speechSupport() {
  if (typeof window === 'undefined') return { ok: false, reason: 'missing' };
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!Ctor) return { ok: false, reason: 'missing' };
  if (window.isSecureContext === false) return { ok: false, reason: 'insecure' };
  return { ok: true, Ctor };
}

function transcriptFromEvent(event) {
  let text = '';
  for (let i = 0; i < event.results.length; i++) {
    text += event.results[i][0].transcript;
  }
  return text.trim();
}

function messageForSpeechError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is off. Allow the mic for this site, or enter the test instead.';
    case 'audio-capture':
      return 'No microphone found. Enter the test or scan a photo instead.';
    case 'network':
      return "Couldn't hear that just now. Check your connection and try again, or enter the test.";
    case 'language-not-supported':
      return "This browser can't use English speech recognition. Enter the test or scan a photo instead.";
    default:
      return "Couldn't start listening. Try again, or enter the test.";
  }
}

function hasAnyReading(values) {
  return VOICE_FIELDS.some((field) => {
    const raw = String(values[field.app] ?? '').trim();
    return raw !== '' && Number.isFinite(parseFloat(raw));
  });
}

export default function VoiceTestEntry({ onClose, onComplete }) {
  const support = useMemo(() => speechSupport(), []);
  const [state, setState] = useState(support.ok ? 'listen' : 'unsupported');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [values, setValues] = useState(blankVoiceForm);
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const langRef = useRef(LANGS[0]);
  const restartRef = useRef(false);
  const baseRef = useRef('');
  const transcriptRef = useRef('');
  const sessionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      restartRef.current = false;
      const rec = recRef.current;
      recRef.current = null;
      if (!rec) return;
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try { rec.abort(); } catch { /* already stopped */ }
    };
  }, []);

  const stopListening = () => {
    sessionRef.current += 1;
    restartRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) {
      setListening(false);
      return;
    }
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = () => setListening(false);
    try { rec.stop(); } catch { setListening(false); }
  };

  const startListening = () => {
    if (!support.ok || !mountedRef.current) return;
    sessionRef.current += 1;
    const session = sessionRef.current;
    const prev = recRef.current;
    recRef.current = null;
    if (prev) {
      prev.onend = null;
      prev.onresult = null;
      prev.onerror = null;
      try { prev.stop(); } catch { /* starting a fresh session */ }
    }

    baseRef.current = transcriptRef.current.trim();
    const rec = new support.Ctor();
    rec.lang = langRef.current;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      if (sessionRef.current !== session) return;
      const heard = transcriptFromEvent(event);
      const base = baseRef.current;
      setTranscript(base ? `${base} ${heard}` : heard);
      setError('');
    };

    rec.onerror = (event) => {
      if (sessionRef.current !== session) return;
      const code = event.error || '';
      if (code === 'language-not-supported') {
        const next = LANGS[LANGS.indexOf(langRef.current) + 1];
        if (next) {
          langRef.current = next;
          restartRef.current = true;
          return;
        }
      }
      if (code === 'aborted') return;
      if (code === 'no-speech') {
        setError("Didn't catch that. Tap to speak and try again.");
        return;
      }
      setError(messageForSpeechError(code));
    };

    rec.onend = () => {
      if (sessionRef.current !== session) return;
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
      if (restartRef.current && mountedRef.current) {
        restartRef.current = false;
        startListening();
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setError('');
    } catch {
      recRef.current = null;
      setListening(false);
      setError("Couldn't start the microphone. Try again, or enter the test.");
    }
  };

  const goReview = () => {
    stopListening();
    const text = transcriptRef.current;
    if (!text.trim()) return;
    setValues(formValuesFromTranscript(text));
    setState('review');
  };

  const handleUse = () => {
    stopListening();
    onComplete({
      ...voiceReadingsFromForm(values),
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  const canCheck = transcript.trim().length > 0;
  const canSave = hasAnyReading(values);
  const speakIsPrimary = listening || !canCheck;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-title">Speak results</div>

        {state === 'unsupported' && (
          <div className="modal-body">
            {support.reason === 'insecure'
              ? 'Spoken readings need a secure connection. Enter the test or scan a photo instead.'
              : "This browser can't take spoken readings. Enter the test or scan a photo instead."}
          </div>
        )}

        {state === 'listen' && (
          <>
            <div className="modal-body" style={{ marginBottom: 12 }}>
              Say the readings, for example "chlorine is 2.2, alkalinity is 125, pH is 7.4".
              Spoken readings are a beta. Nothing is saved until you check the numbers.
            </div>
            <div style={{
              border: 'var(--border)', borderRadius: 'var(--r-md)',
              padding: 16, marginBottom: 16,
              background: listening ? 'var(--cc-mist)' : 'var(--gray-bg)',
            }}>
              <button
                type="button"
                className={speakIsPrimary ? 'btn btn-primary' : 'btn btn-ghost'}
                onClick={listening ? stopListening : startListening}
                aria-pressed={listening}
                style={{ width: '100%' }}
              >
                <span style={{ display: 'inline-flex' }}>{MicIcon}</span>
                {listening ? 'Stop' : 'Tap to speak'}
              </button>
              <div aria-live="polite" style={{ minHeight: 28, marginTop: 12 }}>
                {listening && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--gray-mid)' }}>
                    <span className="dot-loader"><span/><span/><span/></span>
                    Listening…
                  </span>
                )}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="voice-transcript">What we heard</label>
              <textarea
                id="voice-transcript"
                className="input"
                rows={3}
                value={transcript}
                placeholder="Your words show up here. You can edit them before checking."
                onFocus={stopListening}
                onChange={e => setTranscript(e.target.value)}
                style={{ minHeight: 88, resize: 'vertical' }}
              />
            </div>
            {error && (
              <div role="alert" style={{ fontSize: 14, color: 'var(--gray-dark)', marginBottom: 16 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={goReview}
                disabled={!canCheck}
              >
                Check readings
              </button>
            </div>
          </>
        )}

        {state === 'review' && (
          <>
            <div className="modal-body" style={{ marginBottom: 12 }}>
              {canSave
                ? "Check these readings. Fix anything that's off, then use them."
                : "We couldn't pick numbers out of that. Type them below, or speak again."}
            </div>
            {transcript.trim() && (
              <div style={{
                fontSize: 13, color: 'var(--gray-mid)', background: 'var(--gray-bg)',
                borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 16,
              }}>
                Heard: {transcript.trim()}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {VOICE_FIELDS.map(f => (
                <div key={f.app} className="input-group">
                  <label className="input-label" htmlFor={`voice-${f.app}`}>
                    {f.label}{f.unit ? ` (${f.unit})` : ''}
                  </label>
                  <input
                    id={`voice-${f.app}`}
                    className="input"
                    type="number"
                    inputMode="decimal"
                    placeholder="Not heard"
                    value={values[f.app] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.app]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {state === 'review' ? 'Discard' : 'Cancel'}
          </button>
          {state === 'review' && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setState('listen')}>
                Speak again
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleUse}
                disabled={!canSave}
              >
                Use these readings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
