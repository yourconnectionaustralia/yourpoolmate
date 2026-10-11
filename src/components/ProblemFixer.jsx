// Problem fixer: pick what is wrong, get plain steps. No chemical amounts here:
// the dose plan in Test water and the product label give those.

import { useState } from 'react';
import {
  FIXER_NOT_SURE, GUIDES, SAFETY_BEFORE, SAFETY_EMERGENCY, SAFETY_SEE_BOTTOM, guideByKey,
} from '../lib/problemFixer.js';

function Safety({ guide }) {
  return (
    <div className="fixer-safety" role="note">
      <h3 className="fixer-h3">Before you start</h3>
      <ul>
        {SAFETY_BEFORE.map((l) => <li key={l}>{l}</li>)}
        {guide?.mustSeeBottom && <li><strong>{SAFETY_SEE_BOTTOM}</strong></li>}
      </ul>
      <p className="fixer-emergency">{SAFETY_EMERGENCY}</p>
    </div>
  );
}

function Guide({ guide, onBack, onTestWater, onNote }) {
  const [state, setState] = useState('idle'); // idle | saving | saved | failed
  const note = async () => {
    setState('saving');
    try {
      await onNote({ type: guide.event.type, title: guide.event.title, notes: '', date: new Date().toISOString() });
      setState('saved');
    } catch (err) {
      console.error('Fixer note did not save:', err);
      setState('failed');
    }
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm fixer-back" onClick={onBack}>Back to all problems</button>
      <h1 className="page-title">{guide.title}</h1>
      <p className="fixer-why">{guide.why}</p>

      <Safety guide={guide} />

      <div className="card-section fixer-steps-card">
        <h2 className="fixer-h2">What to do</h2>
        <ol className="fixer-steps">
          {guide.steps.map((s) => (
            <li key={s.title}>
              <div className="fixer-step-title">{s.title}</div>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <button className="btn btn-primary" onClick={onTestWater}>Test my water</button>
      </div>

      <div className="card-section fixer-shop">
        <h2 className="fixer-h2">When to ask a professional</h2>
        <p>{guide.shop}</p>
        <p>{FIXER_NOT_SURE}</p>
      </div>

      <div className="card-section fixer-note">
        <p>Keep a record of what you did. It goes in your history and your water record.</p>
        <button className="btn btn-ghost btn-sm" onClick={note} disabled={state === 'saving' || state === 'saved'}>
          {state === 'saved' ? 'Added to my history' : state === 'saving' ? 'Saving…' : 'Add to my history'}
        </button>
        <div aria-live="polite">
          {state === 'failed' && <p className="reminder-problem" role="alert">That didn't save. Check your connection and try again.</p>}
        </div>
      </div>
    </div>
  );
}

export default function ProblemFixer({ onTestWater, onNote, initialKey = null }) {
  const [key, setKey] = useState(initialKey);
  const guide = guideByKey(key);

  if (guide) {
    return <Guide guide={guide} onBack={() => setKey(null)} onTestWater={onTestWater} onNote={onNote} />;
  }

  return (
    <div>
      <h1 className="page-title">Problem fixer</h1>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>Pick what you can see, and get the steps.</p>
      <ul className="fixer-list">
        {GUIDES.map((g) => (
          <li key={g.key}>
            <button className="fixer-card" onClick={() => setKey(g.key)}>
              <span className="fixer-card-title">{g.title}</span>
              <span className="fixer-card-sub">{g.summary}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="fixer-foot">{SAFETY_EMERGENCY}</p>
    </div>
  );
}
