import { useState, useEffect } from 'react';
import InstallGuide from '../../components/InstallGuide.jsx';
import { emptyTestHeadline } from '../../lib/emptyTestHeadline.js';
import { goodWaterLine, waterLooksGood } from '../../lib/goodWaterLine.js';
import { scoreChange } from '../../lib/scoreChange.js';
import { testPrompt } from '../../lib/testPrompt.js';
import { retestPrompt } from '../../lib/doseLog.js';
import { turnoverHours } from '../../lib/plan.js';
import { LowStock, Shortcuts, SwimCall, ThirtyDays, ThisMonth } from '../../components/HomeCards.jsx';
import { fmtReading, formatRelative, melbourneGreeting } from '../helpers.js';
import { Icon } from '../icons.jsx';
import { HealthScoreRing } from '../visuals.jsx';

// ─────────────────────────────────────────────────────────────────
// HEALTH SCORE PAGE
// ─────────────────────────────────────────────────────────────────
// Melbourne civil time, refreshed each minute so a page left open crosses
// midday and 6pm without a reload.
function useHomeGreeting(user) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return melbourneGreeting(user, now);
}

export function HealthScorePage({
  testData, poolProfile, events = [], onLogFirst, onLogTest, user, reminderOffer = null, careDue = [], onOpenCare, onOpenFixer,
  plan, next, doneCount = 0, done = {}, skipped = {}, passed = {}, shopCount = 0, onAdded, onOpen, ctx, tests = [], low = [], pins = [], badges = {},
}) {
  const greeting = useHomeGreeting(user);
  const lastTest = testData?.createdAt;
  const poolLabel = poolProfile
    ? `${poolProfile.name} · ${(poolProfile.volumeL ?? (poolProfile.volumeKl || 0) * 1000).toLocaleString('en-AU')} L`
    : null;
  const thisMonth = ctx && (
    <ThisMonth climate={ctx.climate} pumpHours={ctx.pumpHours} volumeL={ctx.volumeL} turnover={turnoverHours(ctx.volumeL)} />
  );

  // No test at all, or a saved test with no readings in it (a stored 0 that is
  // not bad water). Either way there is nothing to score, so no warning:
  // just offer the test.
  if (!testData || !plan || emptyTestHeadline(testData, poolProfile?.sanitiser)) {
    return (
      <div>
        <p className="page-title">{greeting}</p>
        <h1 className="page-title">Health Score</h1>
        <p className="page-subtitle">No test logged yet</p>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.flask}</div>
            <div className="empty-state-title">Let's check the water</div>
            <div className="empty-state-body">
              Clear water can still be short of chlorine. A two-minute test gives you the score, the swim call and a plan in grams and millilitres for your pool.
            </div>
            <button className="btn btn-primary" onClick={onLogTest || onLogFirst}>Log your first test</button>
          </div>
        </div>
        <Shortcuts pins={pins} onOpen={onOpen} badges={badges} />
        {/* Green or cloudy before the first test? The fixer works without one. */}
        <button className="fixer-link" style={{ marginTop: 16 }} onClick={onOpenFixer}>
          <span className="fixer-link-title">Water looking off?</span>
          <span className="fixer-link-sub">Green, cloudy, stinging eyes, foam or stains: open the problem fixer.</span>
        </button>
        {thisMonth}
      </div>
    );
  }

  const score = plan.score;
  const offRows = plan.rows.filter((r) => r.state === 'low' || r.state === 'high');
  // Green ring is 80+. The quiet line only shows when that score has nothing to add.
  const showQuietLine = waterLooksGood(score, plan.steps.length > 0) && plan.swim.tone === 'good';
  // Overdue: a banner with a button. Otherwise a quiet "next test due" line,
  // unless the good-water line under the score already says it.
  const prompt = testPrompt(lastTest);
  // A dose or shock with no test since is a more useful thing to say than "last tested".
  const retest = retestPrompt(events, lastTest);
  // Did the last round of dosing pay off? Compared with the test before.
  const change = scoreChange(tests);

  return (
    <div>
      <div className="score-home-header">
        <p className="page-title">{greeting}</p>
        <h1 className="page-title">Health Score</h1>
        {poolLabel && (
          <p className="page-subtitle">
            Last test logged {formatRelative(lastTest)} · {poolLabel}
          </p>
        )}
      </div>

      {retest && (
        <div className="callout callout-info test-prompt" role="status">
          <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>{Icon.info}</span>
          <div className="callout-body">
            <strong>{retest.title}.</strong> {retest.body}
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={onLogTest || onLogFirst}>Test water</button>
            </div>
          </div>
        </div>
      )}

      {!retest && prompt?.kind === 'stale' && (
        <div className="callout callout-info test-prompt" role="status">
          <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>{Icon.info}</span>
          <div className="callout-body">
            <strong>{prompt.title}.</strong> {prompt.body}
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={onLogTest || onLogFirst}>Test water</button>
            </div>
          </div>
        </div>
      )}

      {/* What the owner said they could see. The readings cannot show green or
          cloudy water, so this sits above the score and does not change it. */}
      {plan.look && (
        <div className={`callout ${plan.look.tone === 'alert' ? 'callout-alert' : 'callout-action'}`} role="status">
          <span className="callout-icon" style={{ color: plan.look.tone === 'alert' ? 'var(--red)' : 'var(--amber)', display: 'inline-flex' }}>{Icon.alert}</span>
          <div className="callout-body">
            <strong>{plan.look.title}.</strong> {plan.look.body}
            <p className="plan-small" style={{ margin: '6px 0 0' }}>{plan.look.scoreNote ? `${plan.look.scoreNote} ` : ''}From your last test, logged {formatRelative(lastTest)}.</p>
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={onOpenFixer}>Open the problem fixer</button>
            </div>
          </div>
        </div>
      )}

      {/* Score card. The number is centred and is the focus of the screen,
          with the swim call and the next dose one tap underneath. Local
          conditions are typical-month averages, labelled as such on the
          "This month" card — this app does not store or invent weather. */}
      <div className="card score-hero-card" data-tour="hero">
        <HealthScoreRing score={score} size={240} />
        {change && (
          <p className={`score-change score-change-${change.tone}`}>
            {change.tone !== 'same' && <span aria-hidden="true">{change.tone === 'up' ? '▲' : '▼'} </span>}
            {change.text}
          </p>
        )}
        {showQuietLine && <p className="score-quiet">{goodWaterLine(lastTest)}</p>}
        {!showQuietLine && <div className="score-headline">{plan.headline}</div>}
        {!showQuietLine && !retest && prompt?.kind === 'upcoming' && <p className="score-next-test">{prompt.text}</p>}
        <div className="param-tag-row score-hero-tags">
          {plan.rows.map(r => (
            <span key={r.key} className={`tag ${r.state === 'ok' ? 'tag-good' : r.state === 'none' ? 'tag-neutral' : 'tag-warn'}`}>
              {r.state === 'ok' ? '✓ ' : r.state === 'none' ? '? ' : ''}{r.short}
              {/* The colour says "this one needs a change". Say it for screen readers too. */}
              {(r.state === 'low' || r.state === 'high') && <span className="visually-hidden"> is {r.state}</span>}
            </span>
          ))}
        </div>
        <SwimCall
          plan={plan}
          next={next}
          doneCount={doneCount}
          done={done}
          skipped={skipped}
          passed={passed}
          shopCount={shopCount}
          onAdded={onAdded}
          onOpenPlan={() => onOpen('plan')}
          onOpenShop={() => onOpen('shop')}
          onLogTest={onLogTest || onLogFirst}
        />
      </div>

      <LowStock items={low} onOpen={onOpen} />

      {careDue.length > 0 && (
        <div className="callout callout-action care-due-callout">
          <div className="callout-body">
            <strong>{careDue.length === 1 ? 'A job is due' : `${careDue.length} jobs are due`}.</strong>{' '}
            {careDue.map(s => s.task.label).join(', ')}.
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={onOpenCare}>Open equipment care</button>
            </div>
          </div>
        </div>
      )}

      {reminderOffer}

      <Shortcuts pins={pins} onOpen={onOpen} badges={badges} />

      {/* Readings that need attention, then the full table */}
      <div className="card-section stack-lg">
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          {offRows.length ? `${offRows.length} reading${offRows.length === 1 ? '' : 's'} off target` : 'Water readings — all in range'}
        </div>
        <table className="data-table readings-table">
          <thead>
            <tr>
              <th>Reading</th>
              <th>Result</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map(r => (
              <tr key={r.key}>
                <td>{r.name}</td>
                <td style={{ fontWeight: 500, color: 'var(--black)' }}>{fmtReading(r.value, r.unit)}</td>
                <td className="col-muted">{r.target}</td>
                <td>
                  <span className={`tag ${r.state === 'ok' ? 'tag-good' : r.state === 'none' ? 'tag-neutral' : 'tag-warn'}`}>
                    {r.state === 'ok' ? '✓ Good' : r.state === 'low' ? 'Low' : r.state === 'high' ? 'High' : '— No data'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan.combined != null && (
          <p className="plan-small" style={{ marginTop: 8 }}>Combined chlorine (total minus free): {plan.combined} ppm.</p>
        )}
      </div>

      <ThirtyDays tests={tests} events={events} onOpen={onOpen} />
      {thisMonth}

      <button className="fixer-link" onClick={onOpenFixer}>
        <span className="fixer-link-title">Water looking off?</span>
        <span className="fixer-link-sub">Green, cloudy, stinging eyes, foam or stains: open the problem fixer.</span>
      </button>
      <button className="fixer-link" onClick={() => onOpen('chat')}>
        <span className="fixer-link-title">Got a question?</span>
        <span className="fixer-link-sub">Ask Mate. Plain-English answers that know your pool's litres and readings.</span>
      </button>

      <InstallGuide />
    </div>
  );
}
