// File: src/components/AppTour.jsx
//
// Post-onboarding walkthrough.
//
// Runs straight after GuestOnboarding completes: five popups anchored to the
// real navigation, each one switching the app to that view so the user is
// looking at the actual page while it is described. Every popup carries a
// "Next" button, a progress row and an always-available × — the tour is never
// a trap (same rule as the onboarding sheet).
//
// The last stop is Equipment, and it ends with "Add my equipment", which opens
// the add form rather than just closing the tour.
//
// Anchoring: nav items carry data-tour="<name>". Both the desktop sidebar and
// the mobile bottom nav use the same names, so the first *visible* match wins.
// Setup and Equipment live behind "More" on mobile, so those steps fall back to
// the More button and use the copy in `bodyByAnchor`.

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import styles from './AppTour.module.css'

export const TOUR_STEPS = [
  {
    id: 'health',
    view: 'health',
    anchors: ['health'],
    title: 'Your Health Score',
    body: "One number, 0–100, for how your water is tracking. Open this first — if it's green, there's nothing to do today.",
  },
  {
    id: 'tests',
    view: 'tests',
    anchors: ['tests'],
    title: 'Test your water',
    body: 'Tap Enter Test Results to type your readings in, or photograph a pool shop printout and let the scanner read it. You get exact doses for your pool volume — no guessing.',
  },
  {
    id: 'history',
    view: 'history',
    anchors: ['history'],
    title: 'Chemistry log',
    body: 'Every test and treatment, kept on a timeline. This is the record that backs up a warranty claim, so it is worth keeping current.',
  },
  {
    id: 'setup',
    view: 'setup',
    anchors: ['setup', 'more'],
    title: 'Pool setup',
    body: 'Your pool volume, shape and sanitiser live here. Change them any time — dosing recalculates straight away.',
    bodyByAnchor: {
      more: 'Under More you will find Pool setup — your volume, shape and sanitiser. Change them any time and dosing recalculates straight away.',
    },
  },
  {
    id: 'equipment',
    view: 'equipment',
    anchors: ['equipment', 'more'],
    title: 'Last one — your equipment',
    body: 'Add your pump, filter, chlorinator and heater. It takes a minute and it sharpens your maintenance reminders, service intervals and salt targets.',
    bodyByAnchor: {
      more: 'Equipment sits under More. Add your pump, filter, chlorinator and heater — it sharpens your maintenance reminders, service intervals and salt targets.',
    },
    cta: 'Add my equipment',
  },
]

const PAD = 8   // breathing room around the highlighted item
const GAP = 14  // popup ↔ spotlight

function findVisibleAnchor(names) {
  for (const name of names) {
    const els = document.querySelectorAll(`[data-tour="${name}"]`)
    for (const el of els) {
      const r = el.getBoundingClientRect()
      // offsetParent is null for display:none — belt and braces with the rect.
      if (r.width > 0 && r.height > 0) return { el, name }
    }
  }
  return null
}

export function AppTour({ steps = TOUR_STEPS, onNavigate, onFinish, onDismiss }) {
  const [index, setIndex] = useState(0)
  const [spot, setSpot] = useState(null)
  const [pos, setPos] = useState(null)
  const [placement, setPlacement] = useState('right')
  const [caret, setCaret] = useState(0)
  const [anchorName, setAnchorName] = useState(null)
  const popupRef = useRef(null)

  const step = steps[index]
  const isLast = index === steps.length - 1

  // Show the page this step is about.
  useEffect(() => {
    if (step?.view) onNavigate?.(step.view)
  }, [step?.view, onNavigate])

  const reposition = useCallback(() => {
    if (!step) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pop = popupRef.current
    const pw = pop?.offsetWidth || 320
    const ph = pop?.offsetHeight || 190

    const found = findVisibleAnchor(step.anchors)
    setAnchorName(found?.name ?? null)

    if (!found) {
      // No nav on screen — centre the popup over a plain scrim.
      setSpot(null)
      setPlacement('none')
      setPos({ top: Math.max(16, (vh - ph) / 2), left: Math.max(16, (vw - pw) / 2) })
      return
    }

    const r = found.el.getBoundingClientRect()
    const s = {
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    }
    setSpot(s)

    let place, top, left
    if (s.left + s.width + GAP + pw <= vw - 12) {
      place = 'right'
      left = s.left + s.width + GAP
      top = s.top + s.height / 2 - ph / 2
    } else if (s.top - GAP - ph >= 12) {
      place = 'top'
      top = s.top - GAP - ph
      left = s.left + s.width / 2 - pw / 2
    } else {
      place = 'bottom'
      top = s.top + s.height + GAP
      left = s.left + s.width / 2 - pw / 2
    }

    top = Math.min(Math.max(12, top), Math.max(12, vh - ph - 12))
    left = Math.min(Math.max(12, left), Math.max(12, vw - pw - 12))

    setPlacement(place)
    setPos({ top, left })

    // Keep the caret pointing at the item even after the popup is clamped.
    const centreY = s.top + s.height / 2
    const centreX = s.left + s.width / 2
    const offset = place === 'right' ? centreY - top : centreX - left
    const limit = place === 'right' ? ph : pw
    setCaret(Math.min(Math.max(14, offset - 6), Math.max(14, limit - 26)))
  }, [step])

  // Re-measure after the new view has painted (the nav's active state and the
  // mobile drawer both change layout).
  useLayoutEffect(() => {
    setPos(null)
    let raf2
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(reposition) })
    const t = setTimeout(reposition, 120)
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(t) }
  }, [reposition])

  useEffect(() => {
    const onChange = () => reposition()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    window.visualViewport?.addEventListener('resize', onChange)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
      window.visualViewport?.removeEventListener('resize', onChange)
    }
  }, [reposition])

  const close = useCallback(() => { onDismiss?.() }, [onDismiss])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  if (!step) return null

  const advance = () => {
    if (isLast) onFinish?.()
    else setIndex(i => i + 1)
  }

  const body = (anchorName && step.bodyByAnchor?.[anchorName]) || step.body

  return (
    <>
      {spot ? (
        <div
          className={styles.spotlight}
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
          onClick={e => e.stopPropagation()}
          aria-hidden="true"
        />
      ) : (
        <div className={styles.scrim} aria-hidden="true" />
      )}

      <div
        ref={popupRef}
        className={`${styles.popup} ${pos ? '' : styles.measuring}`}
        style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
        role="dialog"
        aria-modal="false"
        aria-label={step.title}
      >
        {placement === 'right' && <span className={styles.caret + ' ' + styles.caretRight} style={{ top: caret }} />}
        {placement === 'top' && <span className={styles.caret + ' ' + styles.caretTop} style={{ left: caret }} />}
        {placement === 'bottom' && <span className={styles.caret + ' ' + styles.caretBottom} style={{ left: caret }} />}

        <div className={styles.head}>
          <span className={styles.step}>Step {index + 1} of {steps.length}</span>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label="Close the walkthrough"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.body}>{body}</p>

        <div className={styles.foot}>
          <div className={styles.dots} aria-hidden="true">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`${styles.dot} ${i < index ? styles.dotDone : ''} ${i === index ? styles.dotActive : ''}`}
              />
            ))}
          </div>
          {!isLast && (
            <button type="button" className={styles.skip} onClick={close}>
              Skip
            </button>
          )}
          <button type="button" className={styles.next} onClick={advance}>
            {isLast ? (step.cta || 'Done') : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}

export default AppTour
