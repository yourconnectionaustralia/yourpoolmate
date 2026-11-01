// File: src/components/ShedPage.jsx
//
// My Shed: the chemicals the owner has on hand. Add a bag or bottle by hand,
// or photograph a receipt and check the lines. When the plan uses a product,
// the dose draws from here and the plan says when there is no need to buy.
//
// Prices are optional and only ever typed or confirmed by the owner.

import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompress.js';
import { PRODUCTS, UNITS, formatAud, formatCanonical, hasPrice, matchProduct, productByKey } from '../lib/shed.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const today = () => new Date().toISOString().slice(0, 10);
const dateText = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function NotReady({ title }) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>
      <div className="callout callout-info">
        <div className="callout-body">
          <strong>Nearly ready.</strong> This part of the app is switched on with the next database update. Your tests and history are not affected.
        </div>
      </div>
    </div>
  );
}

function blankLine(productKey = 'liquid_chlorine') {
  const p = productByKey(productKey);
  const pack = p?.packs[0] ?? { amount: 1, unit: 'kg' };
  return { productKey, packAmount: String(pack.amount), packUnit: pack.unit, packs: '1', priceAud: '' };
}

function lineProblem(l) {
  if (!productByKey(l.productKey)) return 'Choose the product.';
  if (!(Number(l.packAmount) > 0)) return 'Add the pack size.';
  if (!(parseInt(l.packs, 10) >= 1)) return 'Add how many you bought.';
  if (l.priceAud !== '' && !(Number(l.priceAud) >= 0)) return 'Price needs to be a number.';
  return null;
}

const toItem = (l, extra) => ({
  productKey: l.productKey,
  label: productByKey(l.productKey)?.name ?? l.productKey,
  packAmount: Number(l.packAmount),
  packUnit: l.packUnit,
  packs: parseInt(l.packs, 10) || 1,
  priceAud: l.priceAud === '' ? null : Number(l.priceAud),
  ...extra,
});

