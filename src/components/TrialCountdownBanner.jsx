// File: src/components/TrialCountdownBanner.jsx
// Shows trial days remaining. Disappears once user is premium.
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './TrialCountdownBanner.module.css'

export default function TrialCountdownBanner() {
  const { user } = useAuth()
  const [daysLeft, setDaysLeft] = useState(null)
  const [isPremium, setIsPremium] = useState(null)

  useEffect(() => {
    if (!user) return
    checkStatus()
  }, [user])

  async function checkStatus() {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_premium, trial_ends_at')
      .eq('id', user.id)
      .single()

    if (profile?.is_premium) {
      setIsPremium(true)
      return
    }

    const trialEnd = profile?.trial_ends_at
      ? new Date(profile.trial_ends_at)
      : new Date(new Date(user.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)

    const now = new Date()
    const msLeft = trialEnd - now
    const days = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))

    setDaysLeft(days)
    setIsPremium(false)
  }

  // Don't render if premium or status unknown
  if (isPremium !== false || daysLeft === null) return null

  const isUrgent = daysLeft <= 2

  return (
    <div
      className={`${styles.banner} ${isUrgent ? styles.urgent : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.text}>
        {daysLeft === 0
          ? 'Your free trial ends today'
          : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial`
        }
      </span>
      <a href="https://yourpoolmate.com.au/#join" className={styles.cta}>
        {daysLeft <= 1 ? 'Join now' : 'Become a founding member'}
      </a>
    </div>
  )
}
