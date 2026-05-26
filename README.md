# Your Pool Mate

Rebranded beta of PoolConnection. Two halves:

- **Marketing site** — static HTML in `marketing/`, deploys to `yourpoolmate.pages.dev`
- **PWA app** — Vite + React in `src/`, deploys to `app.yourpoolmate.pages.dev`

Both are designed to live in this single repo and ship as two Cloudflare Pages projects.

---

## Run it locally (first time)

You only need to do this once. The terminal commands run in macOS Terminal — open Terminal (Cmd+Space → "Terminal").

### 1. Install Node.js (one-time setup)

Easiest path on macOS: download the LTS installer from <https://nodejs.org/> and run it. Verify in Terminal:

```bash
node --version    # should print v18 or higher
npm --version     # should print 9 or higher
```

### 2. Install dependencies (one-time per repo)

```bash
cd "/Users/JamesMac/YourPoolMate/YouPoolMate"
npm install
```

### 3. Run the **app** locally

```bash
npm run dev
```

Open <http://localhost:5173> in your browser. This is the PWA app — the dashboard, Health Score, scanner UI, water test form, etc. Hot-reload is on, so saving any file in `src/` refreshes the page automatically.

### 4. Run the **marketing site** locally

In a second Terminal tab (Cmd+T):

```bash
cd "/Users/JamesMac/YourPoolMate/YouPoolMate"
npm run dev:marketing
```

Open <http://localhost:5174>. This is the `yourpoolmate.pages.dev` landing page — hero, founder story, pricing, FAQ, Stripe checkout placeholder.

### 5. (Optional) Production build

```bash
npm run build              # builds the app to dist/
npm run build:marketing    # copies the marketing page to marketing-dist/
```

---

## Deploy to Cloudflare Pages

Two separate Pages projects, both auto-deploying from this same GitHub repo on push to `main`.

### Project 1 — Marketing site (`yourpoolmate.pages.dev`)

In Cloudflare Pages, create a project pointing at this repo with:

- **Build command:** `npm run build:marketing`
- **Build output directory:** `marketing-dist`
- **Root directory:** *(leave blank)*

### Project 2 — App (`app.yourpoolmate.pages.dev`)

Create a second Pages project pointing at the same repo with:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** *(leave blank)*
- **Environment variables** (Production + Preview scopes):
  - `VITE_SUPABASE_URL` = your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

> The current `App.jsx` is UI-only and doesn't call Supabase at runtime yet, so the app will work without those env vars set. When you wire auth/persistence in, they'll be required.

**Important:** the existing `yourpoolmate.pages.dev` Pages project is currently building the app. You'll want to either rename/recreate it as the marketing project, or repoint its build command + output directory and let it rebuild on the next push.

---

## What's in this repo

```
YouPoolMate/
├─ index.html                  # Vite app entry (root)
├─ src/
│  ├─ main.jsx                 # React mount
│  ├─ App.jsx                  # The whole app — 1300+ lines, self-contained
│  ├─ supabase.js              # Supabase client (ready, not yet called by App.jsx)
│  └─ index.css                # Design tokens + component styles (Notion-influenced)
├─ marketing/
│  └─ index.html               # The landing page — single HTML file, no build step needed
├─ public/
│  ├─ logo.svg                 # Droplet logo
│  └─ _redirects               # Cloudflare Pages SPA fallback
├─ package.json
├─ vite.config.js
├─ .env.example                # Copy to .env.local for local Supabase keys
└─ .gitignore
```

---

## Brand spec (locked)

- **Name:** Your Pool Mate
- **Tagline:** Your pool. Your mate. Your water, sorted.
- **Domains (pending registration):** yourpoolmate.com.au, yourpoolmate.app, yourpoolmate.com
- **Pages projects:** yourpoolmate.pages.dev (marketing), app.yourpoolmate.pages.dev (app)
- **Typography:** Inter (UI/body) + Newsreader (headings only)
- **Colours:** see CSS tokens in `src/index.css` and the marketing page `<style>` block
- **Tone:** knowledgeable mate who owns a pool, not a brand voice

See `CLAUDE.md` for the full product/brand/business spec.
