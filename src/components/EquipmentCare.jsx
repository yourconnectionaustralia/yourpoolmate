// Care jobs for the equipment the owner has added, with a "Done" button.
// Done saves a history entry (see lib/equipmentCare.js), so nothing is lost
// if the page is closed, and the job shows in the water record.

import { useState } from 'react';
import { formatDay } from '../lib/recordExport.js';

export default function EquipmentCare({ items, onDone }) {
  const [busyKey, setBusyKey] = useState('');
  const [problem, setProblem] = useState('');
  if (!items?.length) return null;

  const done = async (task) => {
    setBusyKey(task.key); setProblem('');
    try {
      await onDone(task);
    } catch (err) {
      console.error('Care job did not save:', err);
      setProblem("That didn't save. Check your connection and try again.");
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="card-section care-card" style={{ marginBottom: 16 }}>
      <h2 className="care-title">Looking after your gear</h2>
      <p className="care-intro">
        Tap Done when you have done a job, and it goes in your history. Times are typical for a pool in use,
        so check your equipment manual for the exact steps.
      </p>
      <ul className="care-list">
        {items.map(({ task, state, last, text }) => (
          <li key={task.key} className={`care-item care-${state}`}>
            <div className="care-main">
              <div className="care-label">{task.label}</div>
              <div className="care-status">
                <span className={`care-badge care-badge-${state}`}>{text}</span>
                {last && <span className="care-last"> Last done {formatDay(last.toISOString())}</span>}
              </div>
              <details className="care-more">
                <summary>How and how often</summary>
                <p>Usually {task.every}. {task.tip}</p>
              </details>
            </div>
            <button
              className={`btn btn-sm ${state === 'due' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => done(task)}
              disabled={busyKey !== ''}
              aria-label={`${task.label}: done today`}
            >
              {busyKey === task.key ? 'Saving…' : 'Done'}
            </button>
          </li>
        ))}
      </ul>
      <div aria-live="polite">
        {problem && <p className="reminder-problem" role="alert">{problem}</p>}
      </div>
    </div>
  );
}
