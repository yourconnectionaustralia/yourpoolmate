// File: src/App.jsx
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './components/Dashboard'
import AuthScreen from './components/AuthScreen'
import TrialExpiredScreen from './components/TrialExpiredScreen'
import GuestOnboarding from './components/GuestOnboarding'
import LoadingScreen from './components/LoadingScreen'

// ─── TEST MODE ────────────────────────────────────────────────
// Set to true to bypass login for UI testing.
// Set back to false before launching to real users.
const TEST_MODE = true

// ─── Inner app (has access to auth context) ──────────────────
function AppInner() {
  const { user, session, loading, trialExpired, hasPoolProfile } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Wire the guest onboarding trigger:
  // Show onboarding modal for any authenticated user with no pool profile.
  // This is the single highest-conversion-impact fix before launch.
  useEffect(() => {
    if (!loading && user && hasPoolProfile === false) {
      setShowOnboarding(true)
    }
  }, [loading, user, hasPoolProfile])

  // ── TEST MODE: skip all auth gates ──────────────────────────
  if (TEST_MODE) {
    return <Dashboard />
  }

  if (loading) return <LoadingScreen />

  // No session → show auth/trial start
  if (!session) return <AuthScreen />

  // Trial expired → hard block, no soft gates
  if (trialExpired) return <TrialExpiredScreen />

  return (
    <>
      <Dashboard />
      {showOnboarding && (
        <GuestOnboarding onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  )
}

// ─── Root app ─────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
