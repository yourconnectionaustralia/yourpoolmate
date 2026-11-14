import { Icon } from './icons.jsx';

// ─────────────────────────────────────────────────────────────────
// HEALTH SCORE RING COMPONENT
// ─────────────────────────────────────────────────────────────────
export function HealthScoreRing({ score, size = 88 }) {
  const circumference = 220;
  const dashoffset = circumference - (score / 100) * circumference;
  const ringClass =
    score >= 80 ? 'score-ring-fill score-good'
    : score >= 60 ? 'score-ring-fill score-warn'
    : 'score-ring-fill score-critical';

  return (
    <div className="score-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 88 88">
        <circle className="score-ring-track" cx="44" cy="44" r="35" />
        <circle
          className={ringClass}
          cx="44" cy="44" r="35"
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      <div className="score-ring-label">
        {/* Scale the number by digit count so "100" sits inside the ring
            instead of running into the stroke (inner diameter ≈ 0.7 × size). */}
        <span className="score-number score-number-lg" style={{ fontSize: Math.round(size * (String(score).length >= 3 ? 0.32 : 0.4)) }}>{score}</span>
        <span className="score-of" style={{ fontSize: Math.max(10, Math.round(size * 0.08)), marginTop: Math.round(size * 0.02) }}>/ 100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LOGO MARK
// ─────────────────────────────────────────────────────────────────
export function LogoMark() {
  return (
    <div className="topnav-logo-mark">
      {Icon.logoBig}
    </div>
  );
}
