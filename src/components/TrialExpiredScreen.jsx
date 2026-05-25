// File: src/components/TrialExpiredScreen.jsx
// Hard block at trial expiry — no soft gates, no "remind me later"
import { useAuth } from '../context/AuthContext'
import styles from './TrialExpiredScreen.module.css'

const FOUNDING_MEMBER_URL = 'https://yourpoolmate.com.au/#join'
const SPOTS_REMAINING = 200 // Update as spots sell — or wire to Supabase

export default function TrialExpiredScreen() {
  const { signOut } = useAuth()

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.icon} aria-hidden="true">⏱</div>

        <h1 className={styles.heading}>Your free trial has ended</h1>

        <p className={styles.body}>
          You've seen what your pool can look like when you're in control.
          Become a founding member to keep your Health Score, dosing recommendations,
          and warranty record going.
        </p>

        <div className={styles.offer}>
          <div className={styles.offerPrice}>
            <span className={styles.price}>$79</span>
            <span className={styles.priceNote}>once-off · founding member price</span>
          </div>
          <div className={styles.offerDetail}>
            After that it goes to $39/year. {SPOTS_REMAINING} founding member spots — first in, best dressed.
          </div>
        </div>

        <div className={styles.actions}>
          <a
            href={FOUNDING_MEMBER_URL}
            className={styles.btnPrimary}
          >
            Become a founding member
          </a>

          <button
            className={styles.btnGhost}
            onClick={signOut}
          >
            Sign out
          </button>
        </div>

        <p className={styles.warrantyNote}>
          💡 Your warranty records are safe — they'll be right here when you come back.
        </p>
      </div>
    </div>
  )
}
