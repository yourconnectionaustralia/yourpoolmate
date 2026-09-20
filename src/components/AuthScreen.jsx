// File: src/components/AuthScreen.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './AuthScreen.module.css'
import { PoolIcon } from './PoolIcon.jsx'

// Seconds Supabase enforces between confirmation-email resends for the
// same address. Calling sooner returns an error, so the button is gated.
const RESEND_COOLDOWN_SECONDS = 60

/**
 * Turns raw Supabase auth errors into something a pool owner can act on.
 * The raw messages ("AuthApiError: For security purposes, you can only
 * request this after 47 seconds") are not usable by our audience.
 * The original is always logged so it stays debuggable.
 */
function friendlyAuthError(error) {
  const raw = error?.message || ''
  console.error('[auth]', error)

  if (/rate limit|too many|for security purposes|after \d+ seconds/i.test(raw)) {
    return 'Too many attempts just now — wait a minute and try again.'
  }
  if (/error sending|smtp|confirmation email|recovery email/i.test(raw)) {
    return "We couldn't send that email just now. Please try again in a moment."
  }
  if (/password/i.test(raw) && /at least|should be|characters/i.test(raw)) {
    return 'Password must be at least 8 characters.'
  }
  if (/invalid.*email|unable to validate email/i.test(raw)) {
    return "That email address doesn't look right — please check it."
  }
  if (/already registered|already exists/i.test(raw)) {
    return 'An account with that email already exists. Try signing in instead.'
  }
  return 'Something went wrong — please try again in a moment.'
}

// Password input with a built-in show/hide toggle.
// Each field manages its own visibility so toggling one doesn't reveal another.
function PasswordField({ id, label, value, onChange, placeholder, autoComplete, minLength, required }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.passwordWrap}>
        <input
          id={id}
          className={styles.input}
          style={{ paddingRight: '4rem' }}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          tabIndex={-1}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </>
  )
}

