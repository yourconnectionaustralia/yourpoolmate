// File: src/components/Skeleton.jsx
//
// Building blocks for "skeleton screens": grey shapes that hold the place of
// content while it loads, so the page keeps its layout instead of showing a
// spinner and then jumping.
//
// These are decorative, so they are hidden from screen readers. Whatever
// screen uses them is responsible for ONE visually-hidden status line
// (see AppSkeleton) so a screen-reader user hears "loading" once.
import styles from './Skeleton.module.css'

// Numbers are pixels; strings pass straight through ('60%', 'var(--space-4)').
const px = (v) => (typeof v === 'number' ? `${v}px` : v)

export function Skeleton({ width, height, radius, circle = false, ring = false, stroke, className = '' }) {
  const vars = {}
  if (width !== undefined) vars['--sk-w'] = px(width)
  if (height !== undefined) vars['--sk-h'] = px(height)
  if (radius !== undefined) vars['--sk-r'] = px(radius)
  if (stroke !== undefined) vars['--sk-stroke'] = px(stroke)

  const classes = [styles.block, (circle || ring) && styles.circle, ring && styles.ring, className]
    .filter(Boolean)
    .join(' ')

  return <span className={classes} style={vars} aria-hidden="true" />
}

// A paragraph's worth of lines; the last one is shorter, like real text.
export function SkeletonText({ lines = 3, lineHeight = 14, lastLineWidth = '60%' }) {
  return (
    <span className={styles.text} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'} />
      ))}
    </span>
  )
}

export default Skeleton
