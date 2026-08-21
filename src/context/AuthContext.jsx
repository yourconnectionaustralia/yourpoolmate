// File: src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trialExpired, setTrialExpired] = useState(false)
  const [hasPoolProfile, setHasPoolProfile] = useState(null) // null = unknown, true/false once checked
  // True while the user is in the password-recovery flow (i.e. they
  // landed here via a #access_token=...&type=recovery link). Drives
  // AuthScreen's "set a new password" view.
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    // Safety net: never let the app hang on the spinner. If auth init stalls
    // for any reason (network, SDK lock), fall through to the login screen.
    const watchdog = setTimeout(() => setLoading(false), 8000)

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Defer DB calls so they don't run while the SDK auth lock is held.
        setTimeout(() => checkUserStatus(session.user), 0)
      } else {
        setLoading(false)
      }
    }).catch((err) => {
      console.error('getSession failed:', err)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (event === 'SIGNED_IN' && session?.user) {
          // Defer DB calls out of the auth callback — awaiting Supabase queries
          // inside onAuthStateChange can deadlock the SDK lock and hang the app
          // on the loading spinner.
          setTimeout(() => checkUserStatus(session.user), 0)
        }

        if (event === 'PASSWORD_RECOVERY') {
          // Supabase has parsed the #access_token=...&type=recovery hash
          // into a real session — flip into recovery mode so AuthScreen
          // shows the "set a new password" form instead of the normal
          // signed-in app. Without this listener, that hash was being
          // left for nothing to consume it into a UI state.
          setRecoveryMode(true)
          setLoading(false)
        }

        if (event === 'SIGNED_OUT') {
          setTrialExpired(false)
          setHasPoolProfile(null)
          setRecoveryMode(false)
          setLoading(false)
        }
      }
    )

    return () => { subscription.unsubscribe(); clearTimeout(watchdog) }
  }, [])

  async function checkUserStatus(user) {
    setLoading(true)
    try {
      // Check trial status
      const trialStart = new Date(user.created_at)
      const now = new Date()

      // Check if user has paid (premium tier)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_premium, trial_ends_at')
        .eq('id', user.id)
        .single()

      const isPremium = profile?.is_premium ?? false
      // 30-day free trial (matches migration 004 / current pricing).
      // Only used as a fallback when trial_ends_at isn't set on the
      // profile yet — the real source of truth is the DB column.
      const trialEndsAt = profile?.trial_ends_at
        ? new Date(profile.trial_ends_at)
        : new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000)

      if (!isPremium && now > trialEndsAt) {
        setTrialExpired(true)
      } else {
        setTrialExpired(false)
      }

      // Check if user has a pool profile (drives onboarding trigger).
      // maybeSingle() so "no rows" is a clean null instead of a PGRST116
      // error, letting us tell "no profile yet" apart from "lookup failed".
      const { data: poolProfile, error: poolError } = await supabase
        .from('pool_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (poolError) {
        // A network blip must not be read as "this user has no pool" —
        // that pushed existing users into the onboarding sheet. Stay at
        // null (unknown) so the modal doesn't fire on a failed lookup.
        console.error('Pool profile lookup failed:', poolError)
        setHasPoolProfile(null)
      } else {
        setHasPoolProfile(!!poolProfile)
      }
    } catch (err) {
      console.error('Error checking user status:', err)
      setHasPoolProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signUpWithEmail(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // IMPORTANT: Always use window.location.origin — never hardcode a domain.
        // Ensures confirmation email redirects back to the correct app URL.
        // NOTE: the bare origin (no trailing slash) is what gets sent, so the
        // Supabase Redirect URL allow-list must contain the bare origin too —
        // a "/**" entry alone does NOT match it.
        emailRedirectTo: window.location.origin
      }
    })
    return { data, error }
  }

  /**
   * Detects Supabase's anti-enumeration response to signing up an address
   * that ALREADY has a confirmed account.
   *
   * Supabase deliberately does not error in this case — it returns a
   * success-shaped payload with an obfuscated user object, no session, and
   * an EMPTY identities array, and it sends no email at all. Without this
   * check the UI cheerfully says "check your email" and the user waits
   * forever for a message that was never sent. This was the single most
   * common "the confirmation email never arrives" report.
   */
  function isExistingAccount(data) {
    return Boolean(
      data?.user &&
      !data?.session &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    )
  }

  /**
   * Re-sends the signup confirmation email. Supabase enforces its own
   * per-address cooldown (60s by default) and will error if called sooner,
   * so the UI must gate this behind a visible countdown.
   */
  async function resendConfirmation(email) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    })
    return { data, error }
  }

  async function signInWithMagicLink(email) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // IMPORTANT: Always use window.location.origin — never hardcode a domain.
        // This ensures redirects work on both app.yourpoolmate.com.au and dev environments.
        emailRedirectTo: window.location.origin,
        // Magic link is only offered from the "I already have an account"
        // path. Leaving this at its default (true) means a typo'd address
        // silently creates a SECOND empty account and starts a second
        // 30-day trial — which then has no pool data and no payment path.
        shouldCreateUser: false
      }
    })
    return { data, error }
  }

  async function resetPassword(email) {
    // Sends a recovery email. The link redirects back here with
    // #access_token=...&type=recovery in the URL hash; the SDK
    // (detectSessionInUrl: true) turns that into a real session and
    // fires the PASSWORD_RECOVERY event handled above.
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    return { data, error }
  }

  async function updatePassword(newPassword) {
    // Only valid while in recoveryMode, i.e. once PASSWORD_RECOVERY
    // has given us a temporary authenticated session.
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      // Recovery flow is complete — drop back into normal signed-in state.
      setRecoveryMode(false)
    }
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    user,
    session,
    loading,
    trialExpired,
    hasPoolProfile,
    setHasPoolProfile,
    recoveryMode,
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
    resetPassword,
    updatePassword,
    resendConfirmation,
    isExistingAccount,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
