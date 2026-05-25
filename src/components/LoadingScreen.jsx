// File: src/components/LoadingScreen.jsx
import styles from './LoadingScreen.module.css'

export default function LoadingScreen() {
  return (
    <div className={styles.wrap}>
      <div className={styles.logo} aria-hidden="true">
        {/* Droplet Node logo — Sky-to-Ocean gradient */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="droplet-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00B4D8" />
              <stop offset="100%" stopColor="#0077B6" />
            </linearGradient>
          </defs>
          {/* Five-node droplet layout */}
          <circle cx="24" cy="10" r="5" fill="url(#droplet-grad)" opacity="0.9" />
          <circle cx="38" cy="22" r="4" fill="url(#droplet-grad)" opacity="0.75" />
          <circle cx="32" cy="38" r="4" fill="url(#droplet-grad)" opacity="0.75" />
          <circle cx="16" cy="38" r="4" fill="url(#droplet-grad)" opacity="0.75" />
          <circle cx="10" cy="22" r="4" fill="url(#droplet-grad)" opacity="0.75" />
          <circle cx="24" cy="24" r="6" fill="url(#droplet-grad)" />
        </svg>
      </div>
      <p className={styles.label}>Your Pool Mate</p>
      <div className={styles.spinner} role="status" aria-label="Loading" />
    </div>
  )
}
