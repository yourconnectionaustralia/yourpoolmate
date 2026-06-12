// File: vite.config.js
// Your Pool Mate — Vite config
// PWA support: public/manifest.webmanifest + public/sw.js (registered in
// src/main.jsx, production builds only). No vite-plugin-pwa — the manifest
// and service worker are plain static files copied from /public.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
