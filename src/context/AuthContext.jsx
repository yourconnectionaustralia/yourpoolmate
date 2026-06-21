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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        checkUserStatus(session.user)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (event === 'SIGNED_IN' && session?.user) {
          await checkUserStatus(session.user)
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

    return () => subscription.unsubscribe()
  }, [])

  async function checkUserStatus(user) {
    setLoading(true)
    try {
      // Check trial status
      const trialStart = new Date(user.created_at)
      const now = new Date()
      const daysSinceSignup = (now - trialStart) / (1000 * 60 * 60 * 24)

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

      // Check if user has a pool profile (drives onboarding trigger)
      const { data: poolProfile } = await supabase
        .from('pool_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      setHasPoolProfile(!!poolProfile)
    } catch (err) {
      console.error('Error checking user status:', err)
      setHasPoolProfile(false)
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
        emailRedirectTo: window.location.origin
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
