// File: src/components/ShopPage.jsx
//
// Shopping list: what to pick up. The plan suggests what the shed can't
// cover; the owner adds anything else. Quantities only — dollars live on
// Costs, and only from prices the owner typed.

import { useState } from 'react';
import { PRODUCTS, UNITS, buyQuantity, formatAud, formatPlanAmount, ownerPack, productByKey, productName, shopEstimate, shopListText, toCanonical } from '../lib/shed.js';
import { NotReady } from './ShedPage.jsx';

function AddItem({ onAdd, onCancel }) {
  const [productKey, setProductKey] = useState('liquid_chlorine');
  const [other, setOther] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('L');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const p = productByKey(productKey);
  const units = p ? UNITS[p.form] : ['g', 'kg', 'mL', 'L'];

  return (
    <form
      className="card-section shed-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const name = p ? p.name : other.trim();
        if (!name) { setProblem('Add what you need to buy.'); return; }
        const n = Number(amount);
        const quantity = n > 0 ? toCanonical(n, unit) : 0;
        setBusy(true);
        setProblem('');
        try {
          await onAdd({
            product: name,
            productKey: p?.key ?? null,
            quantity,
            quantityLabel: n > 0 ? `${n} ${unit}` : '',
            form: p ? p.form : (n > 0 ? (unit === 'g' || unit === 'kg' ? 'mass' : 'volume') : 'other'),
            source: 'manual',
          });
          onCancel();
        } catch (err) {
          setProblem(err.message || "That didn't save. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="plan-h2">Add an item</h2>
      <div className="input-group">
        <label className="input-label" htmlFor="shop-product">Product</label>
        <select
          id="shop-product"
          className="input"
          value={productKey}
          onChange={(e) => {
            setProductKey(e.target.value);
            const next = productByKey(e.target.value);
            if (next && !UNITS[next.form].includes(unit)) setUnit(UNITS[next.form][1]);
          }}
        >
          {PRODUCTS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          <option value="">Something else</option>
        </select>
      </div>
      {!p && (
        <div className="input-group">
          <label className="input-label" htmlFor="shop-other">What to buy</label>
          <input id="shop-other" className="input" maxLength={120} value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
      )}
      <div className="shed-line-grid">
        <div className="input-group">
          <label className="input-label" htmlFor="shop-amount">How much (optional)</label>
          <input id="shop-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="shop-unit">Unit</label>
          <select id="shop-unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Add to the list</button>
      </div>
    </form>
  );
}

// After ticking a chemical as bought, offer to put it in the shed.
function ToShed({ item, items, onAddShed, onDone }) {
  const p = productByKey(item.productKey);
  const pack = ownerPack(items, item.productKey) ?? p?.packs[0];
  const [packAmount, setPackAmount] = useState(String(pack?.amount ?? ''));
  const [packUnit, setPackUnit] = useState(pack?.unit ?? UNITS[p?.form ?? 'mass'][1]);
  const [packs, setPacks] = useState(String(Math.max(1, Math.ceil((item.quantity || 0) / Math.max(1, toCanonical(Number(pack?.amount) || 1, pack?.unit || 'g'))))));
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  if (!p) return null;
  return (
    <form
      className="shop-to-shed"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(Number(packAmount) > 0) || !(parseInt(packs, 10) >= 1)) { setProblem('Add the size and how many.'); return; }
        setBusy(true);
        try {
          await onAddShed([{
            productKey: p.key, label: p.name, packAmount: Number(packAmount), packUnit, packs: parseInt(packs, 10),
            priceAud: price === '' ? null : Number(price), source: 'shopping_list',
          }]);
          onDone();
        } catch (err) {
          setProblem(err.message || "That didn't save. Try again.");
          setBusy(false);
        }
      }}
    >
      <p><strong>Put it in My Shed?</strong> Then the plan knows you have it. The price is optional.</p>
      <div className="shed-line-grid">
        <div className="input-group">
          <label className="input-label" htmlFor={`ts-${item.id}-size`}>Size</label>
          <input id={`ts-${item.id}-size`} className="input" inputMode="decimal" value={packAmount} onChange={(e) => setPackAmount(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={`ts-${item.id}-unit`}>Unit</label>
          <select id={`ts-${item.id}-unit`} className="input" value={packUnit} onChange={(e) => setPackUnit(e.target.value)}>
            {UNITS[p.form].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={`ts-${item.id}-qty`}>How many</label>
          <input id={`ts-${item.id}-qty`} className="input" inputMode="numeric" value={packs} onChange={(e) => setPacks(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={`ts-${item.id}-price`}>Paid (optional)</label>
          <input id={`ts-${item.id}-price`} className="input" inputMode="decimal" placeholder="$" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onDone}>No thanks</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Add to My Shed</button>
      </div>
    </form>
  );
}

export default function ShopPage({ available, list, suggestions, low, shedItems, shedAvailable, onAdd, onToggle, onDelete, onAddShed }) {
  const [adding, setAdding] = useState(false);
  const [toShed, setToShed] = useState(null);
  const [copied, setCopied] = useState('');
  const [problem, setProblem] = useState('');

  if (!available) return <NotReady title="Shopping list" />;

  const needed = list.filter((i) => i.status !== 'bought');
  const bought = list.filter((i) => i.status === 'bought');
  const onListKeys = new Set(needed.map((i) => i.productKey || i.product));
  const suggest = suggestions.filter((s) => !onListKeys.has(s.productKey || s.product));
  const lowSuggest = low.filter((l) => !onListKeys.has(l.key) && !suggest.some((s) => s.productKey === l.key));

  const act = async (fn) => {
    setProblem('');
    try { await fn(); } catch (err) { setProblem(err.message || "That didn't save. Try again."); }
  };

  const share = async () => {
    const text = shopListText(list);
    try {
      if (navigator.share) { await navigator.share({ title: 'Pool shopping list', text }); return; }
      await navigator.clipboard.writeText(text);
      setCopied('Copied. Paste it into a message or note.');
    } catch {
      setCopied('');
    }
  };

  return (
    <div>
      <h1 className="page-title">Shopping list</h1>
      <p className="page-subtitle">What to pick up. Quantities only — prices stay on Costs.</p>

      <div className="page-actions">
        <button className="btn btn-primary" onClick={() => setAdding(true)}>Add an item</button>
        {needed.length > 0 && <button className="btn btn-ghost" onClick={share}>Send the list</button>}
      </div>
      {copied && <p role="status" className="plan-small">{copied}</p>}
      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
      {adding && <AddItem onAdd={onAdd} onCancel={() => setAdding(false)} />}

      {(suggest.length > 0 || lowSuggest.length > 0) && (
        <section className="card-section" aria-labelledby="suggest-title">
          <h2 id="suggest-title" className="plan-h2">For today's plan</h2>
          <ul className="shop-list">
            {suggest.map((s) => (
              <li key={`${s.stepKey}-${s.product}`} className="shop-item">
                <div className="shop-item-main">
                  <strong>{s.buy.label} {productName(s.productKey, s.product)}</strong>
                  <span className="plan-small">{s.stepTitle}{s.have > 0 ? ` · you have ${formatPlanAmount(s.have, s.form)}, the plan needs ${formatPlanAmount(s.need, s.form)}` : ''}</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => act(() => onAdd({
                    product: s.product, productKey: s.productKey, quantity: s.buy.quantity, quantityLabel: s.buy.label,
                    form: s.form, source: 'plan', testId: s.testId, stepKey: s.stepKey, stepTitle: s.stepTitle,
                  }))}
                >
                  Add
                </button>
              </li>
            ))}
            {lowSuggest.map((l) => {
              const p = productByKey(l.key);
              const pack = ownerPack(shedItems, l.key) ?? p?.packs[0];
              const q = pack ? buyQuantity(toCanonical(pack.amount, pack.unit), p.form, pack) : null;
              return (
                <li key={`low-${l.key}`} className="shop-item">
                  <div className="shop-item-main">
                    <strong>{q?.label ?? ''} {l.name}</strong>
                    <span className="plan-small">Running low · about {l.weeksLeft < 1 ? 'under a week' : `${l.weeksLeft} weeks`} left</span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => act(() => onAdd({ product: p.name, productKey: l.key, quantity: q?.quantity ?? 0, quantityLabel: q?.label ?? '', form: p.form, source: 'manual' }))}
                  >
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {needed.length === 0 && suggest.length === 0 && !adding ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">Nothing to buy</div>
            <div className="empty-state-body">When the plan needs something the shed doesn't have, it shows up here. You can add anything else yourself.</div>
          </div>
        </div>
      ) : needed.length > 0 && (
        <section className="card-section" aria-labelledby="list-title">
          <h2 id="list-title" className="plan-h2">To buy</h2>
          <ul className="shop-list">
            {needed.map((i) => {
              const est = shopEstimate(i, shedItems);
              return (
                <li key={i.id} className="shop-item">
                  <div className="shop-item-main">
                    <strong>{i.quantityLabel ? `${i.quantityLabel} ` : ''}{productName(i.productKey, i.product)}</strong>
                    <span className="plan-small">
                      {i.stepTitle || (i.source === 'manual' ? 'Added by you' : '')}
                      {est ? ` · about ${formatAud(est)} at your last price` : ''}
                    </span>
                  </div>
                  <div className="shop-item-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => act(async () => { await onToggle(i, true); if (shedAvailable && i.productKey) setToShed(i.id); })}>Bought</button>
                    <button className="btn btn-ghost btn-sm" aria-label={`Remove ${productName(i.productKey, i.product)}`} onClick={() => act(() => onDelete(i))}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {bought.length > 0 && (
        <section className="card-section" aria-labelledby="bought-title">
          <h2 id="bought-title" className="plan-h2">Bought</h2>
          <ul className="shop-list">
            {bought.map((i) => (
              <li key={i.id} className="shop-item shop-item-bought">
                <div className="shop-item-main">
                  <strong>{i.quantityLabel ? `${i.quantityLabel} ` : ''}{productName(i.productKey, i.product)}</strong>
                </div>
                <div className="shop-item-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => act(() => onToggle(i, false))}>Put back</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => act(() => onDelete(i))}>Remove</button>
                </div>
                {toShed === i.id && <ToShed item={i} items={shedItems} onAddShed={onAddShed} onDone={() => setToShed(null)} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
