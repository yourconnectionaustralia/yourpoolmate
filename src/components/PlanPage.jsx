// File: src/components/PlanPage.jsx
//
// Today's plan: the steps for the latest test, in order. Each step can be
// marked as added (with the plan amount or a different one), or put on the
// shopping list when the owner hasn't bought the product yet.
//
// Ticks come from the history itself (a dose event carries its test and
// step), so they follow the owner to every device.

import { useState } from 'react';
import {
  POISONS_LINE,
  amountForForm,
  differentAmountGuidance,
  doseLabel,
  isBuyable,
  optionAmount,
  parseAmount,
  shortProduct,
} from '../lib/plan.js';
import { enoughInShed, formatAud, latestUnitPrice, ownerPack, planShortfall, productKeyForDose } from '../lib/shed.js';
import { fmtMass, fmtVol } from '../lib/dosing.js';

const whenText = (iso) => {
  if (!iso) return '';
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 2) return 'just now';
  if (mins < 60) return `${Math.round(mins)} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hr ago`;
  const days = Math.round(mins / 1440);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function nextStep(plan, done, skipped) {
  return plan?.steps.find((s) => !done[s.key] && !skipped[s.key]) ?? null;
}

function DifferentAmount({ step, option, test, ctx, stock, onLog, onBack, busy }) {
  const buyable = step.options.filter(isBuyable);
  const [product, setProduct] = useState(option.name);
  const chosen = buyable.find((o) => o.name === product) ?? option;
  const start = amountForForm(chosen);
  const [value, setValue] = useState(start.value);
  const [unit, setUnit] = useState(start.unit);
  const parsed = parseAmount(value, unit);
  const amount = parsed ? (parsed.grams ?? parsed.millilitres) : 0;
  const guidance = parsed ? differentAmountGuidance({ step, option: chosen, amount, test, ctx }) : null;
  const units = chosen.grams > 0 ? ['g', 'kg'] : ['mL', 'L'];
  const key = productKeyForDose(chosen.name);
  const pack = key ? ownerPack(stock, key) : null;
  const id = `amt-${step.key}`;

  return (
    <form
      className="plan-amount"
      onSubmit={(e) => {
        e.preventDefault();
        if (!parsed) return;
        onLog({ ...chosen, grams: parsed.grams, millilitres: parsed.millilitres, amount: parsed.grams ? fmtMass(parsed.grams) : fmtVol(parsed.millilitres), summary: undefined });
      }}
    >
      <p className="plan-amount-lead">
        The plan says <strong>{chosen.amount}</strong> of {shortProduct(chosen.name)}. Type what you actually added — a rounded-up scoop or what was left in the bottle is fine.
      </p>
      {buyable.length > 1 && (
        <div className="input-group">
          <label className="input-label" htmlFor={`${id}-product`}>Product</label>
          <select
            id={`${id}-product`}
            className="input"
            value={product}
            onChange={(e) => {
              const next = buyable.find((o) => o.name === e.target.value);
              if (!next) return;
              setProduct(next.name);
              const f = amountForForm(next);
              setValue(f.value);
              setUnit(f.unit);
            }}
          >
            {buyable.map((o) => <option key={o.name} value={o.name}>{shortProduct(o.name)}</option>)}
          </select>
        </div>
      )}
      <div className="plan-amount-row">
        <div className="input-group">
          <label className="input-label" htmlFor={id}>Amount</label>
          <input id={id} className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={`${id}-unit`}>Unit</label>
          <select id={`${id}-unit`} className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {pack && (
        <button type="button" className="btn btn-ghost" onClick={() => { setValue(String(pack.amount)); setUnit(pack.unit); }}>
          Use a whole {pack.amount} {pack.unit} from the shed
        </button>
      )}
      {guidance && (
        <p role="status" className={`plan-guidance plan-guidance-${guidance.kind === 'match' ? 'good' : 'warn'}`}>{guidance.text}</p>
      )}
      <div className="plan-step-buttons">
        <button type="submit" className="btn btn-primary btn-block" disabled={!parsed || busy}>
          {parsed ? `Log ${parsed.grams ? fmtMass(parsed.grams) : fmtVol(parsed.millilitres)} of ${shortProduct(chosen.name)}` : 'Type an amount'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>Back</button>
      </div>
    </form>
  );
}

function StepCard({ step, index, total, isNext, record, skippedItem, test, ctx, stock, shopAvailable, onAdded, onUndo, onSkip, onUnskip }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('choose');
  const [pick, setPick] = useState(step.options[0]?.name);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const option = step.options.find((o) => o.name === pick) ?? step.options[0];
  const firstBuyable = step.options.find(isBuyable);
  const expanded = isNext || open || Boolean(skippedItem);
  const enough = option && isBuyable(option) && enoughInShed(stock, option.name, optionAmount(option));

  const run = async (fn) => {
    setBusy(true);
    setProblem('');
    try {
      await fn();
      setMode('choose');
    } catch (err) {
      setProblem(err?.message && err.code === 'FEATURE_NOT_READY'
        ? err.message
        : "That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (record) {
    return (
      <article className="plan-step plan-step-done" aria-label={`Step ${index + 1} of ${total}: ${step.action}, added`}>
        <span className="plan-step-check" aria-hidden="true">✓</span>
        <div className="plan-step-main">
          <h3 className="plan-step-title">{step.action}</h3>
          <p className="plan-step-meta">
            {record.title.replace(/^Added /, 'Added ')} · {whenText(record.date)}
            {record.costAud ? ` · ${formatAud(record.costAud)}` : ''}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => onUndo(record))}>Undo</button>
      </article>
    );
  }

  return (
    <article
      className={`plan-step${isNext ? ' plan-step-next' : ''}${skippedItem ? ' plan-step-skipped' : ''}`}
      aria-label={`Step ${index + 1} of ${total}: ${step.action}${skippedItem ? ', on the shopping list' : ''}`}
    >
      <div className="plan-step-head">
        <span className={`plan-step-num${isNext ? ' is-next' : ''}`} aria-hidden="true">{index + 1}</span>
        <div className="plan-step-main">
          <p className="plan-step-eyebrow">
            Step {index + 1} of {total}{isNext ? ' · do this next' : skippedItem ? ' · on the shopping list' : ''}
          </p>
          <h3 className="plan-step-title">{step.action}</h3>
          <ul className="plan-options">
            {step.options.map((o, i) => (
              <li key={o.name}>
                {i > 0 && <span className="plan-or">or </span>}
                {o.summary ? o.summary : o.amount ? <><strong>{o.amount}</strong> {shortProduct(o.name)}</> : shortProduct(o.name).replace(/^\w/, (c) => (i === 0 ? c.toUpperCase() : c))}
              </li>
            ))}
          </ul>
          {enough && <p className="plan-enough">You have enough {shortProduct(option.name)} in the shed — no need to buy more.</p>}
        </div>
      </div>

      {expanded ? (
        <div className="plan-step-body">
          {skippedItem ? (
            <>
              <p className="plan-note-box">On your shopping list{skippedItem.quantityLabel ? ` (${skippedItem.quantityLabel})` : ''}. Mark it added once you've put it in.</p>
              <div className="plan-step-buttons">
                <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run(() => onAdded(step, firstBuyable ?? option))}>
                  I added {doseLabel(firstBuyable ?? option)}
                </button>
                <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => run(() => onUnskip(skippedItem))}>Take it off the shopping list</button>
              </div>
            </>
          ) : mode === 'amount' && firstBuyable ? (
            <DifferentAmount
              step={step}
              option={isBuyable(option) ? option : firstBuyable}
              test={test}
              ctx={ctx}
              stock={stock}
              busy={busy}
              onBack={() => setMode('choose')}
              onLog={(o) => run(() => onAdded(step, o))}
            />
          ) : (
            <>
              {step.options.length > 1 && (
                <fieldset className="plan-choose">
                  <legend className="plan-choose-legend">Which one are you using?</legend>
                  {step.options.map((o, i) => (
                    <button
                      key={o.name}
                      type="button"
                      aria-pressed={o.name === option.name}
                      className={`plan-choice${o.name === option.name ? ' is-on' : ''}`}
                      onClick={() => setPick(o.name)}
                    >
                      {i === 0 ? 'Recommended · ' : 'Or · '}{doseLabel(o)}
                    </button>
                  ))}
                </fieldset>
              )}
              <div className="plan-step-buttons">
                <button className="btn btn-primary btn-block plan-dose-btn" disabled={busy} onClick={() => run(() => onAdded(step, option))}>
                  {isBuyable(option) ? `I added ${doseLabel(option)}` : `Done: ${doseLabel(option)}`}
                </button>
                {firstBuyable && (
                  <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setMode('amount')}>I added a different amount</button>
                )}
                {firstBuyable && shopAvailable && (
                  <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => run(() => onSkip(step, isBuyable(option) ? option : firstBuyable))}>
                    I haven't bought it yet — add to shopping list
                  </button>
                )}
              </div>
            </>
          )}
          {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
          <p className="dose-safety">{step.safety}</p>
          <p className="plan-wait">{step.wait}</p>
          {!step.volumeKnown && <p className="plan-warn">Set the pool volume in Pool setup to see quantities.</p>}
          {step.notes.length > 0 && (
            <details className="plan-why">
              <summary>Why this order</summary>
              <ul>{step.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </details>
          )}
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm plan-show" aria-expanded="false" onClick={() => setOpen(true)}>Show steps and safety</button>
      )}
    </article>
  );
}

