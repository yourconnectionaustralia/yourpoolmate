// File: src/components/InsightCards.jsx
import { useState } from 'react'
import styles from './InsightCards.module.css'

// Target ranges for each parameter (Australian residential pool standards)
const TARGETS = {
  ph:            { min: 7.2, max: 7.6, unit: '',      label: 'pH' },
  free_chlorine: { min: 1.0, max: 3.0, unit: 'ppm',   label: 'Free Chlorine' },
  alkalinity:    { min: 80,  max: 120, unit: 'ppm',   label: 'Total Alkalinity' },
  cyanuric_acid: { min: 30,  max: 50,  unit: 'ppm',   label: 'Cyanuric Acid' },
  calcium:       { min: 200, max: 400, unit: 'ppm',   label: 'Calcium Hardness' },
}

function getStatus(value, min, max) {
  if (value === null || value === undefined) return 'unknown'
  if (value < min) return 'low'
  if (value > max) return 'high'
  return 'ok'
}

function getStatusConfig(status) {
  switch (status) {
    case 'ok':      return { label: 'Good', icon: '✓', color: '#2D9E6B', bg: '#EBFBEE', border: '#B2F2BB' }
    case 'low':     return { label: 'Low',  icon: '↓', color: '#E67700', bg: '#FFF9DB', border: '#FFE066' }
    case 'high':    return { label: 'High', icon: '↑', color: '#C92A2A', bg: '#FFF5F5', border: '#FFC9C9' }
    default:        return { label: '—',   icon: '?', color: '#868E96', bg: '#F8F9FA', border: '#E9ECEF' }
  }
}

function getDosingAdvice(param, status, value, min, max, unit) {
  if (status === 'ok') return `${param} is in the ideal range (${min}–${max}${unit ? ' ' + unit : ''}). Nothing to add.`
  if (status === 'low') {
    const advice = {
      ph:            'Add sodium carbonate (soda ash) to raise pH.',
      free_chlorine: 'Add chlorine to raise free chlorine levels.',
      alkalinity:    'Add sodium bicarbonate (bicarb soda) to raise alkalinity.',
      cyanuric_acid: 'Add cyanuric acid (stabiliser) to protect your chlorine.',
      calcium:       'Add calcium chloride to raise calcium hardness.',
    }
    return advice[param] || `${param} is low — needs attention.`
  }
  const advice = {
    ph:            'Add sodium bisulphate (dry acid) or muriatic acid to lower pH.',
    free_chlorine: 'Allow chlorine to reduce naturally. Check for high stabiliser levels.',
    alkalinity:    'Add sodium bisulphate (dry acid) to lower alkalinity.',
    cyanuric_acid: 'Partially drain and refill the pool to dilute stabiliser.',
    calcium:       'Partially drain and refill with softer water to reduce calcium.',
  }
  return advice[param] || `${param} is high — needs attention.`
}

function InsightCard({ paramKey, value }) {
  const [expanded, setExpanded] = useState(false)
  const target = TARGETS[paramKey]
  const status = getStatus(value, target.min, target.max)
  const config = getStatusConfig(status)

  return (
    <div
      className={styles.card}
      style={{ '--card-bg': config.bg, '--card-border': config.border }}
    >
      <button
        className={styles.cardHeader}
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls={`insight-${paramKey}`}
      >
        <div className={styles.cardLeft}>
          <span className={styles.statusIcon} style={{ color: config.color }} aria-hidden="true">
            {config.icon}
          </span>
          <div>
            <span className={styles.paramLabel}>{target.label}</span>
            <span className={styles.paramValue}>
              {value !== null && value !== undefined
                ? `${value}${target.unit ? ' ' + target.unit : ''}`
                : '—'
              }
            </span>
          </div>
        </div>
        <div className={styles.cardRight}>
          <span className={styles.statusBadge} style={{ color: config.color }}>
            {config.label}
          </span>
          <span className={styles.chevron} aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className={styles.cardBody} id={`insight-${paramKey}`}>
          <p className={styles.range}>
            Target range: {target.min}–{target.max}{target.unit ? ' ' + target.unit : ''}
          </p>
          <p className={styles.advice}>
            {getDosingAdvice(paramKey, status, value, target.min, target.max, target.unit)}
          </p>
        </div>
      )}
    </div>
  )
}

export default function InsightCards({ test }) {
  const params = ['ph', 'free_chlorine', 'alkalinity', 'cyanuric_acid', 'calcium']

  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Your readings</h2>
      <div className={styles.cards}>
        {params.map(key => (
          <InsightCard key={key} paramKey={key} value={test?.[key]} />
        ))}
      </div>
      {test?.tested_at && (
        <p className={styles.timestamp}>
          Tested {new Date(test.tested_at).toLocaleDateString('en-AU', {
            day: 'numeric', month: 'long', year: 'numeric'
          })} · Saved to your warranty record ✓
        </p>
      )}
    </div>
  )
}