function LineFields({ line, onChange, idPrefix, showProduct = true }) {
  const p = productByKey(line.productKey);
  const units = UNITS[p?.form ?? 'mass'];
  return (
    <div className="shed-line">
      {showProduct && (
        <div className="input-group">
          <label className="input-label" htmlFor={`${idPrefix}-product`}>Product</label>
          <select
            id={`${idPrefix}-product`}
            className="input"
            value={line.productKey}
            onChange={(e) => {
              const next = productByKey(e.target.value);
              const pack = next?.packs[0];
              onChange({ ...line, productKey: e.target.value, ...(pack && !UNITS[next.form].includes(line.packUnit) ? { packAmount: String(pack.amount), packUnit: pack.unit } : {}) });
            }}
          >
            {!line.productKey && <option value="">Choose the product</option>}
            {PRODUCTS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
        </div>
      )}
      {p && (
        <div className="shed-presets" role="group" aria-label="Common sizes">
          {p.packs.map((k) => (
            <button
              key={`${k.amount}${k.unit}`}
              type="button"
              className={`chip${Number(line.packAmount) === k.amount && line.packUnit === k.unit ? ' is-on' : ''}`}
              aria-pressed={Number(line.packAmount) === k.amount && line.packUnit === k.unit}
              onClick={() => onChange({ ...line, packAmount: String(k.amount), packUnit: k.unit })}
            >
              {k.amount} {k.unit}
            </button>
          ))}
        </div>
      )}
      <div className="shed-line-grid">
        <div className="input-group">
          <label className="input-label" htmlFor={`${idPrefix}-size`}>Size</label>
          <input id={`${idPrefix}-size`} className="input" inputMode="decimal" value={line.packAmount} onChange={(e) => onChange({ ...line, packAmount: e.target.value })} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={`${idPrefix}-unit`}>Unit</label>
          <select id={`${idPrefix}-unit`} className="input" value={line.packUnit} onChange={(e) => onChange({ ...line, packUnit: e.target.value })}>
            {units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={`${idPrefix}-qty`}>How many</label>
          <input id={`${idPrefix}-qty`} className="input" inputMode="numeric" value={line.packs} onChange={(e) => onChange({ ...line, packs: e.target.value })} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={`${idPrefix}-price`}>Paid (optional)</label>
          <input id={`${idPrefix}-price`} className="input" inputMode="decimal" placeholder="$" value={line.priceAud} onChange={(e) => onChange({ ...line, priceAud: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function AddForm({ onAdd, onCancel }) {
  const [line, setLine] = useState(blankLine());
  const [store, setStore] = useState('');
  const [boughtAt, setBoughtAt] = useState(today());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  return (
    <form
      className="card-section shed-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const p = lineProblem(line);
        if (p) { setProblem(p); return; }
        setBusy(true);
        setProblem('');
        try {
          await onAdd([toItem(line, { store, boughtAt, source: 'typed' })]);
          onCancel();
        } catch (err) {
          setProblem(err.message || "That didn't save. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="plan-h2">Add what you bought</h2>
      <LineFields line={line} onChange={setLine} idPrefix="shed-add" />
      <div className="shed-line-grid">
        <div className="input-group">
          <label className="input-label" htmlFor="shed-store">Store (optional)</label>
          <input id="shed-store" className="input" value={store} maxLength={80} onChange={(e) => setStore(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="shed-date">Bought on</label>
          <input id="shed-date" className="input" type="date" max={today()} value={boughtAt} onChange={(e) => setBoughtAt(e.target.value)} />
        </div>
      </div>
      <p className="plan-small">Leave the price blank if you'd rather not see dollars. We never fill in a price for you.</p>
      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add to the shed'}</button>
      </div>
    </form>
  );
}

async function readReceipt(file) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const { base64, mediaType } = await compressImage(file);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-water-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ image_base64: base64, media_type: mediaType, kind: 'receipt' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error({
      RATE_LIMITED: data.error || 'Scan limit reached — try again in an hour.',
      NOT_CONFIGURED: "Receipt reading isn't switched on yet. Type the products in instead.",
    }[data.code] || data.error || "Couldn't read that receipt. Try a flatter, well-lit photo, or type it in.");
  }
  return data;
}

// Receipt lines → editable lines. Products we can't match are left for the
// owner to choose; nothing is invented.
export function receiptToLines(receipt) {
  return (receipt?.lines || []).map((l) => {
    const p = matchProduct(l.name);
    const unitOk = p && l.pack_unit && UNITS[p.form].includes(l.pack_unit);
    return {
      rawName: l.name,
      include: Boolean(p),
      productKey: p?.key ?? '',
      packAmount: unitOk && l.pack_amount ? String(l.pack_amount) : (p ? String(p.packs[0].amount) : ''),
      packUnit: unitOk ? l.pack_unit : (p?.packs[0].unit ?? 'kg'),
      packs: String(l.quantity || 1),
      priceAud: l.price != null ? String(l.price) : '',
    };
  });
}

function ReceiptReview({ result, onAdd, onCancel }) {
  const [lines, setLines] = useState(() => receiptToLines(result.receipt));
  const [store, setStore] = useState(result.receipt?.store ?? '');
  const [boughtAt, setBoughtAt] = useState(result.receipt?.date ?? today());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const chosen = lines.filter((l) => l.include);

  return (
    <form
      className="card-section shed-form"
      onSubmit={async (e) => {
        e.preventDefault();
        for (const l of chosen) {
          const p = lineProblem(l);
          if (p) { setProblem(`${l.rawName || 'A line'}: ${p}`); return; }
        }
        if (!chosen.length) { setProblem('Tick at least one line, or cancel.'); return; }
        setBusy(true);
        setProblem('');
        try {
          const receiptId = crypto.randomUUID?.() ?? null;
          await onAdd(chosen.map((l) => toItem(l, { store, boughtAt, source: 'receipt', receiptId })));
          onCancel();
        } catch (err) {
          setProblem(err.message || "That didn't save. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="plan-h2">Check the receipt</h2>
      <p>Nothing goes in the shed until you confirm. Fix anything that looks wrong.</p>
      {result.confidence !== 'high' && (
        <p className="plan-warn">Some of this was hard to read{result.notes ? ` (${result.notes})` : ''}. Check each line against the receipt.</p>
      )}
      <div className="shed-line-grid">
        <div className="input-group">
          <label className="input-label" htmlFor="rc-store">Store</label>
          <input id="rc-store" className="input" value={store} maxLength={80} onChange={(e) => setStore(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="rc-date">Date</label>
          <input id="rc-date" className="input" type="date" max={today()} value={boughtAt} onChange={(e) => setBoughtAt(e.target.value)} />
        </div>
      </div>
      {lines.length === 0 && <p className="plan-warn">No pool chemicals were clear on that receipt. Add them by hand instead — we don't guess.</p>}
      {lines.map((l, i) => (
        <fieldset key={`${l.rawName}-${i}`} className="receipt-line">
          <label className="reminder-check">
            <input type="checkbox" checked={l.include} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
            <span>“{l.rawName}”</span>
          </label>
          {l.include && (
            <LineFields
              line={l}
              idPrefix={`rc-${i}`}
              onChange={(next) => setLines(lines.map((x, j) => (j === i ? { ...x, ...next } : x)))}
            />
          )}
        </fieldset>
      ))}
      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel — nothing is saved</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !chosen.length}>
          {busy ? 'Saving…' : `Add ${chosen.length} to the shed`}
        </button>
      </div>
      <p className="plan-small">The photo is read once to find the lines and is not kept.</p>
    </form>
  );
}

export default function ShedPage({ available, stock, low, onAdd, onDelete, onOpen }) {
  const [mode, setMode] = useState(null); // null | 'add' | 'reading' | { receipt }
  const [problem, setProblem] = useState('');
  const fileRef = useRef(null);
  const galleryRef = useRef(null);

  if (!available) return <NotReady title="My Shed" />;

  const pickReceipt = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProblem('');
    setMode('reading');
    try {
      setMode(await readReceipt(file));
    } catch (err) {
      setMode(null);
      setProblem(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">My Shed</h1>
      <p className="page-subtitle">What you have on hand. The plan uses it first and tells you when not to buy more.</p>

      <div className="page-actions">
        <button className="btn btn-primary" onClick={() => setMode('add')}>Add a product</button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={mode === 'reading'}>
          {mode === 'reading' ? 'Reading the receipt…' : 'Photograph a receipt'}
        </button>
        <button className="btn btn-ghost" onClick={() => galleryRef.current?.click()} disabled={mode === 'reading'}>
          Choose a receipt photo
        </button>
        {/* `capture` skips the photo library on iPhone, so the library has its own input. */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={pickReceipt} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pickReceipt} />
      </div>
      {problem && <p role="alert" className="test-editor-problem">{problem}</p>}

      {mode === 'add' && <AddForm onAdd={onAdd} onCancel={() => setMode(null)} />}
      {mode && typeof mode === 'object' && <ReceiptReview result={mode} onAdd={onAdd} onCancel={() => setMode(null)} />}

      {low.length > 0 && (
        <div className="callout callout-action">
          <div className="callout-body">
            <strong>Running low:</strong> {low.map((i) => `${i.name} (about ${i.weeksLeft < 1 ? 'under a week' : `${i.weeksLeft} weeks`} left)`).join(', ')}.{' '}
            <button className="link-btn" onClick={() => onOpen('shop')}>Shopping list</button>
          </div>
        </div>
      )}

      {stock.length === 0 && !mode ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">The shed is empty</div>
            <div className="empty-state-body">
              Add a bag or bottle you already have, or photograph a receipt. When the plan uses that product we take it off here and tell you not to buy more.
            </div>
          </div>
        </div>
      ) : (
        <ul className="shed-list">
          {[...stock].reverse().map((s) => {
            const p = productByKey(s.productKey);
            const pct = Math.round(s.ratio * 100);
            return (
              <li key={s.id} className="card-section shed-item">
                <div className="shed-item-head">
                  <h3 className="plan-step-title">{s.label}</h3>
                  <span className={`tag ${pct <= 15 ? 'tag-warn' : 'tag-good'}`}>{pct}% left</span>
                </div>
                <p className="plan-small">
                  {s.packs > 1 ? `${s.packs} × ` : ''}{s.packAmount} {s.packUnit}
                  {s.store ? ` · ${s.store}` : ''}{s.boughtAt ? ` · ${dateText(s.boughtAt)}` : ''}
                  {hasPrice(s) ? ` · ${formatAud(s.priceAud)}` : ' · no price entered'}
                </p>
                <div className="gauge" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${s.label}: ${pct}% left`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="shed-item-foot">
                  <span>About {formatCanonical(s.remaining, p?.form ?? 'mass')} left</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { if (window.confirm(`Take ${s.label} out of the shed? Doses already logged stay in your history.`)) onDelete(s.id); }}
                  >
                    {s.remaining <= 0 ? 'Remove' : 'Used up / remove'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
