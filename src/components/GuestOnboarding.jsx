// File: src/components/GuestOnboarding.jsx
// Six-step pool setup modal.
// Auto-triggered for any authenticated user with no pool profile.
// This wires the highest-priority conversion gap before launch.

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './GuestOnboarding.module.css'

const STEPS = [
  { id: 'welcome',     title: 'Welcome to Your Pool Mate',   skippable: false },
  { id: 'pool_basics', title: 'Tell me about your pool',     skippable: false },
  { id: 'sanitiser',   title: 'How do you sanitise?',        skippable: false },
  { id: 'equipment',   title: 'Your pool equipment',         skippable: true  },
  { id: 'first_test',  title: 'Log your first water test',   skippable: true  },
  { id: 'complete',    title: "You're all set",               skippable: false },
]

const POOL_SHAPES = [
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'round',       label: 'Round / Oval' },
  { value: 'freeform',    label: 'Freeform' },
  { value: 'lap',         label: 'Lap pool' },
]

const SANITISER_TYPES = [
  { value: 'chlorine_tabs',    label: 'Chlorine tablets' },
  { value: 'liquid_chlorine',  label: 'Liquid chlorine' },
  { value: 'saltwater',        label: 'Saltwater / Chlorinator' },
  { value: 'mineral',          label: 'Mineral / Magnesium' },
]

const FILTER_TYPES = [
  { value: 'sand',       label: 'Sand filter' },
  { value: 'cartridge',  label: 'Cartridge filter' },
  { value: 'glass',      label: 'Glass media' },
  { value: 'DE',         label: 'Diatomaceous earth (DE)' },
]

