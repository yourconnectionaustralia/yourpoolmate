// File: src/components/CostsPage.jsx
//
// What the owner spent on chemicals, from prices they typed in My Shed.
// Doses with no price are counted, never priced. Turning the chlorinator up
// costs nothing and says so.

import { useState } from 'react';
import { PERIODS, formatAud, periodWindow, spendBreakdown, spendBuckets, spendTotal } from '../lib/shed.js';

export default function CostsPage({ events, hasTests, hasPrices, onOpen, onLogTest }) {
  const [period, setPeriod] = useState('30d');
  const [offset, setOffset] = useState(0);
  const { current, previous, label } = periodWindow(period, offset);
  const total = spendTotal(events, current);
  const before = spendTotal(events, previous);
  const rows = spendBreakdown(events, current);
  const buckets = spendBuckets(events, period, current);
  const max = Math.max(1, ...buckets.map((b) => b.aud));
  const topRow = Math.max(1, ...rows.map((r) => r.aud));

  if (!hasTests) {
    return (
      <div>
        <h1 className="page-title">Costs</h1>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">Costs start with a test</div>
            <div className="empty-state-body">Log a test, then mark the doses you add. Dollars appear here only when you type a price in My Shed.</div>
            <button className="btn btn-primary" onClick={onLogTest}>Log a test</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Costs</h1>
      <p className="page-subtitle">Dollars only from prices you typed. Nothing is estimated from shop prices.</p>

      <div className="period-bar" role="group" aria-label="Period">
        {Object.entries(PERIODS).map(([k, v]) => (
          <button key={k} className={`chip${period === k ? ' is-on' : ''}`} aria-pressed={period === k} onClick={() => { setPeriod(k); setOffset(0); }}>{v.label}</button>
        ))}
      </div>
      <div className="period-nav">
        <button className="btn btn-ghost btn-sm" onClick={() => setOffset(offset + 1)} aria-label={`Previous ${PERIODS[period].label}`}>‹ Earlier</button>
        <span className="period-label">{label}</span>
        <button className="btn btn-ghost btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 1))} aria-label={`Next ${PERIODS[period].label}`}>Later ›</button>
      </div>

      <section className="card-section" aria-labelledby="spent-title">
        <h2 id="spent-title" className="plan-h2">What you spent</h2>
        <p className="teaser-number">{formatAud(total.aud)}</p>
        <p className="plan-small">
          {total.doses} dose{total.doses === 1 ? '' : 's'} marked
          {before.aud > 0 || total.aud > 0 ? ` · ${formatAud(before.aud)} the period before` : ''}
        </p>
        {total.free > 0 && <p className="plan-small">{total.free} free step{total.free === 1 ? '' : 's'}, like turning the chlorinator up, cost nothing.</p>}
        {total.unpriced > 0 && (
          <p className="plan-small">
            {total.unpriced} dose{total.unpriced === 1 ? ' has' : 's have'} no price, so {total.unpriced === 1 ? 'it is' : 'they are'} not in the total.{' '}
            <button className="link-btn" onClick={() => onOpen('shed')}>Add a price in My Shed</button>
          </p>
        )}
        <div className="cost-bars" role="img" aria-label={`Spend by ${PERIODS[period].bucket} for ${label.toLowerCase()}: ${formatAud(total.aud)} across ${total.doses} doses.`}>
          {buckets.map((b) => (
            <div key={b.label} className="cost-bar">
              <span className="cost-bar-fill" style={{ height: `${b.aud > 0 ? Math.max(6, (b.aud / max) * 100) : 3}%` }} />
              <span className="cost-bar-label">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {rows.length > 0 ? (
        <section className="card-section" aria-labelledby="where-title">
          <h2 id="where-title" className="plan-h2">Where it went</h2>
          <ul className="cost-rows">
            {rows.map((r) => (
              <li key={r.name}>
                <div className="cost-row-head">
                  <span>{r.name}</span>
                  <strong>{r.aud > 0 ? formatAud(r.aud) : '—'}</strong>
                </div>
                <div className="gauge"><span style={{ width: `${r.aud > 0 ? Math.max(4, (r.aud / topRow) * 100) : 2}%` }} /></div>
                <p className="plan-small">{r.doses} dose{r.doses === 1 ? '' : 's'}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No doses in this period</div>
            <div className="empty-state-body">Mark doses as added on the plan and they show up here.{hasPrices ? '' : ' Add a price in My Shed if you want them in dollars.'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
