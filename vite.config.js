// File: vite.config.js
// Your Pool Mate — Vite config
// Minimal config matching the original PoolConnection setup.
// PWA features are handled via meta tags in index.html, not vite-plugin-pwa.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
