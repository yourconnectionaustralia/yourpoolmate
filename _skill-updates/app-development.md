---
name: poolconnection-app-development
description: >
  Use this skill for ALL development work on Your Pool Mate — the mobile-first pool water
  management PWA built on Vite/React, Supabase, and Cloudflare Pages. Triggers on any request
  involving: writing or editing React components, Supabase Edge Functions, database schema,
  auth flows, OCR integration, PWA configuration, deployment, or debugging. Also triggers on
  phrases like "build this feature", "fix this bug", "add a component", "deploy", "edge function",
  "supabase", "schema change", or any code-level task. Always use this skill before writing a
  single line of code for Your Pool Mate — the stack constraints, conventions, and deployment
  patterns here will save significant rework.
---

# Your Pool Mate — App Development Skill
**Version:** 2.0 | **Rebrand:** PoolConnection → Your Pool Mate (May 2026)

This skill governs all technical development for Your Pool Mate. Read it fully before writing
any code. Constraints here are non-negotiable — they reflect real deployment decisions and
mistakes already resolved.

---

## TECH STACK (locked)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vite + React (PWA) | Mobile-first. Light mode default. |
| Auth + DB | Supabase | Postgres, RLS policies required on all tables |
| Storage | Supabase Storage | For pool photos, test strip images |
| Edge Functions | Supabase Edge Functions (Deno) | Not Node.js — Deno runtime only |
| OCR | Claude Vision API via Edge Function | See OCR section |
| Payments | Stripe Checkout (embedded) via Edge Function | Currently test mode |
| Deployment | Cloudflare Pages | GitHub integration, auto-deploy on push to main |
| Commits | GitHub web interface | Copy-paste method, never CLI as primary |

---

## BRAND & DESIGN SYSTEM