export default function AuthScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
    resetPassword,
    updatePassword,
    resendConfirmation,
    isExistingAccount,
    recoveryMode
  } = useAuth()

  const [mode, setMode] = useState('start') // 'start' | 'signup' | 'login' | 'magic' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [passwordUpdated, setPasswordUpdated] = useState(false)
  const [alreadyExists, setAlreadyExists] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resendNote, setResendNote] = useState('')

  // Countdown ticker for the resend button.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function resetFlowState() {
    setError('')
    setResendNote('')
    setAlreadyExists(false)
    setConfirmSent(false)
    setMagicSent(false)
    setResetSent(false)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await signUpWithEmail(email, password)

    if (error) {
      setError(friendlyAuthError(error))
    } else if (isExistingAccount(data)) {
      // Supabase sent NOTHING here — the address already has a confirmed
      // account. Telling this user to "check your email" is the bug that
      // makes confirmation emails look like they've gone missing.
      setAlreadyExists(true)
    } else if (data?.user && !data?.session) {
      // Genuine new signup, email confirmation required.
      setConfirmSent(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    }
    // If data.session exists, onAuthStateChange fires SIGNED_IN and the app
    // automatically moves past AuthScreen — no action needed here.
    setLoading(false)
  }

  async function handleResendConfirmation() {
    if (cooldown > 0 || loading) return
    setLoading(true)
    setError('')
    setResendNote('')
    const { error } = await resendConfirmation(email)
    if (error) {
      setError(friendlyAuthError(error))
    } else {
      setResendNote('Sent again — it can take a minute or two to arrive.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    }
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
      // With shouldCreateUser: false, an unknown address errors. Don't leak
      // whether the account exists — show the same neutral screen either way.
      if (/signups not allowed|user not found|otp_disabled/i.test(error.message || '')) {
        console.warn('[auth] magic link requested for unknown address')
        setMagicSent(true)
      } else {
        setError(friendlyAuthError(error))
      }
    } else {
      setMagicSent(true)
    }
    setLoading(false)
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error } = await resetPassword(email.trim())
      if (error) {
        setError(friendlyAuthError(error))
      } else {
        setResetSent(true)
      }
    } catch (err) {
      // A thrown error here (network/CORS/redirect not allow-listed) was
      // leaving the button stuck on "Sending…" — always surface and recover.
      console.error('Password reset threw:', err)
      setError('Couldn\'t reach the server — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords don\'t match — please re-enter them.')
      return
    }
    setLoading(true)
    try {
      const { error } = await updatePassword(newPassword)
      if (error) {
        console.error('Password update failed:', error)
        setError('Couldn\'t update your password — the reset link may have expired. Request a new one.')
      } else {
        setPasswordUpdated(true)
      }
    } catch (err) {
      console.error('Password update threw:', err)
      setError('Couldn\'t reach the server — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Set a new password (after clicking the reset link) ─────
  if (recoveryMode) {
    if (passwordUpdated) {
      return (
        <div className={styles.wrap}>
          <div className={styles.formWrap}>
            <div className={styles.successIcon}><PoolIcon name="checkCircle" size={44} /></div>
            <h2 className={styles.formHeading}>Password updated</h2>
            <p className={styles.formSubtext}>
              Your password has been changed. You're all set — loading your pool mate…
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <h2 className={styles.formHeading}>Set a new password</h2>
          <p className={styles.formSubtext}>Choose a new password for your account.</p>

          <form onSubmit={handleUpdatePassword} className={styles.form} noValidate>
            <PasswordField
              id="new-password"
              label="New password"
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />

            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              minLength={8}
              required
            />

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Account already exists (Supabase sent no email) ────────
  if (alreadyExists) {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <div className={styles.successIcon}><PoolIcon name="userCheck" size={44} /></div>
          <h2 className={styles.formHeading}>You've already got an account</h2>
          <p className={styles.formSubtext}>
            There's already an account for <strong>{email}</strong>, so we haven't
            sent a new confirmation email. Sign in with your password, or reset it
            if you've forgotten.
          </p>

          <div className={styles.actions}>
            <button
              className={styles.btnPrimary}
              onClick={() => { resetFlowState(); setPassword(''); setMode('login') }}
            >
              Sign in
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => { resetFlowState(); setMode('reset') }}
            >
              Reset my password
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
          <div className={styles.successIcon}><PoolIcon name="mail" size={44} /></div>
          <h2 className={styles.formHeading}>Check your email</h2>
          <p className={styles.formSubtext}>
            We've sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account and start your free trial.
          </p>
          <p className={styles.formSubtext} style={{ fontSize: '0.9rem', marginTop: 'var(--space-2)' }}>
            Can't find it? Check your spam or junk folder — and make sure the
            address above is spelled correctly.
          </p>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {resendNote && (
            <p className={styles.formSubtext} role="status" style={{ fontSize: '0.9rem' }}>
              {resendNote}
            </p>
          )}

          <div className={styles.actions}>
            <button
              className={styles.btnPrimary}
              onClick={handleResendConfirmation}
              disabled={cooldown > 0 || loading}
              aria-live="polite"
            >
              {loading
                ? 'Sending…'
                : cooldown > 0
                  ? `Resend email (${cooldown}s)`
                  : 'Resend email'}
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => { resetFlowState(); setMode('signup') }}
            >
              Use a different email
            </button>
          </div>

          <p className={styles.switchMode}>
            <button
              className={styles.linkBtn}
              onClick={() => { resetFlowState(); setMode('start') }}
            >
              Back to start
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ── Magic link sent ────────────────────────────────────────
  if (magicSent) {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <div className={styles.successIcon}><PoolIcon name="mail" size={44} /></div>
          <h2 className={styles.formHeading}>Check your email</h2>
          <p className={styles.formSubtext}>
            If an account exists for <strong>{email}</strong>, we've sent a
            sign-in link. Tap it to get into your pool mate.
          </p>
          <p className={styles.formSubtext} style={{ fontSize: '0.9rem', marginTop: 'var(--space-2)' }}>
            Can't find it? Check your spam or junk folder.
          </p>
          <button
            className={styles.btnSecondary}
            onClick={() => { resetFlowState(); setMode('login') }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Reset link sent ────────────────────────────────────────
  if (resetSent) {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <div className={styles.successIcon}><PoolIcon name="mail" size={44} /></div>
          <h2 className={styles.formHeading}>Check your email</h2>
          <p className={styles.formSubtext}>
            If an account exists for <strong>{email}</strong>, we've sent a link to
            reset your password. Tap it to choose a new one.
          </p>
          <p className={styles.formSubtext} style={{ fontSize: '0.9rem', marginTop: 'var(--space-2)' }}>
            Can't find it? Check your spam or junk folder.
          </p>
          <button
            className={styles.btnSecondary}
            onClick={() => { resetFlowState(); setMode('login') }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
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
              <span className={styles.propIcon}><PoolIcon name="droplet" size={20} /></span>
              <span>Know your pool's health at a glance</span>
            </div>
            <div className={styles.prop}>
              <span className={styles.propIcon}><PoolIcon name="target" size={20} /></span>
              <span>Exactly what chemicals to add — no guessing</span>
            </div>
            <div className={styles.prop}>
              <span className={styles.propIcon}><PoolIcon name="clipboard" size={20} /></span>
              <span>Protect your pool warranty with timestamped records</span>
            </div>
            <div className={styles.prop}>
              <span className={styles.propIcon}><PoolIcon name="camera" size={20} /></span>
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
              onClick={() => { resetFlowState(); setMode('signup') }}
            >
              Start free trial
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => { resetFlowState(); setMode('login') }}
            >
              I already have an account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Forgot password form ───────────────────────────────────
  if (mode === 'reset') {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <button className={styles.backBtn} onClick={() => { resetFlowState(); setMode('login') }} aria-label="Back">
            Back
          </button>
          <h2 className={styles.formHeading}>Reset your password</h2>
          <p className={styles.formSubtext}>
            Enter your email and we'll send you a link to set a new password.
          </p>

          <form onSubmit={handleResetRequest} className={styles.form} noValidate>
            <label className={styles.label} htmlFor="reset-email">Email address</label>
            <input
              id="reset-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com.au"
              required
            />

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p className={styles.switchMode}>
            Remembered it?{' '}
            <button className={styles.linkBtn} onClick={() => { resetFlowState(); setMode('login') }}>Sign in</button>
          </p>
        </div>
      </div>
    )
  }

  // ── Magic link request form ────────────────────────────────
  // Previously this mode had no branch at all: setMode('magic') fell through
  // to the password login form, so "Email me a sign-in link instead" appeared
  // to do nothing and handleMagicLink was unreachable.
  if (mode === 'magic') {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <button className={styles.backBtn} onClick={() => { resetFlowState(); setMode('login') }} aria-label="Back">
            Back
          </button>
          <h2 className={styles.formHeading}>Email me a sign-in link</h2>
          <p className={styles.formSubtext}>
            No password needed. We'll send a link to your email — tap it and
            you're in.
          </p>

          <form onSubmit={handleMagicLink} className={styles.form} noValidate>
            <label className={styles.label} htmlFor="magic-email">Email address</label>
            <input
              id="magic-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com.au"
              required
            />

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send me a link'}
            </button>
          </form>

          <p className={styles.switchMode}>
            Prefer a password?{' '}
            <button className={styles.linkBtn} onClick={() => { resetFlowState(); setMode('login') }}>Sign in</button>
          </p>
        </div>
      </div>
    )
  }

  // ── Sign up form ───────────────────────────────────────────
  if (mode === 'signup') {
    return (
      <div className={styles.wrap}>
        <div className={styles.formWrap}>
          <button className={styles.backBtn} onClick={() => { resetFlowState(); setMode('start') }} aria-label="Back">
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

            <PasswordField
              id="signup-password"
              label="Password"
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
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className={styles.switchMode}>
            Already have an account?{' '}
            <button className={styles.linkBtn} onClick={() => { resetFlowState(); setMode('login') }}>Sign in</button>
          </p>
        </div>
      </div>
    )
  }

  // ── Login form ─────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <div className={styles.formWrap}>
        <button className={styles.backBtn} onClick={() => { resetFlowState(); setMode('start') }} aria-label="Back">
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

          <PasswordField
            id="login-password"
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'calc(var(--space-2) * -1)' }}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => { resetFlowState(); setMode('reset') }}
            >
              Forgot password?
            </button>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            className={styles.btnPrimary}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.divider}><span>or</span></div>

        <button
          className={styles.btnGhost}
          onClick={() => { resetFlowState(); setMode('magic') }}
        >
          Email me a sign-in link instead
        </button>

        <p className={styles.switchMode}>
          Don't have an account?{' '}
          <button className={styles.linkBtn} onClick={() => { resetFlowState(); setMode('signup') }}>Start free trial</button>
        </p>
      </div>
    </div>
  )
}