export default function GuestOnboarding({ onComplete }) {
  const { user, setHasPoolProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    pool_shape: '',
    volume_litres: '',
    sanitiser_type: '',
    filter_type: '',
    has_heater: false,
    has_spa: false,
    // Water test readings (step 5)
    ph: '',
    free_chlorine: '',
    alkalinity: '',
    cyanuric_acid: '',
    calcium: '',
  })

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function nextStep() { setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  function prevStep() { setStep(s => Math.max(s - 1, 0)) }

  async function saveAndComplete() {
    setSaving(true)
    try {
      // Save pool profile
      const { error: poolError } = await supabase
        .from('pool_profiles')
        .upsert({
          user_id: user.id,
          pool_shape: form.pool_shape || null,
          volume_litres: form.volume_litres ? parseInt(form.volume_litres) : null,
          sanitiser_type: form.sanitiser_type || null,
          filter_type: form.filter_type || null,
          has_heater: form.has_heater,
          has_spa: form.has_spa,
        }, { onConflict: 'user_id' })

      if (poolError) throw poolError

      // Save first water test if any readings provided
      const hasReadings = form.ph || form.free_chlorine || form.alkalinity
      if (hasReadings) {
        const readings = {
          user_id: user.id,
          ph: form.ph ? parseFloat(form.ph) : null,
          free_chlorine: form.free_chlorine ? parseFloat(form.free_chlorine) : null,
          alkalinity: form.alkalinity ? parseFloat(form.alkalinity) : null,
          cyanuric_acid: form.cyanuric_acid ? parseFloat(form.cyanuric_acid) : null,
          calcium: form.calcium ? parseFloat(form.calcium) : null,
          source: 'manual',
        }

        // Calculate health score
        try {
          const { data: scoreData } = await supabase.functions.invoke('calculate-health-score', {
            body: readings
          })
          if (scoreData?.health_score !== undefined) {
            readings.health_score = scoreData.health_score
          }
        } catch {
          // Score calculation failure is non-fatal
        }

        await supabase.from('water_tests').insert(readings)
      }

      setHasPoolProfile(true)
      nextStep() // → completion step
    } catch (err) {
      console.error('Onboarding save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const current = STEPS[step]

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={current.title}>
      <div className={styles.sheet}>
        {/* Progress dots */}
        <div className={styles.progress} aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`${styles.dot} ${i < step ? styles.dotDone : ''} ${i === step ? styles.dotActive : ''}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className={styles.content}>
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepPoolBasics form={form} set={set} />}
          {step === 2 && <StepSanitiser form={form} set={set} />}
          {step === 3 && <StepEquipment form={form} set={set} />}
          {step === 4 && <StepFirstTest form={form} set={set} />}
          {step === 5 && <StepComplete />}
        </div>

        {/* Navigation */}
        <div className={styles.nav}>
          {step > 0 && step < STEPS.length - 1 && (
            <button className={styles.backBtn} onClick={prevStep}>Back</button>
          )}

          <div className={styles.navRight}>
            {current.skippable && step < STEPS.length - 2 && (
              <button className={styles.skipBtn} onClick={nextStep}>Skip</button>
            )}

            {step < STEPS.length - 2 && step !== 3 && step !== 4 && (
              <button className={styles.nextBtn} onClick={nextStep}>
                Continue
              </button>
            )}

            {/* Equipment step — has Continue */}
            {step === 3 && (
              <button className={styles.nextBtn} onClick={nextStep}>
                Continue
              </button>
            )}

            {/* First test step — save */}
            {step === 4 && (
              <button
                className={styles.nextBtn}
                onClick={saveAndComplete}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save and see my score'}
              </button>
            )}

            {/* Complete step */}
            {step === STEPS.length - 1 && (
              <button className={styles.nextBtn} onClick={onComplete}>
                Let's go
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step components ─────────────────────────────────────────

function StepWelcome() {
  return (
    <div className={styles.stepWrap}>
      <div className={styles.stepIcon} aria-hidden="true">💧</div>
      <h2 className={styles.stepHeading}>Welcome to Your Pool Mate</h2>
      <p className={styles.stepBody}>
        Let's get your pool set up. It takes about 2 minutes, and you'll see your
        pool's Health Score as soon as you're done.
      </p>
      <div className={styles.featureList}>
        <div className={styles.feature}>
          <span aria-hidden="true">🎯</span>
          Know exactly what chemicals to add — no guessing
        </div>
        <div className={styles.feature}>
          <span aria-hidden="true">📋</span>
          Every test is saved to protect your pool warranty
        </div>
        <div className={styles.feature}>
          <span aria-hidden="true">📸</span>
          Scan your pool shop test in seconds
        </div>
      </div>
    </div>
  )
}

function StepPoolBasics({ form, set }) {
  return (
    <div className={styles.stepWrap}>
      <h2 className={styles.stepHeading}>Tell me about your pool</h2>
      <p className={styles.stepBody}>This helps calculate how much chemical to add.</p>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Pool shape</label>
        <div className={styles.optionGrid}>
          {POOL_SHAPES.map(s => (
            <button
              key={s.value}
              className={`${styles.optionBtn} ${form.pool_shape === s.value ? styles.optionBtnActive : ''}`}
              onClick={() => set('pool_shape', s.value)}
              type="button"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="volume">Pool volume (litres)</label>
        <p className={styles.fieldHint}>A typical Australian backyard pool is 40,000–50,000L.</p>
        <input
          id="volume"
          className={styles.input}
          type="number"
          inputMode="numeric"
          placeholder="e.g. 45000"
          value={form.volume_litres}
          onChange={e => set('volume_litres', e.target.value)}
          onBlur={e => {
            const n = parseFloat(e.target.value)
            if (n > 0) set('volume_litres', String(Math.round(n / 2500) * 2500))
          }}
        />

        <details className={styles.calcGuide}>
          <summary className={styles.calcSummary}>Not sure? Work it out in 10 seconds</summary>
          <div className={styles.calcBody}>
            <p>Measure your pool in metres, then multiply:</p>
            <ul className={styles.calcList}>
              <li><strong>Rectangular:</strong> length × width × average depth × 1,000</li>
              <li><strong>Round / oval:</strong> diameter × diameter × average depth × 800</li>
            </ul>
            <p className={styles.calcHint}>Average depth = (shallow end + deep end) ÷ 2.</p>
            <p className={styles.calcEg}>Example: 8m × 4m × 1.5m = 48 → about <strong>48,000L</strong>.</p>
            <p className={styles.calcHint}>Round to the nearest 2,500L — exact precision isn't needed for accurate dosing.</p>
          </div>
        </details>
      </div>
    </div>
  )
}

function StepSanitiser({ form, set }) {
  return (
    <div className={styles.stepWrap}>
      <h2 className={styles.stepHeading}>How do you sanitise?</h2>
      <p className={styles.stepBody}>Your sanitiser type changes the dosing recommendations.</p>

      <div className={styles.optionStack}>
        {SANITISER_TYPES.map(s => (
          <button
            key={s.value}
            className={`${styles.optionRow} ${form.sanitiser_type === s.value ? styles.optionRowActive : ''}`}
            onClick={() => set('sanitiser_type', s.value)}
            type="button"
          >
            {s.label}
            {form.sanitiser_type === s.value && <span aria-hidden="true"> ✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function StepEquipment({ form, set }) {
  return (
    <div className={styles.stepWrap}>
      <h2 className={styles.stepHeading}>Your pool equipment</h2>
      <p className={styles.stepBody}>Optional — skip if you're not sure.</p>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Filter type</label>
        <div className={styles.optionGrid}>
          {FILTER_TYPES.map(f => (
            <button
              key={f.value}
              className={`${styles.optionBtn} ${form.filter_type === f.value ? styles.optionBtnActive : ''}`}
              onClick={() => set('filter_type', f.value)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.toggleGroup}>
        <ToggleField
          label="I have a pool heater"
          value={form.has_heater}
          onChange={v => set('has_heater', v)}
        />
        <ToggleField
          label="I have a spa / hot tub"
          value={form.has_spa}
          onChange={v => set('has_spa', v)}
        />
      </div>
    </div>
  )
}

function StepFirstTest({ form, set }) {
  const fields = [
    { key: 'ph',            label: 'pH',               unit: '',    placeholder: 'e.g. 7.4' },
    { key: 'free_chlorine', label: 'Free Chlorine',    unit: 'ppm', placeholder: 'e.g. 2.0' },
    { key: 'alkalinity',    label: 'Total Alkalinity', unit: 'ppm', placeholder: 'e.g. 100' },
    { key: 'cyanuric_acid', label: 'Cyanuric Acid',    unit: 'ppm', placeholder: 'e.g. 40' },
    { key: 'calcium',       label: 'Calcium Hardness', unit: 'ppm', placeholder: 'e.g. 250' },
  ]

  return (
    <div className={styles.stepWrap}>
      <h2 className={styles.stepHeading}>Log your first water test</h2>
      <p className={styles.stepBody}>
        Have a recent pool shop printout? Enter the readings below.
        You can skip this and add them later.
      </p>

      <div className={styles.readingsGrid}>
        {fields.map(f => (
          <div key={f.key} className={styles.readingField}>
            <label className={styles.readingLabel} htmlFor={`reading-${f.key}`}>
              {f.label}{f.unit && <span className={styles.readingUnit}> ({f.unit})</span>}
            </label>
            <input
              id={`reading-${f.key}`}
              className={styles.input}
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function StepComplete() {
  return (
    <div className={styles.stepWrap}>
      <div className={styles.stepIcon} aria-hidden="true">🎉</div>
      <h2 className={styles.stepHeading}>You're all set</h2>
      <p className={styles.stepBody}>
        Your pool's Health Score is ready. Every test from now on is automatically
        saved to your warranty record.
      </p>
      <div className={styles.featureList}>
        <div className={styles.feature}>
          <span aria-hidden="true">✓</span>
          Pool profile saved
        </div>
        <div className={styles.feature}>
          <span aria-hidden="true">✓</span>
          Warranty record started
        </div>
        <div className={styles.feature}>
          <span aria-hidden="true">✓</span>
          Health Score ready
        </div>
      </div>
    </div>
  )
}

function ToggleField({ label, value, onChange }) {
  return (
    <button
      className={`${styles.toggleBtn} ${value ? styles.toggleBtnOn : ''}`}
      onClick={() => onChange(!value)}
      type="button"
      role="switch"
      aria-checked={value}
    >
      <span className={styles.toggleLabel}>{label}</span>
      <span className={styles.togglePill} aria-hidden="true">
        <span className={styles.toggleThumb} />
      </span>
    </button>
  )
}
