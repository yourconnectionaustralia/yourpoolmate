// Reminders: the weekly test reminder day, and the monthly pool report.
// Two pieces: <ReminderSettings> (Profile) and <ReminderOffer> (Health, once,
// after a first test). Saving is passed in as onSave(patch), which rejects on failure.

import { useEffect, useState } from 'react';
import {
  DAYS, dayLabel, readOfferDismissed, shouldOfferReminder, suggestedDay, writeOfferDismissed,
} from '../lib/reminderPrefs.js';

function DayPicker({ id, value, onChange, disabled }) {
  return (
    <select
      id={id}
      className="input"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      disabled={disabled}
    >
      <option value="">No reminder</option>
      {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
    </select>
  );
}

export function ReminderSettings({ prefs, onSave }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  // Shown straight away, then put back if the save fails.
  const [shown, setShown] = useState(null);
  if (!prefs?.available) return null;
  const day = shown ? shown.reminderDay : prefs.reminderDay;
  const report = shown ? shown.monthlyReport : prefs.monthlyReport;

  const save = async (next, patch, okText) => {
    setShown(next); setBusy(true); setProblem(''); setMessage('');
    try {
      await onSave(patch);
      setMessage(okText);
    } catch (err) {
      console.error('Failed to save reminders:', err);
      setProblem("That didn't save. Check your connection and try again.");
    } finally {
      setShown(null);
      setBusy(false);
    }
  };

  return (
    <div className="card-section reminder-settings" style={{ marginTop: 16 }}>
      <h2 className="reminder-title">Reminders</h2>
      <div className="input-group">
        <label className="input-label" htmlFor="reminder-day">Weekly test reminder</label>
        <DayPicker
          id="reminder-day"
          value={day}
          disabled={busy}
          onChange={(d) => save(
            { reminderDay: d, monthlyReport: report },
            { reminderDay: d },
            d === null ? 'Weekly reminder is off.' : `Done. We will email you on ${dayLabel(d)} mornings.`,
          )}
        />
        <p className="reminder-help">
          A short email at 8am on the day you pick, with a button that opens Test water.
          If you have tested in the last few days, we skip it.
        </p>
      </div>
      <label className="reminder-check">
        <input
          type="checkbox"
          checked={report}
          disabled={busy}
          onChange={(e) => save(
            { reminderDay: day, monthlyReport: e.target.checked },
            { monthlyReport: e.target.checked },
            e.target.checked ? 'Monthly report is on.' : 'Monthly report is off.',
          )}
        />
        <span>Email me a pool report at the start of each month, when I have tested in the month before.</span>
      </label>
      <div aria-live="polite">
        {message && <p className="reminder-ok">{message}</p>}
        {problem && <p className="reminder-problem" role="alert">{problem}</p>}
      </div>
    </div>
  );
}

// Shown on Health once there is a first test and no reminder day. One tap to
// pick a day; "No thanks" is remembered on this device. Once shown it stays
// until the page is left, so the "Done" confirmation is not pulled away the
// moment the day is saved.
export function ReminderOffer({ prefs, testCount, lastTestAt, onSave }) {
  const [day, setDay] = useState(() => suggestedDay(lastTestAt));
  const [offered, setOffered] = useState(false);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState(null);
  useEffect(() => {
    if (shouldOfferReminder({ prefs, testCount, dismissed: readOfferDismissed(localStorage) })) setOffered(true);
  }, [prefs, testCount]);
  if (!offered || gone) return null;

  if (done !== null) {
    return (
      <div className="callout callout-info reminder-offer" role="status">
        <div className="callout-body">Done. We will email you on {dayLabel(done)} mornings. Change it any time in Profile.</div>
      </div>
    );
  }

  const set = async () => {
    setBusy(true); setProblem('');
    try {
      await onSave({ reminderDay: day });
      setDone(day);
    } catch (err) {
      console.error('Failed to save reminder day:', err);
      setProblem("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  const decline = () => {
    try { writeOfferDismissed(localStorage); } catch { /* private mode */ }
    setGone(true);
  };

  return (
    <div className="callout callout-info reminder-offer">
      <div className="callout-body">
        <strong>Want a nudge each week?</strong> We will send one short email on the day you pick, with a button to test your water.
        <div className="reminder-offer-row">
          <label className="visually-hidden" htmlFor="offer-day">Reminder day</label>
          <select id="offer-day" className="input" value={day} onChange={(e) => setDay(Number(e.target.value))} disabled={busy}>
            {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={set} disabled={busy}>Remind me</button>
          <button className="btn btn-ghost btn-sm" onClick={decline} disabled={busy}>No thanks</button>
        </div>
        {problem && <p className="reminder-problem" role="alert">{problem}</p>}
      </div>
    </div>
  );
}
