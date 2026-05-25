// File: src/components/Dashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import HealthScoreRing from './HealthScoreRing'
import InsightCards from './InsightCards'
import TrialCountdownBanner from './TrialCountdownBanner'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [latestTest, setLatestTest] = useState(null)
  const [healthScore, setHealthScore] = useState(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (user) loadLatestTest()
  }, [user])

  async function loadLatestTest() {
    setLoadingData(true)
    try {
      const { data } = await supabase
        .from('water_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('tested_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setLatestTest(data)
        setHealthScore(data.health_score)
      }
    } catch {
      // No test yet — that's fine, show empty state
    } finally {
      setLoadingData(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logoArea}>
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="nav-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00B4D8" />
                  <stop offset="100%" stopColor="#0077B6" />
                </linearGradient>
              </defs>
              <circle cx="24" cy="10" r="5" fill="url(#nav-grad)" opacity="0.9" />
              <circle cx="38" cy="22" r="4" fill="url(#nav-grad)" opacity="0.75" />
              <circle cx="32" cy="38" r="4" fill="url(#nav-grad)" opacity="0.75" />
              <circle cx="16" cy="38" r="4" fill="url(#nav-grad)" opacity="0.75" />
              <circle cx="10" cy="22" r="4" fill="url(#nav-grad)" opacity="0.75" />
              <circle cx="24" cy="24" r="6" fill="url(#nav-grad)" />
            </svg>
            <span className={styles.appName}>Your Pool Mate</span>
          </div>
          <button
            className={styles.menuBtn}
            onClick={signOut}
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <TrialCountdownBanner />

      {/* Main scroll area */}
      <main className={styles.main}>
        {/* Health Score */}
        <section className={styles.scoreSection}>
          {loadingData ? (
            <div className={styles.scoreSkeleton} aria-busy="true" />
          ) : (
            <HealthScoreRing score={healthScore} />
          )}
        </section>

        {/* Insight cards */}
        <section className={styles.insightsSection}>
          {loadingData ? (
            <div className={styles.cardsSkeleton} aria-busy="true" />
          ) : latestTest ? (
            <InsightCards test={latestTest} />
          ) : (
            <EmptyState />
          )}
        </section>
      </main>

      {/* Log test FAB */}
      <div className={styles.fab}>
        <button className={styles.fabBtn} aria-label="Log a water test">
          <span aria-hidden="true">+</span> Log water test
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyIcon} aria-hidden="true">💧</p>
      <h2 className={styles.emptyHeading}>Log your first water test</h2>
      <p className={styles.emptyBody}>
        Tap the button below to see your pool's Health Score and exactly what to add.
      </p>
    </div>
  )
}
