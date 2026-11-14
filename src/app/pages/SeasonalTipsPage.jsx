import { PoolIcon } from '../../components/PoolIcon.jsx';
import { SEASONAL_TIPS } from '../data/season.js';
import { Icon } from '../icons.jsx';

// ─────────────────────────────────────────────────────────────────
// SEASONAL TIPS PAGE
// ─────────────────────────────────────────────────────────────────
export function SeasonalTipsPage({ season }) {
  const data = SEASONAL_TIPS[season] || SEASONAL_TIPS.Autumn;
  return (
    <div>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--blue)', display: 'inline-flex' }}>
          <PoolIcon name={data.icon} size={26} />
        </span>
        {season} Tips
      </h1>
      <p className="page-subtitle">{data.intro}</p>

      <div className="card-section" style={{ marginBottom: 16 }}>
        {data.tips.map((tip, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 0',
              borderBottom: i < data.tips.length - 1 ? 'var(--border)' : 'none',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--water-pale)',
              color: 'var(--blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-read)', fontSize: 17, fontWeight: 500,
              flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--black)', marginBottom: 3 }}>
                {tip.title}
              </div>
              <div style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.55 }}>
                {tip.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="callout callout-info">
        <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
          {Icon.info}
        </span>
        <div className="callout-body">
          Tips update automatically each season — next season: <strong>
            {season === 'Autumn' ? 'Winter' : season === 'Winter' ? 'Spring' : season === 'Spring' ? 'Summer' : 'Autumn'}
          </strong> tips will appear in{' '}
          {season === 'Autumn' ? 'June' : season === 'Winter' ? 'September' : season === 'Spring' ? 'December' : 'March'}.
        </div>
      </div>
    </div>
  );
}