function ShedSummary({ plan, stock, done, testId, shopAvailable, onOpen }) {
  const rows = planShortfall({ plan, stock, doneKeys: new Set(Object.keys(done)), testId });
  if (!rows.length) return null;
  const toBuy = rows.filter((r) => !r.covered);
  const covered = rows.filter((r) => r.covered);
  const chlor = plan.steps.find((s) => s.options[0] && !isBuyable(s.options[0]) && /chlorinator/i.test(s.options[0].name));
  const liquid = chlor?.options.find((o) => o.millilitres > 0);
  const unit = liquid ? latestUnitPrice(stock, 'liquid_chlorine') : null;
  return (
    <section className="card-section plan-shed" aria-labelledby="plan-shed-title">
      <h2 id="plan-shed-title" className="plan-h2">What this plan needs</h2>
      <ul className="plan-shed-list">
        <li>
          <strong>To buy:</strong>{' '}
          {toBuy.length ? toBuy.map((r) => `${r.buy.label} ${shortProduct(r.product)}`).join(', ') : 'nothing extra for this plan.'}
        </li>
        {covered.map((r) => <li key={r.stepKey} className="plan-enough">From the shed: {shortProduct(r.product)} — you have enough.</li>)}
        {liquid && (
          <li>
            <strong>The chlorinator</strong> can do the work of about {fmtVol(liquid.millilitres)} of liquid chlorine
            {unit ? ` — about ${formatAud(liquid.millilitres * unit)} at your last price.` : '.'}
          </li>
        )}
      </ul>
      <div className="plan-links">
        {shopAvailable && <button className="link-btn" onClick={() => onOpen('shop')}>Shopping list</button>}
        {shopAvailable && <button className="link-btn" onClick={() => onOpen('shed')}>My Shed</button>}
        <button className="link-btn" onClick={() => onOpen('costs')}>Costs</button>
      </div>
    </section>
  );
}

