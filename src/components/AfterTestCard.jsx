// File: src/components/AfterTestCard.jsx
//
// "Jobs since your last test": tick what you did, add a few words, and set a
// reminder to buy pool salt. See lib/jobsDone.js.

import { useState } from 'react';
import { JOB_TEXT_MAX } from '../lib/jobsDone.js';

const whenText = (iso) => new Intl.DateTimeFormat('en-AU', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
}).format(new Date(iso));

const NOT_SAVED = "That didn't save. Check your connection and try again.";

export function AfterTestCard({ jobs, notes = [], salt = null, onSaveNote, onRemindSalt, onOpenLog }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [text, setText] = useState('');
  const [remind, setRemind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState('');

  const canRemind = Boolean(salt && salt.state !== 'listed');
  const wantNote = picked.length > 0 || text.trim() !== '';
  const wantSalt = canRemind && remind;

  const toggle = (key) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const close = () => {
    setOpen(false);
    setPicked([]);
    setText('');
    setRemind(false);
    setProblem('');
  };

  // The note and the reminder save separately. If only the reminder fails, the
  // saved note is cleared from the form, so trying again cannot save it twice.
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setProblem('');
    let noteSaved = false;
    try {
      if (wantNote) {
        await onSaveNote({ jobKeys: picked, text });
        noteSaved = true;
        setPicked([]);
        setText('');
      }
      if (wantSalt) await onRemindSalt();
      setSaved([wantNote && 'Saved to your pool record ✓', wantSalt && 'Pool salt is on your shopping list ✓'].filter(Boolean).join(' · '));
      close();
    } catch {
      setProblem(noteSaved ? "Your note is saved, but the salt reminder didn't. Tap Save to try the reminder again." : NOT_SAVED);
    } finally {
      setBusy(false);
    }
  };

  const remindNow = async () => {
    setBusy(true);
    setProblem('');
    setSaved('');
    try {
      await onRemindSalt();
      setSaved('Pool salt is on your shopping list ✓');
    } catch {
      setProblem(NOT_SAVED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-section after-test" aria-labelledby="after-test-title">
      <h2 id="after-test-title" className="plan-h2">Jobs since your last test</h2>

      {notes.length > 0 ? (
        <ul className="after-test-notes">
          {notes.map((n) => (
            <li key={n.id}>
              <strong>{n.title}</strong>
              {n.notes && <span>{n.notes}</span>}
              <span className="plan-small">{whenText(n.date)}</span>
            </li>
          ))}
        </ul>
      ) : !open && (
        <p className="after-test-intro">Scrubbed, backwashed or turned the chlorinator up? Note it down so it is on your pool's record.</p>
      )}

      {saved && !open && <p role="status" className="after-test-saved">{saved}</p>}

      {!open ? (
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={() => { setOpen(true); setSaved(''); setProblem(''); }}>
            {notes.length ? 'Add another note' : 'Add what I did'}
          </button>
          {salt?.state === 'low' && (
            <div className="after-test-salt">
              <p>{salt.text}</p>
              <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={remindNow}>Remind me to buy pool salt</button>
            </div>
          )}
          {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
          {notes.length > 0 && <button type="button" className="link-btn" onClick={onOpenLog}>See or remove notes in the Chemistry log</button>}
        </>
      ) : (
        <form onSubmit={save}>
          <fieldset className="look-question">
            <legend className="look-legend">What did you do?</legend>
            <p className="plan-small look-why">Tick all that apply.</p>
            <div className="look-choices">
              {jobs.map((j) => (
                <label key={j.key} className={`look-choice${picked.includes(j.key) ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={picked.includes(j.key)} onChange={() => toggle(j.key)} />
                  <span className="look-choice-label">{j.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="input-group">
            <label className="input-label" htmlFor="after-test-text">Anything else? (optional)</label>
            <textarea
              id="after-test-text"
              className="input after-test-text"
              rows={3}
              maxLength={JOB_TEXT_MAX}
              placeholder="e.g. Water was a little green after heavy rain"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          {salt && (canRemind ? (
            <label className={`look-choice after-test-remind${remind ? ' is-on' : ''}`}>
              <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
              <span>
                <span className="look-choice-label">Remind me to buy pool salt</span>
                <span className="look-choice-hint">{salt.text}</span>
              </span>
            </label>
          ) : (
            <p className="after-test-saved">✓ {salt.text}</p>
          ))}
          {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || (!wantNote && !wantSalt)}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}
    </section>
  );
}

export default AfterTestCard;
