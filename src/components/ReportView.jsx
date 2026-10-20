// File: src/components/ReportView.jsx
//
// The page a share link opens: a read-only pool report anyone can view, no
// sign-in. Everything on it came from the link itself.

import HealthScoreRing from './HealthScoreRing.jsx';
import { decodeReport } from '../lib/reportLink.js';
import { formatReading, readingRows } from '../lib/plan.js';
import { formatDay, sourceLabel } from '../lib/recordExport.js';

export default function ReportView({ hash = typeof window !== 'undefined' ? window.location.hash : '' }) {
  const report = decodeReport(hash);

  if (!report) {
    return (
      <main className="report-page">
        <h1 className="page-title">This report link isn't complete</h1>
        <p className="page-subtitle">It may have been cut short when it was copied. Ask the pool owner to send it again.</p>
        <a className="btn btn-primary" href="https://yourpoolmate.com.au">About Your Pool Mate</a>
      </main>
    );
  }

  const latest = report.tests[0];
  const ctx = { sanitiser: report.pool.sanitiser, surface: report.pool.surface, saltRange: report.pool.saltRange };
  const rows = latest ? readingRows(latest.readings, ctx) : [];

  return (
    <main className="report-page">
      <p className="eyebrow">Pool water report</p>
      <h1 className="page-title">{report.pool.name}</h1>
      <p className="page-subtitle">
        {[report.pool.volumeL ? `${report.pool.volumeL.toLocaleString('en-AU')} L` : null, report.pool.sanitiser, report.pool.surface].filter(Boolean).join(' · ')}
      </p>
      <p className="plan-small">Shared by the owner on {formatDay(report.generatedAt)}. It shows the record as it was then.</p>

      {latest ? (
        <>
          <section className="card score-hero-card">
            <HealthScoreRing score={latest.score} />
            <p className="score-headline">Latest test {formatDay(latest.at)} · {sourceLabel(latest.source)}{latest.edited ? ' · corrected after saving' : ''}</p>
          </section>
          <section className="card-section">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Latest readings</div>
            <table className="data-table readings-table">
              <thead><tr><th>Reading</th><th>Result</th><th>Target</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.value != null).map((r) => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td><strong>{formatReading(r.value, r.unit)}</strong></td>
                    <td className="col-muted">{r.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <p className="callout callout-info"><span className="callout-body">No water tests in this report yet.</span></p>
      )}

      {report.tests.length > 1 && (
        <section className="card-section">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Recent tests</div>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Score</th><th>Chlorine</th><th>pH</th></tr></thead>
            <tbody>
              {report.tests.map((t) => (
                <tr key={t.at}>
                  <td>{formatDay(t.at)}{t.edited ? ' *' : ''}</td>
                  <td>{t.score ?? '—'}</td>
                  <td>{formatReading(t.readings.freeChlor ?? null, 'ppm')}</td>
                  <td>{formatReading(t.readings.pH ?? null, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.tests.some((t) => t.edited) && <p className="plan-small">* Corrected after it was first saved. The app keeps the first reading on the owner's record.</p>}
        </section>
      )}

      {report.doses.length > 0 && (
        <section className="card-section">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Chemicals added (last 90 days)</div>
          <ul className="report-doses">
            {report.doses.map((d) => <li key={`${d.at}-${d.title}`}><span>{formatDay(d.at)}</span> {d.title}</li>)}
          </ul>
        </section>
      )}

      <p className="plan-small report-foot">
        Readings were entered, spoken or scanned by the pool owner in Your Pool Mate. This is the owner's own record, not a laboratory report.
      </p>
      <a className="link-btn" href="https://yourpoolmate.com.au">Keep a record like this for your own pool</a>
    </main>
  );
}