export default function PlanPage({
  test, plan, ctx, done, skipped, stock, shopAvailable,
  onAdded, onUndo, onSkip, onUnskip, onOpen, onLogTest, onOpenFixer, retest,
}) {
  if (!test || !plan) {
    return (
      <div>
        <h1 className="page-title">Plan</h1>
        <p className="page-subtitle">What to add, in order, for your litres</p>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No plan yet</div>
            <div className="empty-state-body">The plan comes from your latest test and your pool volume. Log a test and it appears here, step by step.</div>
            <button className="btn btn-primary" onClick={onLogTest}>Log a test</button>
          </div>
        </div>
      </div>
    );
  }

  const next = nextStep(plan, done, skipped);
  const addedCount = plan.steps.filter((s) => done[s.key]).length;
  const skippedCount = plan.steps.filter((s) => !done[s.key] && skipped[s.key]).length;
  const allAdded = plan.steps.length > 0 && addedCount === plan.steps.length;

  return (
    <div className="plan-page">
      <h1 className="page-title">{plan.steps.length ? "Today's plan" : 'Nothing to add'}</h1>
      <p className="page-subtitle">
        From your test {whenText(test.createdAt)}{ctx.volumeL ? ` · ${ctx.volumeL.toLocaleString('en-AU')} L` : ''}
      </p>

      {plan.steps.length > 0 ? (
        <section className="card-section plan-progress" aria-label="Progress">
          <p className="plan-progress-text">
            {addedCount} of {plan.steps.length} added{skippedCount ? ` · ${skippedCount} on the shopping list` : ''}
          </p>
          <div className="plan-progress-bar" aria-hidden="true">
            {plan.steps.map((s) => (
              <span key={s.key} className={done[s.key] ? 'is-done' : next?.key === s.key ? 'is-next' : skipped[s.key] ? 'is-skipped' : ''} />
            ))}
          </div>
          {plan.saltRange && (
            <p className="plan-small">Salt target for {plan.saltRange.label}: {plan.saltRange.lo.toLocaleString('en-AU')}–{plan.saltRange.hi.toLocaleString('en-AU')} ppm.</p>
          )}
        </section>
      ) : (
        <div className="callout callout-success">
          <div className="callout-body">
            <strong>Every reading we scored is in range.</strong> Nothing to add today. Test again within the week, or within a fortnight in winter.
          </div>
        </div>
      )}

      {allAdded && (
        <section className="callout callout-success plan-all-added" aria-labelledby="all-added">
          <div className="callout-body">
            <h2 id="all-added" className="plan-h2">All added</h2>
            <p>{retest?.body ?? 'Give the chemicals time to circulate, then test again in about 24 hours to confirm the new balance.'}</p>
            <button className="btn btn-primary" onClick={onLogTest}>Log the re-test</button>
          </div>
        </section>
      )}

      <ol className="plan-steps">
        {plan.steps.map((s, i) => (
          <li key={s.key}>
            <StepCard
              step={s}
              index={i}
              total={plan.steps.length}
              isNext={next?.key === s.key}
              record={done[s.key]}
              skippedItem={skipped[s.key]}
              test={test}
              ctx={ctx}
              stock={stock}
              shopAvailable={shopAvailable}
              onAdded={onAdded}
              onUndo={onUndo}
              onSkip={onSkip}
              onUnskip={onUnskip}
            />
          </li>
        ))}
      </ol>

      {plan.steps.length > 0 && (
        <ShedSummary plan={plan} stock={stock} done={done} testId={test.id} shopAvailable={shopAvailable} onOpen={onOpen} />
      )}

      {plan.watchouts.map((w) => (
        <p key={w} className="plan-watchout">{w}</p>
      ))}

      {plan.lsi && (
        <section className="card-section" aria-label="Balance index">
          <h2 className="plan-h2">Balance index {plan.lsi.value > 0 ? '+' : ''}{plan.lsi.value}</h2>
          <p className="plan-small"><span className={`tag ${plan.lsi.tone === 'good' ? 'tag-good' : 'tag-warn'}`}>{plan.lsi.label}</span> {plan.lsi.note}</p>
        </section>
      )}

      <p className="dose-guidance">{plan.guidance}</p>
      <p className="dose-guidance">{POISONS_LINE}</p>
      <button className="fixer-link" onClick={onOpenFixer}>
        <span className="fixer-link-title">Water looking off?</span>
        <span className="fixer-link-sub">Green, cloudy, stinging eyes, foam or stains: open the problem fixer.</span>
      </button>
    </div>
  );
}
