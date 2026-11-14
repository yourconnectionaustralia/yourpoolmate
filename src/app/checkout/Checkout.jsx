import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { createCheckoutSession } from '../../lib/stripeCheckout.js';

// ─────────────────────────────────────────────────────────────────
// IN-APP CHECKOUT
// Signed-in users pay here. stripe-checkout decides founding ($79 once)
// vs annual ($49/year) from the count of paid founding members. We never send a plan or
// Price ID, and we never send the user to the marketing site.
// ─────────────────────────────────────────────────────────────────
export const CHECKOUT_RETURN_KEY = 'ypm_checkout_return';

// Read ?checkout=success|cancelled once. The value is stashed so a
// StrictMode remount (dev) still shows the note after the query is stripped.
export function captureCheckoutReturn() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('checkout');
    if (fromUrl === 'success' || fromUrl === 'cancelled') {
      sessionStorage.setItem(CHECKOUT_RETURN_KEY, fromUrl);
      params.delete('checkout');
      params.delete('session_id');
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
      return fromUrl;
    }
    const stored = sessionStorage.getItem(CHECKOUT_RETURN_KEY);
    if (stored === 'success' || stored === 'cancelled') return stored;
  } catch {
    /* private mode */
  }
  return null;
}

export function CheckoutReturnNote({ status }) {
  if (status !== 'success' && status !== 'cancelled') return null;
  const success = status === 'success';
  return (
    <div
      className={`callout ${success ? 'callout-success' : 'callout-info'}`}
      role="status"
      style={{ marginBottom: 16, textAlign: 'left' }}
    >
      <div className="callout-body">
        {success
          ? 'Payment received. Access updates as soon as it clears — refresh if this screen stays up.'
          : 'Checkout cancelled. Nothing was charged.'}
      </div>
    </div>
  );
}

export function CheckoutButton({ label, className, style, block }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startCheckout = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const origin = window.location.origin;
      const url = await createCheckoutSession(supabase, {
        successUrl: origin,
        cancelUrl: origin,
      });
      window.location.assign(url);
    } catch (err) {
      console.error('stripe-checkout create_session failed:', err);
      setError(err?.message || "Couldn't open checkout. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div style={{ width: block ? '100%' : undefined }}>
      <button
        type="button"
        className={className}
        style={style}
        onClick={startCheckout}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? 'Opening checkout…' : label}
      </button>
      {error && (
        <div role="alert" style={{ fontSize: 17, color: 'var(--red)', marginTop: 8, lineHeight: 1.4, textAlign: 'left' }}>
          {error}
        </div>
      )}
    </div>
  );
}
