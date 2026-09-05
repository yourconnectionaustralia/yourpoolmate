// File: src/components/GuestOnboarding.jsx
// Six-step pool setup modal.
// Auto-triggered for any authenticated user with no pool profile.
//
// iPhone dismissal fixes (Jul 2026):
//  - Always-present close (×) button — the modal was previously inescapable.
//  - Backdrop tap + Escape key dismiss.
//  - Skip now renders on the "first test" step (an off-by-one guard
//    silently excluded it, making that step a hard wall).
//  - Save failures surface an error banner with Retry / "Set up later"
//    instead of being swallowed to console, which trapped the user.
//  - hasPoolProfile is only flipped on the final "Let's go" tap, so the
//    completion step is actually reachable (App unmounts on that flag).
//  - visualViewport sizing keeps the nav row above the iOS keyboard and
//    Safari's bottom toolbar.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './GuestOnboarding.module.css'

const STEPS = [
  { id: 'welcome',     title: 'Welcome to Your Pool Mate',   skippable: false },
  { id: 'pool_basics', title: 'Tell me about your pool',     skippable: false },
  { id: 'sanitiser',   title: 'How do you sanitise?',        skippable: false },
  { id: 'equipment',   title: 'Your pool equipment',         skippable: true  },
  { id: 'first_test',  title: 'Log your first water test',   skippable: true  },
  { id: 'complete',    title: "You're all set",              skippable: false },
]

const LAST_STEP = STEPS.length - 1   // 5 — completion
const TEST_STEP = STEPS.length - 2   // 4 — first water test

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

