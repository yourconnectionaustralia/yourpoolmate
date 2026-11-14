

// ─────────────────────────────────────────────────────────────────
// HELP SHEET — opened from the top-nav Help button
// ─────────────────────────────────────────────────────────────────
export function HelpSheet({ onClose, onReplayTour }) {
  const steps = [
    { n: '1', title: 'Enter your test results', body: 'Type the readings in, photograph your test strip, or scan your pool shop\'s printout with your camera. It fills the numbers in for you.' },
    { n: '2', title: 'Check your Health Score', body: 'One number out of 100 tells you where your water stands. Green is swim-ready.' },
    { n: '3', title: 'Follow the plan, in order', body: 'Plan lists what to add, in grams and millilitres for your pool. Tap "I added it" as you go. Re-test a day after dosing.' },
    { n: '4', title: 'Keep the shed stocked', body: 'Add what you buy to My Shed and the plan uses it first, tells you when not to buy more, and adds what you\'re short of to the shopping list.' },
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">How Your Pool Mate works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
          {steps.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--water-pale)', color: 'var(--blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 600,
              }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--black)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.5, marginBottom: 16 }}>
          Every test is saved to your history automatically. That's your warranty record. Stuck, or spotted something off? Use Feedback under Profile, or email{' '}
          <a href="mailto:hello@yourpoolmate.com.au" style={{ color: 'var(--blue)' }}>
            hello@yourpoolmate.com.au
          </a>
        </div>
        <div className="modal-actions">
          {onReplayTour && (
            <button className="btn btn-ghost btn-sm" onClick={onReplayTour}>
              Replay the walkthrough
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
