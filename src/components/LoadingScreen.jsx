// File: src/components/LoadingScreen.jsx
//
// The brief splash while the app checks whether someone is signed in. At this
// point we don't yet know if they're a member or a visitor, so there's no
// layout to draw; once we know, a signed-in member gets AppSkeleton instead.
// No spinner: the logo's gentle pulse says "working".
import styles from './LoadingScreen.module.css'

export default function LoadingScreen() {
  return (
    <div className={styles.wrap} aria-busy="true">
      <div className={styles.logo} aria-hidden="true">
        {/* Waterline Ring logo — Crystal Clear water gradient */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="waterline-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0B7799" />
              <stop offset="100%" stopColor="#085E78" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="17" fill="none" stroke="url(#waterline-grad)" strokeWidth="3.2" />
          <path d="M7.3 27 Q 15.65 23 24 27 T 40.7 27 A 17 17 0 0 1 7.3 27 Z" fill="url(#waterline-grad)" />
        </svg>
      </div>
      <p className={styles.label}>Your Pool Mate</p>
      <p className="visually-hidden" role="status">Loading…</p>
    </div>
  )
}