export function GuestOnboarding({ onComplete, onDismiss }) {
  const { user, setHasPoolProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    pool_shape: '',
    volume_litres: '',
    sanitiser_type: '',
    filter_type: '',
    has_heater: false,
    has_spa: false,
    // Water test readings (step 4)
    ph: '',
    free_chlorine: '',
    alkalinity: '',
    cyanuric_acid: '',
    calcium: '',
  })

  // ── Dismissal ────────────────────────────────────────────
  // A modal with no exit is worse than a skipped onboarding. Dismiss is
  // always available; App re-shows it on the next launch while the user
  // still has no pool profile.
  const dismiss = useCallback(() => {
    if (saving) return
    onDismiss?.()
  }, [saving, onDismiss])

  // Escape key (external keyboards on iPad/iPhone, and desktop).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') { e.stopPropagation(); dismiss() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  // Lock the page behind the sheet so iOS doesn't scroll-chain the body
  // (which reads as "the popup is frozen").
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // iOS: track the *visual* viewport so the nav row (Continue / Close) is
  // never hidden under the keyboard or Safari's bottom toolbar.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const sync = () => {
      root.style.setProperty('--ypm-vvh', `${Math.round(vv.height)}px`)
      root.style.setProperty('--ypm-vvtop', `${Math.round(vv.offsetTop)}px`)
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      root.style.removeProperty('--ypm-vvh')
      root.style.removeProperty('--ypm-vvtop')
    }
  }, [])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function nextStep() { setStep(s => Math.min(s + 1, LAST_STEP)) }
  function prevStep() { setStep(s => Math.max(s - 1, 0)) }

  async function saveAndComplete() {
    setSaving(true)
    setError(null)
    try {
      const { error: poolError } = await supabase
        .from('pool_profiles')
        .upsert({
          user_id: user.id,
          pool_shape: form.pool_shape || null,
          volume_litres: form.volume_litres ? parseInt(form.volume_litres, 10) : null,
          sanitiser_type: form.sanitiser_type || null,
          filter_type: form.filter_type || null,
          has_heater: form.has_heater,
          has_spa: form.has_spa,
        }, { onConflict: 'user_id' })

      if (poolError) throw poolError

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

        // Health score — sanitiser_type activates the saltwater weights
        // server-side; it is only sent to the scorer, never stored on the
        // water_tests row.
        try {
          const { data: scoreData } = await supabase.functions.invoke('calculate-health-score', {
            body: { ...readings, sanitiser_type: form.sanitiser_type || null }
          })
          if (scoreData?.health_score !== undefined) {
            readings.health_score = scoreData.health_score
          }
        } catch {
          // Score calculation failure is non-fatal — the profile still saved.
        }

        const { error: testError } = await supabase.from('water_tests').insert(readings)
        if (testError) throw testError
      }

      // NOTE: do NOT call setHasPoolProfile(true) here. App renders this
      // modal on `hasPoolProfile === false`, so flipping it now would
      // unmount the sheet and the completion step would never be seen.
      setStep(LAST_STEP)
    } catch (err) {
      console.error('Onboarding save error:', err)
      setError(
        err?.message
          ? `Couldn't save your pool: ${err.message}`
          : "Couldn't save your pool. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  function finish() {
    setHasPoolProfile(true)
    onComplete?.()
  }

  const current = STEPS[step]
  const isCompleteStep = step === LAST_STEP

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div className={styles.sheet}>
        {/* Header — progress dots plus an always-available close */}
        <div className={styles.header}>
          <div className={styles.progress} aria-hidden="true">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`${styles.dot} ${i < step ? styles.dotDone : ''} ${i === step ? styles.dotActive : ''}`}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={isCompleteStep ? finish : dismiss}
            disabled={saving}
            aria-label={isCompleteStep ? 'Close' : 'Close setup — you can finish this later'}
          >
            <span aria-hidden="true">×</span>
          </button>
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

        {/* Save error — never a dead end */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <p className={styles.errorText}>{error}</p>
            <div className={styles.errorActions}>
              <button type="button" className={styles.errorRetry} onClick={saveAndComplete} disabled={saving}>
                Try again
              </button>
              <button type="button" className={styles.errorLater} onClick={dismiss} disabled={saving}>
                Set up later
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className={styles.nav}>
          {step > 0 && step < LAST_STEP && (
            <button type="button" className={styles.backBtn} onClick={prevStep} disabled={saving}>
              Back
            </button>
          )}
          {step === 0 && (
            <button type="button" className={styles.skipBtn} onClick={dismiss}>
              Set up later
            </button>
          )}

          <div className={styles.navRight}>
            {/* Skip — now correctly available on the equipment AND first-test
                steps. The old `step < STEPS.length - 2` guard excluded the
                first-test step, leaving it with no way forward on failure. */}
            {current.skippable && (
              <button
                type="button"
                className={styles.skipBtn}
                onClick={step === TEST_STEP ? saveAndComplete : nextStep}
                disabled={saving}
              >
                Skip
              </button>
            )}

            {step < TEST_STEP && (
              <button type="button" className={styles.nextBtn} onClick={nextStep}>
                Continue
              </button>
            )}

            {step === TEST_STEP && (
              <button
                type="button"
                className={styles.nextBtn}
                onClick={saveAndComplete}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save and see my score'}
              </button>
            )}

            {step === LAST_STEP && (
              <button type="button" className={styles.nextBtn} onClick={finish}>
                Let's go
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GuestOnboarding

// ── Step components ─────────────────────────────────────────

// Brand mark — the Your Pool Mate app icon (public/logo.svg), inlined so it
// renders at any size without a network round-trip.
function BrandMark({ size = 64 }) {
  return (
    <svg
      className={styles.brandMark}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Your Pool Mate"
    >
      <defs>
        <linearGradient id="ypmOnboardWater" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B7799" />
          <stop offset="100%" stopColor="#085E78" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#ypmOnboardWater)" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M20.6 56 Q 35.3 50 50 56 T 79.4 56 A 30 30 0 0 1 20.6 56 Z" fill="#FFFFFF" />
    </svg>
  )
}

// Tick used on the feature lists. Replaces the emoji bullets — emoji render
// inconsistently across Android/iOS and read as clip-art next to Albert Sans.
function TickIcon() {
  return (
    <span className={styles.featureTick} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="3"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  )
}

function StepWelcome() {
  return (
    <div className={styles.stepWrap}>
      <div className={styles.stepIcon} aria-hidden="true">
        <BrandMark size={64} />
      </div>
      <h2 className={styles.stepHeading}>Welcome to Your Pool Mate</h2>
      <p className={styles.stepBody}>
        Let's get your pool set up. It takes about 2 minutes, and you'll see your
        pool's Health Score as soon as you're done.
      </p>
      <div className={styles.featureList}>
        <div className={styles.feature}>
          <TickIcon />
          Know exactly what chemicals to add — no guessing
        </div>
        <div className={styles.feature}>
          <TickIcon />
          Every test is saved to protect your pool warranty
        </div>
        <div className={styles.feature}>
          <TickIcon />
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
            {form.sanitiser_type === s.value && <TickIcon />}
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
      <div className={styles.stepIcon} aria-hidden="true">
        <BrandMark size={56} />
      </div>
      <h2 className={styles.stepHeading}>You're all set</h2>
      <p className={styles.stepBody}>
        Your pool's Health Score is ready. Next we'll show you around — it takes
        about 30 seconds.
      </p>
      <div className={styles.featureList}>
        <div className={styles.feature}>
          <TickIcon />
          Pool profile saved
        </div>
        <div className={styles.feature}>
          <TickIcon />
          Warranty record started
        </div>
        <div className={styles.feature}>
          <TickIcon />
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
