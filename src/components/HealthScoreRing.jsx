// File: src/components/HealthScoreRing.jsx
import styles from './HealthScoreRing.module.css'

const SIZE = 200
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getStatus(score) {
  if (score === null || score === undefined) return { label: '—', color: '#CED4DA', bg: '#F8F9FA' }
  if (score >= 80) return { label: 'Great', color: '#2D9E6B', bg: '#EBFBEE' }
  if (score >= 60) return { label: 'Needs attention', color: '#E67700', bg: '#FFF9DB' }
  return { label: 'Act now', color: '#C92A2A', bg: '#FFF5F5' }
}

export default function HealthScoreRing({ score }) {
  const { label, color, bg } = getStatus(score)
  const pct = score !== null && score !== undefined ? score / 100 : 0
  const dash = pct * CIRCUMFERENCE

  return (
    <div className={styles.wrap}>
      <div className={styles.ring} style={{ '--ring-bg': bg }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-label={`Pool Health Score: ${score ?? 'not yet logged'} out of 100. Status: ${label}`}
          role="img"
        >
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#E9ECEF"
            strokeWidth={STROKE}
          />
          {/* Progress */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          />
        </svg>

        {/* Score number */}
        <div className={styles.scoreCenter} aria-hidden="true">
          <span className={styles.scoreNumber} style={{ color }}>
            {score !== null && score !== undefined ? score : '?'}
          </span>
          <span className={styles.scoreOf}>/100</span>
          <span className={styles.scoreLabel} style={{ color }}>
            {label}
          </span>
        </div>
      </div>

      <p className={styles.caption}>Pool Health Score</p>
    </div>
  )
}
