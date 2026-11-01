import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ReportView from './components/ReportView.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { REPORT_PATH } from './lib/reportLink.js'

// A shared report opens on its own: no sign-in, no account data loaded.
const isReport = window.location.pathname.replace(/\/+$/, '') === REPORT_PATH

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isReport ? (
      <ReportView />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>,
)

// PWA: register the service worker (production only — it interferes with
// Vite dev server HMR). Makes the app installable + work offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[sw] registration failed:', err)
    })
  })
}
