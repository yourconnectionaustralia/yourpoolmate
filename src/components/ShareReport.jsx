// File: src/components/ShareReport.jsx
//
// "Share the latest report" card on the Chemistry log. Builds a link that
// carries the report, so the person receiving it needs no account.

import { useState } from 'react';
import { buildReport, reportUrl } from '../lib/reportLink.js';

export default function ShareReport({ pool, tests, events, scoreFn, saltRange }) {
  const [status, setStatus] = useState('');
  const [link, setLink] = useState('');
  if (!tests.length) return null;

  const make = () => reportUrl(window.location.origin, buildReport({ pool, tests, events, scoreFn, saltRange }));

  const share = async () => {
    const url = make();
    setLink(url);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${pool?.name || 'Pool'} water report`, url });
        setStatus('');
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus('Link copied. Paste it into an email or message.');
    } catch {
      setStatus('Copy the link below.');
    }
  };

  return (
    <div className="card-section share-report">
      <div className="eyebrow" style={{ marginBottom: 8 }}>Share the latest report</div>
      <p>
        A link to your last {Math.min(12, tests.length)} test{tests.length === 1 ? '' : 's'} and the chemicals you added — for the pool shop, a buyer or a warranty claim.
        It opens without an account, and your name, email and address are left out.
      </p>
      <div className="page-actions">
        <button className="btn btn-primary" onClick={share}>Share a link</button>
        <a className="btn btn-ghost" href={make()} target="_blank" rel="noreferrer">Preview<span className="visually-hidden"> (opens in a new tab)</span></a>
      </div>
      {status && <p role="status" className="plan-small">{status}</p>}
      {link && status === 'Copy the link below.' && (
        <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Report link" />
      )}
      <p className="plan-small">The link is a snapshot. Send a new one after more tests.</p>
    </div>
  );
}
