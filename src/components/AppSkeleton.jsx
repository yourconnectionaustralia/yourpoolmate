// File: src/components/AppSkeleton.jsx
//
// What a signed-in member sees while their pool data loads: the app's own
// layout (top bar, side menu, Health Score card, bottom bar) drawn in grey,
// then replaced in place by the real thing. Replaces the old full-screen
// spinner for this stage.
//
// It reuses the real shell classes from index.css so every measurement
// matches the live screen. The wordmark is real text (it never changes);
// everything that depends on the member's data is a grey shape.
import { Skeleton } from './Skeleton.jsx'
import styles from './AppSkeleton.module.css'

const SIDE_SECTIONS = [5, 4] // menu items per section

export function AppSkeleton() {
  return (
    <div className="app-shell" aria-busy="true">
      {/* One announcement for screen readers; every grey shape below is hidden from them. */}
      <p className="visually-hidden" role="status">Loading your pool…</p>

      <nav className="topnav" aria-hidden="true">
        <div className={styles.brand}>
          <div className="topnav-logo-mark">
            {/* Waterline Ring mark, same artwork as the live top bar */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8.4" fill="none" stroke="white" strokeWidth="2.1" />
              <path d="M3.68 13.5 Q 7.8 11.55 12 13.5 T 20.33 13.5 A 8.4 8.4 0 0 1 3.68 13.5 Z" fill="white" />
            </svg>
          </div>
          <span className="topnav-wordmark">Your Pool Mate</span>
        </div>
        <div className="topnav-spacer" />
        <div className="topnav-actions">
          <Skeleton width={56} height={36} />
          <Skeleton width={112} height={40} />
        </div>
      </nav>

      <div className="app-body">
        <aside className="sidebar" aria-hidden="true">
          {SIDE_SECTIONS.map((count, s) => (
            <div className="sidebar-section" key={s}>
              <div className={styles.sideLabel}><Skeleton width={56} height={10} /></div>
              {Array.from({ length: count }, (_, i) => (
                <div className={styles.sideItem} key={i}>
                  <Skeleton width={18} height={18} circle />
                  <Skeleton width={`${54 + ((i * 17) % 34)}%`} height={14} />
                </div>
              ))}
            </div>
          ))}
        </aside>

        <main className="main-content" aria-hidden="true">
          <div className={styles.pageHead}>
            <Skeleton width={150} height={24} />
            <Skeleton width={200} height={28} />
            <Skeleton width={240} height={12} />
          </div>

          {/* Same card as the live Health Score hero, so it is the same height */}
          <div className="card score-hero-card">
            <Skeleton width={240} height={240} ring stroke={18} />
            <Skeleton width="72%" height={22} />
            <div className={styles.tags}>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} width={64} height={34} radius="var(--radius-full)" />
              ))}
            </div>
            <div className={styles.heroAction}>
              <Skeleton height={48} radius="var(--radius-sm)" />
            </div>
          </div>

          <div className={styles.stack}>
            {[0, 1].map((i) => (
              <div className="card-section" key={i}>
                <div className={styles.cardBody}>
                  <Skeleton width={96} height={12} />
                  <Skeleton height={16} width="85%" />
                  <Skeleton height={16} width="60%" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <nav className="mobile-nav" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div className={styles.navItem} key={i}>
            <Skeleton width={i === 2 ? 40 : 24} height={i === 2 ? 40 : 24} circle />
            <Skeleton width={28} height={8} />
          </div>
        ))}
      </nav>
    </div>
  )
}

export default AppSkeleton
