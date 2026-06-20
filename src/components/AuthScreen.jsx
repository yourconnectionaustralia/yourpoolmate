// File: src/components/AuthScreen.jsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './AuthScreen.module.css'

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink } = useAuth()
  const [mode, setMode] = useState('start') // 'start' | 'signup' | 'login' | 'magic'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSignUp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await signUpWithEmail(email, password)
    if (error) {
      setError(error.message)
    } else if (data?.user && !data?.session) {
      // Supabase accepted the signup but email confirmation is required.
      // Show a "check your email" screen so the user isn't left hanging.
      setConfirmSent(true)
    }
    // If data.session exists, onAuthStateChange fires SIGNED_IN and the app
    // automatically moves past AuthScreen — no action needed here.
    setLoading(false)
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signInWithEmail(email, password)
    if (error) setError('Couldn\'t sign you in — check your email and password.')
    setLoading(false)
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signInWithMagicLink(email)
    if (error) {
      setError('Something went wrong — try again in a moment.')
    } else {
      setMagicSent(true)
    }
    setLoading(false)
  }

  // ── Trial start screen ─────────────────────────────────────
  if (mode === 'start') {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.hero}>
            <div className={styles.logoMark} aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
                <defs>
                  <linearGradient id="auth-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0B7799" />
                    <stop offset="100%" stopColor="#085E78" />
                  </linearGradient>
                </defs>
                <circle cx="24" cy="24" r="17" fill="none" stroke="url(#auth-grad)" strokeWidth="3.2" />
                <path d="M7.3 27 Q 15.65 23 24 27 T 40.7 27 A 17 17 0 0 1 7.3 27 Z" fill="url(#auth-grad)" />
              </svg>
            </div>
            <h1 className={styles.heading}>Your Pool Mate</h1>
            <p className={styles.tagline}>Your pool. Your mate. Your water, sorted.</p>
          </div>

          <div className={styles.valueProps}>
            <div className={styles.prop}>
              <span className={styles.propIcon}>💧</span>
              <span>Know your pool's health at a glance</span>
            </div>
            <div className={styles.prop}>
              <span className={styles.propIcon}>🎯</span>
              <span>Exactly what chemicals to add — no guessing</span>
            </div>
            <div className={styles.prop}>
              <span className={styles.propIcon}>📋</span>
              <span>Protect your pool warranty with timestamped records</span>
            </div>
            <div className={styles.prop}>
              <span className={styles.propIcon}>📸</span>
              <span>Scan your pool shop test — auto-fills in seconds</span>
            </div>
          </div>

          <div className={styles.trialBadge}>
            <span className={styles.trialDays}>30 days free</span>
            <span className={styles.trialNote}>No credit card required</span>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.btnPrimary}
              onClick={() => setMode('signup')}
            >
              Start free trial
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => setMode('login')}
            >
              I already have an account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Email confirmation required ────────────────────────────
  if (confirmSent) {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <div className={styles.successIcon} aria-hidden="true">✉️</div>
          <h2 className={styles.formHeading}>Check your email</h2>
          <p className={styles.formSubtext}>
            We've sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account and start your free trial.
          </p>
          <p className={styles.formSubtext} style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
            Can't find it? Check your spam folder.
          </p>
          <button className={styles.btnSecondary} onClick={() => { setConfirmSent(false); setMode('start') }}>
            Back to start
          </button>
        </div>
      </div>
    )
  }

  // ── Magic link sent ────────────────────────────────────────
  if (magicSent) {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <div className={styles.successIcon} aria-hidden="true">✉️</div>
          <h2 className={styles.formHeading}>Check your email</h2>
          <p className={styles.formSubtext}>
            We've sent a sign-in link to <strong>{email}</strong>.
            Tap it to get into your pool mate.
          </p>
          <button className={styles.btnSecondary} onClick={() => { setMagicSent(false); setMode('start') }}>
            Back to start
          </button>
        </div>
      </div>
    )
  }

  // ── Sign up form ───────────────────────────────────────────
  if (mode === 'signup') {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <button className={styles.backBtn} onClick={() => setMode('start')} aria-label="Back">
            Back
          </button>
          <h2 className={styles.formHeading}>Start your free trial</h2>
          <p className={styles.formSubtext}>30 days free. No credit card.</p>

          <form onSubmit={handleSignUp} className={styles.form} noValidate>
            <label className={styles.label} htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com.au"
              required
            />

            <label className={styles.label} htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Choose a password"
              minLength={8}
              required
            />

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button
              className={styles.btnPrimary}
              type="submit"
              disabled={!!loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className={styles.switchMode}>
            Already have an account?{' '}
            <button className={styles.linkBtn} onClick={() => setMode('login')}>Sign in</button>
          </p>
        </div>
      </div>
    )
  }

  // ── Login form ─────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <div className={styles.formWrap}>
        <button className={styles.backBtn} onClick={() => setMode('start')} aria-label="Back">
          Back
        </button>
        <h2 className={styles.formHeading}>Welcome back</h2>

        <form onSubmit={handleLogin} className={styles.form} noValidate>
          <label className={styles.label} htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com.au"
            required
          />

          <label className={styles.label} htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            className={styles.btnPrimary}
            type="submit"
            disabled={!!loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.divider}><span>or</span></div>

        <button
          className={styles.btnGhost}
          onClick={() => setMode('magic')}
        >
          Email me a sign-in link instead
        </button>

        <p className={styles.switchMode}>
          Don't have an account?{' '}
          <button className={styles.linkBtn} onClick={() => setMode('signup')}>Start free trial</button>
        </p>
      </div>
    </div>
  )
}
