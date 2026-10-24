// File: src/components/HomeCards.jsx
//
// Cards for the Health Score home screen: the swim call with the next dose
// one tap away, the last 30 days, this month's conditions, stock running
// low, and the owner's pinned shortcuts.

import { useState } from 'react';
import { doseLabel, isBuyable } from '../lib/plan.js';
import { periodWindow, scoreSummary, spendTotal, spendBuckets, formatAud } from '../lib/shed.js';

const SWIM_PILL = { good: 'Swim-ready', wait: 'Hold off', stale: 'Test first', unknown: 'Test first' };

export function SwimCall({ plan, next, doneCount, done = {}, skipped = {}, shopCount, onAdded, onOpenPlan, onOpenShop, onLogTest }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const option = next?.options[0];
  const tone = plan.swim.tone;

  const add = async () => {
    setBusy(true);
    setProblem('');
    try {
      await onAdded(next, option);
    } catch {
      setProblem("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="swim-call">
      <span className={`swim-pill swim-pill-${tone}`}>{SWIM_PILL[tone] ?? 'Test first'}</span>
      <h2 className="swim-title">{plan.swim.title}</h2>
      <p className="swim-detail">{plan.swim.detail}</p>

      {next && option ? (
        <div className="swim-next">
          {plan.steps.length > 1 && (
            <div className="swim-progress">
              <p className="swim-progress-text">
                {doneCount} of {plan.steps.length} added
              </p>
              <div className="plan-progress-bar" aria-hidden="true">
                {plan.steps.map((s) => (
                  <span key={s.key} className={done[s.key] ? 'is-done' : s.key === next.key ? 'is-next' : skipped[s.key] ? 'is-skipped' : ''} />
                ))}
              </div>
            </div>
          )}
          <p className="swim-next-label">Next · {next.action}</p>
          <button className="btn btn-primary btn-block swim-dose" disabled={busy} onClick={add}>
            {isBuyable(option) ? `I added ${doseLabel(option)}` : `Done: ${doseLabel(option)}`}
          </button>
          <button className="btn btn-ghost btn-block" onClick={onOpenPlan}>
            {next.options.length > 1 ? 'Other options and safety' : 'Safety and the full plan'}
          </button>
          {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
        </div>
      ) : shopCount > 0 ? (
        <div className="swim-next">
          <p className="swim-next-label">{shopCount} item{shopCount === 1 ? '' : 's'} on the shopping list</p>
          <p className="swim-detail">The rest of the plan waits on a shop run.</p>
          <button className="btn btn-primary btn-block" onClick={onOpenShop}>Open the shopping list</button>
        </div>
      ) : plan.steps.length > 0 ? (
        <div className="swim-next">
          <p className="swim-next-label">All {plan.steps.length} steps added</p>
          <p className="swim-detail">Let the pump run, then test again in about 24 hours.</p>
          <button className="btn btn-primary btn-block" onClick={onLogTest}>Log the re-test</button>
        </div>
      ) : null}
    </div>
  );
}

function Change({ delta, goodWhen, label }) {
  if (delta == null) return null;
  if (Math.abs(delta) < 0.5) return <p className="teaser-change">Same as the {label}</p>;
  const up = delta > 0;
  const good = (up ? 'up' : 'down') === goodWhen;
  return (
    <p className={`teaser-change ${good ? 'is-good' : 'is-warn'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {up ? 'Up' : 'Down'} {Math.abs(Math.round(delta))} on the {label}
    </p>
  );
}

export function ThirtyDays({ tests, events, onOpen }) {
  if (!tests.length) return null;
  const now = new Date();
  const { current, previous } = periodWindow('30d', 0, now);
  const score = scoreSummary(tests, current, previous);
  const spend = spendTotal(events, current);
  const before = spendTotal(events, previous);
  const buckets = spendBuckets(events, '30d', current);
  const max = Math.max(1, ...buckets.map((b) => b.doses));
  return (
    <section className="card-section teaser" aria-labelledby="teaser-title">
      <div className="teaser-head">
        <h2 id="teaser-title" className="plan-h2">Last 30 days</h2>
        <button className="link-btn" onClick={() => onOpen('history')}>Chemistry log</button>
      </div>
      <div className="teaser-grid">
        <div>
          <p className="teaser-label">Average score</p>
          <p className="teaser-number">{score.average ?? '—'}</p>
          {score.change != null
            ? <Change delta={score.change} goodWhen="up" label="30 days before" />
            : <p className="teaser-change">{score.tests} test{score.tests === 1 ? '' : 's'}</p>}
        </div>
        <div>
          <p className="teaser-label">Doses added</p>
          <p className="teaser-number">{spend.doses}</p>
          {spend.doses > 0
            ? <Change delta={spend.doses - before.doses} goodWhen="down" label="30 days before" />
            : <p className="teaser-change">Mark doses on the plan to see them here.</p>}
        </div>
      </div>
      {spend.aud > 0 && (
        <p className="teaser-spend">
          {formatAud(spend.aud)} spent, from prices you entered.{' '}
          <button className="link-btn" onClick={() => onOpen('costs')}>Costs</button>
        </p>
      )}
      <div className="teaser-bars" aria-hidden="true">
        {buckets.map((b, i) => (
          <span key={b.label} className={i === buckets.length - 1 ? 'is-now' : ''} style={{ height: `${b.doses > 0 ? Math.max(10, (b.doses / max) * 100) : 5}%` }} />
        ))}
      </div>
      <p className="plan-small">Doses you marked as added, week by week.</p>
    </section>
  );
}

export function ThisMonth({ climate, pumpHours, volumeL, turnover }) {
  return (
    <section className="card-section this-month" aria-label="This month">
      <h2 className="plan-h2">{climate.summary}</h2>
      <p>{climate.advice}</p>
      <p>
        {climate.season} pump run: <strong>{pumpHours ? `${pumpHours} hours (yours)` : climate.pumpHours}</strong>
        {volumeL > 0 && turnover > 0 ? `. One turnover of your pool takes about ${turnover} hours at a typical 200 L a minute.` : '.'}
      </p>
      <p className="plan-small">{climate.sourceNote}</p>
    </section>
  );
}

export function LowStock({ items, onOpen }) {
  if (!items.length) return null;
  return (
    <div className="callout callout-action" role="status">
      <div className="callout-body">
        <strong>Running low:</strong>{' '}
        {items.map((i) => `${i.name} (${i.label}, about ${i.weeksLeft < 1 ? 'under a week' : `${i.weeksLeft} weeks`} left)`).join('; ')}.
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={() => onOpen('shop')}>Add to the shopping list</button>
        </div>
      </div>
    </div>
  );
}

// ── Pinned shortcuts ─────────────────────────────────────────

export const SHORTCUTS = [
  { view: 'plan', title: 'Plan', hint: "What to add, in order" },
  { view: 'shed', title: 'My Shed', hint: 'What you have on hand' },
  { view: 'shop', title: 'Shopping list', hint: 'What to pick up' },
  { view: 'costs', title: 'Costs', hint: 'What you paid' },
  { view: 'history', title: 'Chemistry log', hint: 'Tests, doses, the record' },
  { view: 'setup', title: 'Pool setup', hint: 'Litres, surface, pump hours' },
  { view: 'equipment', title: 'Equipment', hint: 'Pump, filter, chlorinator' },
  { view: 'schedule', title: 'Seasonal tips', hint: 'What changes this season' },
  { view: 'fixer', title: 'Problem fixer', hint: 'Green, cloudy, eyes, foam' },
  { view: 'profile', title: 'Profile', hint: 'Membership, reminders, data' },
];

export const DEFAULT_PINS = ['shed', 'shop', 'fixer'];
export const PIN_CAP = 6;

export function cleanPins(pins) {
  const known = new Set(SHORTCUTS.map((s) => s.view));
  const out = [];
  for (const p of Array.isArray(pins) ? pins : DEFAULT_PINS) {
    if (known.has(p) && !out.includes(p)) out.push(p);
    if (out.length >= PIN_CAP) break;
  }
  return out;
}

export function togglePin(pins, view) {
  if (pins.includes(view)) return { pins: pins.filter((p) => p !== view), notice: null };
  if (pins.length >= PIN_CAP) return { pins, notice: `You have ${PIN_CAP} shortcuts pinned. Unpin one to add another.` };
  return { pins: [...pins, view], notice: null };
}

export function Shortcuts({ pins, onOpen, badges = {} }) {
  const list = pins.map((p) => SHORTCUTS.find((s) => s.view === p)).filter(Boolean);
  if (!list.length) return null;
  return (
    <nav className="shortcuts" aria-label="Your shortcuts">
      {list.map((s) => (
        <button key={s.view} className="shortcut" onClick={() => onOpen(s.view)}>
          <span className="shortcut-title">{s.title}{badges[s.view] ? <span className="shortcut-badge">{badges[s.view]}</span> : null}</span>
          <span className="shortcut-hint">{s.hint}</span>
        </button>
      ))}
    </nav>
  );
}
