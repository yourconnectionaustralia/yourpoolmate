import { PoolIcon } from '../../components/PoolIcon.jsx';
import { offerCopy } from '../../lib/stripeCheckout.js';
import { CheckoutButton, CheckoutReturnNote } from '../checkout/Checkout.jsx';

// ─────────────────────────────────────────────────────────────────
// TRIAL EXPIRED BLOCK SCREEN
// ─────────────────────────────────────────────────────────────────
export function TrialExpiredScreen({ pricing, checkoutReturn }) {
  const copy = offerCopy(pricing);
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gray-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div className="card-elevated" style={{ maxWidth: 440, width: '100%', padding: '48px 40px', textAlign: 'center' }}>
        <CheckoutReturnNote status={checkoutReturn} />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, color: 'var(--blue)' }}>
          <PoolIcon name="swimmer" size={44} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-read)', fontSize: 24, fontWeight: 400, color: 'var(--black)', marginBottom: 12 }}>
          Your free trial has ended
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 'var(--lh-body)', marginBottom: 28 }}>
          {copy.expiredBody}
        </p>
        <div style={{ background: 'var(--water-pale)', borderRadius: 'var(--r-sm)', padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-read)', fontSize: 36, fontWeight: 400, color: 'var(--black)' }}>
            {copy.priceLabel || '—'}
          </div>
          <div style={{ fontSize: 17, color: 'var(--gray-mid)' }}>{copy.priceNote}</div>
        </div>
        <CheckoutButton
          block
          label={copy.claimLabel}
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 10 }}
        />
        <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 10 }}>
          {copy.footnote}
        </div>
      </div>
    </div>
  );
}