- **Typography:** Inter (UI text / all body), Newsreader (headings only)
- **Colour palette:** Neutral-first tokens. Ocean (#0077B6), Sky (#00B4D8), Foam (#90E0EF) for accents
- **Logo:** Droplet Node Flat v3 SVG — flat design, Sky-to-Ocean gradient, five-node layout
- **Mode:** Light mode is the consumer default (outdoor usability in Australian sun)
- **Design language:** Clean, minimal, mobile-first. Notion-influenced component pattern.
- **Accessibility:** 44px tap targets, 4.5:1 contrast ratio, system font scaling — non-negotiable

---

## CLOUDFLARE PAGES PROJECTS

Two separate Cloudflare Pages projects:
- `poolconnection-app.pages.dev` → the PWA app (update name when redeployed)
- `poolconnection.pages.dev` → the marketing/checkout site (update when redeployed)

**Domain targets (pending registration):**
- `yourpoolmate.com.au` — marketing site (root domain, for SEO authority)
- `app.yourpoolmate.com.au` — the PWA app (subdomain)
- Also register: `yourpoolmate.app` and `yourpoolmate.com`

---

## ARCHITECTURE RULES

### Supabase
- Every table MUST have Row Level Security (RLS) enabled — no exceptions
- Auth via Supabase Auth (email/password + magic link)
- Edge Functions live in `supabase/functions/` — Deno runtime, not Node
- Environment variables via Supabase dashboard secrets (never hardcoded)
- Rate limiting required on all Edge Functions that call external APIs
- **Auth redirect fix (resolved):** Use `redirectTo: window.location.origin` in `signInWithOAuth`
  + correct Site URL in Supabase dashboard (app domain, not marketing domain)
  + explicit `SIGNED_IN` handler in `onAuthStateChange`

### Frontend
- All components in `src/components/`
- Hooks in `src/hooks/` — prefixed `use` (e.g. `usePoolOCR.ts`)
- No inline styles except for truly one-off layout values
- PWA: manifest at `public/manifest.webmanifest`, service worker at `public/sw.js` (registered in `src/main.jsx`, production only). Bump CACHE_VERSION in sw.js when cached assets change.
- Guest mode: 30-day hard-countdown trial (no indefinite guest access — ever)

### CORS
- Always include CORS headers for all Your Pool Mate domains
- `yourpoolmate.com.au`, `app.yourpoolmate.com.au`, `yourpoolmate.app`

---

## KEY FEATURES BUILT (do not rebuild)

| Feature | Status | Notes |
|---------|--------|-------|
| Six-step guest onboarding modal | ✅ Built | `GuestOnboarding.jsx`, `GuestOnboardingPreview.jsx` |
| OCR water test scanner | ✅ Built | Edge Function + `usePoolOCR.ts` + `WaterTestScanner.tsx` |
| Pool Health Score ring gauge | ✅ Built | Single 0–100 number with colour ring |
| Smart insight cards | ✅ Built | Green/amber/red status cards per parameter |
| Seasonal task checklist | ✅ Built | |
| Chemical addition log | ✅ Built | Timestamped history |
| Premium tier gating | ✅ Built | |
| Floating feedback widget | ✅ Built | |
| 30-day hard-countdown trial | ✅ Built | Hard block at expiry — no soft gates |
| Marketing/checkout page | ✅ Built | HTML + Stripe integration |

### HIGHEST PRIORITY UNWIRED ITEM
The guest onboarding trigger exists but is **not wired into the app flow**.
New guests with no pool profile must automatically see the onboarding modal.
This is the single highest-conversion-impact fix before launch.

---

## OCR INTEGRATION

The OCR Edge Function is `supabase/functions/ocr-water-test/index.ts` (built June 2026):
- Request: `POST { image_base64, media_type }` (jpeg/png/webp/gif, max ~3MB binary; data-URL prefix tolerated)
- Calls Claude Vision (`OCR_MODEL` env, default `claude-haiku-4-5-20251001`) with a strict extract-only prompt — never guesses unreadable values, ignores printed target ranges
- Response: `{ readings: { ph, free_chlorine, total_chlorine, alkalinity, cyanuric_acid, calcium, salt, phosphates, tds }, confidence, notes, source: "ocr", scans_remaining_this_hour }` — keys match `water_tests` columns; values clamped to physical bounds, junk → null
- Rate limited: 10 calls/user/hour, tracked in `public.ocr_calls` (migration 005, service-role only — users can't reset their counter)
- Auth required: Supabase JWT must be valid
- Secrets: `ANTHROPIC_API_KEY` must be set in Supabase Edge Function secrets

When building any feature that touches water test data, check if OCR pre-fill is appropriate. Surface `confidence` and `notes` in the UI when not "high" — let the user verify before saving.

---

## COMMON PATTERNS

### Adding a new Edge Function
```
supabase/functions/[function-name]/index.ts
```
Always include:
- CORS headers for all Your Pool Mate domains
- Auth check: `const { data: { user } } = await supabase.auth.getUser()`
- Rate limit check before any external API call
- Structured error responses: `{ error: string, code: string }`

### Adding a new React component
```jsx
// Always: named export + default export
// Always: mobile-first responsive (375px base)
// Always: Inter for body text, Newsreader for headings
// Always: loading + error states
// Always: 44px minimum tap targets
```

### Database migrations
Write as SQL migration files. Include:
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- RLS policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`

---

## CODE QUALITY CHECKLIST

Before presenting any code to James:
- [ ] Mobile layout verified at 375px width
- [ ] Loading state handled (skeleton/shimmer, never blank)
- [ ] Error state handled with next-step option (no dead ends)
- [ ] RLS policy included (if DB change)
- [ ] No hardcoded secrets or API keys
- [ ] Inter/Newsreader typography applied correctly
- [ ] 44px tap targets on all interactive elements
- [ ] Edge Function includes auth check (if applicable)
- [ ] Deno-compatible imports (not Node.js `require`)
- [ ] CORS headers cover all Your Pool Mate domains

---

## OUTPUT FORMAT

James deploys exclusively via the GitHub web UI.
- Always provide **complete files** — never diffs, never partials
- Label each file with its full path: `// File: src/components/HealthScore.jsx`
- Never suggest `git` CLI commands as the primary method

---

## SELF-IMPROVEMENT LOG

| # | Date | Correction / Learning | Applied To |
|---|------|-----------------------|------------|
| 1 | Init | Supabase Edge Functions use Deno, not Node — import paths differ | All functions |
| 2 | Init | OCR Edge Function chosen over Cloudflare Worker — do not suggest CW as alternative | OCR |
| 3 | Init | Guest mode is 7-day hard countdown, NOT indefinite — never build indefinite guest flows | Auth/onboarding |
| 4 | Init | GitHub commits via web interface copy-paste — never suggest CLI git commands as primary | Deployment |
| 5 | Init | Supabase auth redirect bug resolved: use `redirectTo: window.location.origin` + explicit SIGNED_IN handler | Auth |
| 6 | May 2026 | Rebrand: PoolConnection → Your Pool Mate. Typography: Inter + Newsreader. Domains: yourpoolmate.com.au | All |
| 7 | Jun 2026 | Review fixes: trial 7→30 days (migration 004); user_profiles premium/trial fields locked to service role (was a privilege-escalation hole); real PWA manifest + service worker shipped; Health Score now scores salt for saltwater/mineral pools (pass sanitiser_type) | All |
