# Your Pool Mate — Project Context
**For Claude · Loaded at the start of every session**
**Last updated: June 2026 (post cross-domain review)**

---

## WHO JAMES IS

James is the solo founder of **Your Pool Mate** — a mobile-first pool water management PWA targeting Australian residential pool owners. He works across all domains simultaneously: product development, UX, marketing, business strategy, and operations.

He is not a developer by trade. He deploys code exclusively via the **GitHub web UI** (open file → select all → paste → commit to main). Cloudflare Pages auto-deploys on every commit. Never suggest CLI commands as the primary method — always provide copy-paste-ready complete files.

He arrives with formed strategic positions and uses Claude to produce **deployable outputs** — complete files, not diffs, not recommendations, not pseudocode.

---

## THE PRODUCT

**Your Pool Mate** is a PWA that helps Australian residential pool owners:
- Know their pool's health at a glance (Pool Health Score — a number out of 100)
- Know exactly what chemicals to add and how much (guided dosing)
- Scan their pool shop water test printout to auto-fill readings (OCR via Claude Vision)
- Keep a timestamped water history (warranty protection + asset record)
- Find pool shops near them (Shop Near Me — future B2B monetisation surface)

**Tagline:** "Your pool. Your mate. Your water, sorted."

**Core positioning:** The app that puts pool owners back in control of their pool — and keeps a record to prove it.

**Previous name:** PoolConnection (retired May 2026). Do not use this name in any output.

---

## THE CUSTOMER

**Primary:** Australian residential pool owner, **55–70 years old**
- Pain: confused by pool chemistry, over-reliant on pool shop, quietly anxious their pool isn't safe, worried they're wasting money on chemicals they don't need
- Deeper motivations (in order of emotional power):
  1. **Independence from the pool shop** — resentment at dependency and cost
  2. **Warranty protection** — Australian pool warranties require documented water chemistry records; without logs, claims get denied
  3. **Safe water confidence** — grandchildren swim in this pool
  4. **Asset preservation** — documented history transfers at home sale
- Behaviour: Facebook Groups (AUS Pool Owners, state-based groups), Google searches for pool problems
- Less tech-savvy: all UX must use 44px tap targets, 4.5:1 contrast, system font scaling
- Price sensitivity: willing to pay for clear value; $79 LTD feels like a bargain vs ongoing shop visits

**Secondary:** New pool owner (first 12 months) — high anxiety, high conversion potential

---

## THE WARRANTY ANGLE (use this — no competitor has claimed it)

Australian pool warranties require documented water chemistry records to make claims:
- Builders Installation Warranty: 6–7 years structural, 2 years non-structural
- Equipment manufacturers (Pentair, Zodiac, Astral) explicitly require chemistry logs
- Pool shops don't give owners a copy of their results in a useful format
- **This app does.** Timestamped, exportable water test history.

This is a blue-ocean positioning claim for Facebook posts, landing page copy, and trial conversion. Lead with it.

---

## THE BUSINESS MODEL

**Two-sided local marketplace, built in sequence — never collapse or reorder:**

```
Phase 1: B2C consumer adoption (now)
Phase 2: B2B paid shop directory listings (after ~50 local users per postcode cluster)
Phase 3: B2B data intelligence upsell (after 30+ days of shop listing retention)
Phase 4: Closed-loop marketplace (in-app bookings / purchases)
```

### B2C Pricing
| Phase | Offer | Price | Trigger |
|-------|-------|-------|---------|
| Now | 30-day hard-countdown free trial | Free | App download / signup |
| Launch | Founding Member LTD | $79 AUD | Facebook Groups, 200 spots max |
| FOMO close | Price bump | $99 AUD | ~175 spots sold |
| Post-LTD | Annual subscription | $39 AUD/year | Permanent price |

### B2B Pricing (future)
| Position | Price | Notes |
|----------|-------|-------|
| Position 1 — Shop Near Me | $149 AUD/month | Exclusive per postcode cluster |
| Position 2 | $99 AUD/month | Exclusive per postcode cluster |
| Position 3 | $69 AUD/month | Exclusive per postcode cluster |
| Data Intelligence add-on | $49 AUD/month | Only offered after 30+ days of listing |

B2B pitch threshold: **≥ 50 active users in the shop's postcode cluster.** Do not pitch earlier.

---

## THE TECH STACK (locked — do not suggest alternatives)

| Layer | Technology | Critical notes |
|-------|-----------|----------------|
| Frontend | Vite + React (PWA) | Mobile-first, light mode default |
| Auth + DB | Supabase | Postgres, RLS required on ALL tables |
| Edge Functions | Supabase Edge Functions | **Deno runtime — NOT Node.js** |
| OCR | Claude Vision API via Edge Function | rate-limited, auth-required |
| Payments | Stripe Checkout (embedded) via Edge Function | Currently test mode |
| Deployment | Cloudflare Pages | Auto-deploy on push to main branch |
| Version control | Git push via Claude (Cowork sessions) | GitHub web UI as fallback only — folder is a real clone |
| Storage | Supabase Storage | For test strip images |

**Two separate Cloudflare Pages projects:**
- `poolconnection-app.pages.dev` — the PWA app
- `poolconnection.pages.dev` — the marketing/checkout site

**Domain targets (pending registration):**
- `yourpoolmate.com.au` — marketing site (root domain, for SEO authority)
- `app.yourpoolmate.com.au` — the PWA app (subdomain)
- Also register: `yourpoolmate.app` and `yourpoolmate.com`

---

## BRAND & DESIGN SYSTEM

- **Typography:** Inter (UI text + all body) + Newsreader (headings only)
- **Colour architecture:** Neutral-first tokens. Ocean (#0077B6), Sky (#00B4D8), Foam (#90E0EF) for accents.
- **Logo:** Droplet Node Flat v3 SVG — flat design, Sky-to-Ocean gradient, five-node layout
- **Component pattern:** Notion-influenced, clean, minimal
- **Mode:** Light mode is the consumer default (outdoor Australian sunlight usability)
- **Accessibility:** 44px tap targets, 4.5:1 contrast ratio, system font scaling — non-negotiable

**Tone of voice:**
- Knowledgeable mate who owns a pool. Not a brand. Not a corporate.
- Warm, direct, specific, Australian vernacular where natural
- Never: wishy-washy, corporate jargon, vague, overpromising

---

## WHAT IS BUILT (do not rebuild)

| Feature | Status |
|---------|--------|
| Six-step guest onboarding modal | ✅ Built |
| OCR water test scanner — edge function (`ocr-water-test`) | ✅ Built (June 2026) — scanner UI in app NOT yet built |
| Pool Health Score ring gauge | ✅ Built |
| Smart insight cards | ✅ Built |
| Seasonal task checklist | ✅ Built |
| Chemical addition log | ✅ Built |
| Premium tier gating | ✅ Built |
| Floating feedback widget | ✅ Built |
| 30-day hard-countdown free trial logic | ✅ Built (migration 004) |
| Marketing/checkout page (HTML, Stripe integration) | ✅ Built |

**Highest-priority unwired item:**
The guest onboarding trigger exists but is **not wired into the app flow**. New guests with no pool profile should automatically see the onboarding modal. This is the single highest-conversion-impact fix before launch.

---

## JUNE 2026 REVIEW — FIXES SHIPPED IN THIS FOLDER

| Fix | File | Action needed to go live |
|-----|------|--------------------------|
| **CRITICAL: premium escalation closed** — users could set `is_premium = true` / extend their own trial via the API | `supabase/migrations/004_security_fixes.sql` | Auto-applied by GitHub Action |
| Trial 7 → 30 days (DB + all in-app copy) | same migration + `src/App.jsx`, `src/components/AuthScreen.jsx` | Auto-applied |
| Feedback hardening (auth required, length caps, 10/hour throttle; feedback_rounds size caps) | same migration | Auto-applied |
| **OCR edge function built** — Claude Vision, auth, 10 scans/user/hour (`ocr_calls`, migration 005) | `supabase/functions/ocr-water-test/index.ts` | Auto-deployed by GitHub Action; needs `ANTHROPIC_API_KEY` secret. Scanner UI in the app is NOT yet built — next app task |
| Real PWA: manifest + service worker + PNG icons (app was NOT installable on Android before) | `public/manifest.webmanifest`, `public/sw.js`, `public/icon-*.png`, `index.html`, `src/main.jsx` | Commit to GitHub repo |
| Health Score now scores salt for saltwater/mineral pools | `supabase/functions/calculate-health-score/index.ts` | Redeploy edge function; app should pass `sanitiser_type` in the request |
| Landing page: false claims removed (climate intelligence → warranty records; "unlimited pools" → "complete history"), unsourced $ stats removed, 4.5:1 contrast fix, visible test-mode ribbon, 30-day-trial FAQ | `marketing/index.html` | Commit to marketing repo |
| Privacy + Terms pages (drafts — get them reviewed before launch; Claude is not a lawyer) | `marketing/privacy.html`, `marketing/terms.html` | Commit to marketing repo |

**Deployment model (June 2026 — replaces GitHub web-UI pasting):**
- This folder is a git clone of `github.com/yourconnectionaustralia/yourpoolmate`. Claude commits and pushes directly from Cowork sessions (James provides a GitHub fine-grained token per session — never stored).
- Cloudflare Pages auto-deploys the frontend on push, as before.
- `.github/workflows/supabase-deploy.yml` auto-applies new `supabase/migrations/*.sql` and deploys edge functions on every push that touches `supabase/**`. Migrations 001–003 are baselined (they were applied manually pre-CI).
- Repo migrations 002/003 (feedback_rounds, pool_setup_fields) already existed — the review fixes are migrations **004** and **005**.

**Open actions only James can do:**
1. **Add repo secrets** (GitHub → repo → Settings → Secrets and variables → Actions): `SUPABASE_ACCESS_TOKEN` and `ANTHROPIC_API_KEY`. Then re-run the failed "Deploy Supabase" action.
2. Install the updated skills — click "Save skill" on the five `.skill` files Claude provides (no pasting).
3. Set `CONFIG.TEST_MODE = false` + real Stripe keys before launch (the page shows a warning ribbon until then).
4. **Launch timing decision:** recommendation is warm-up + fixes over winter, founding launch Sep–Oct pre-season, geo-concentrated (Melbourne metro first) so postcode clusters can reach the ≥50-user B2B threshold. A national winter launch fills no clusters and undermines real scarcity.

---

## WHAT IS NOT YET DONE (current priorities in order)

1. **Wire guest onboarding trigger** — auto-display modal for new users with no pool profile
2. **Update all branding from PoolConnection → Your Pool Mate** — name, domains, Supabase Site URL, Stripe account name, GitHub repo description
3. **Register yourpoolmate.com.au + .app + .com** — via VentraIP (Australian-owned registrar)
4. **Register ASIC business name "Your Pool Mate"** — abr.gov.au
5. **Check IP Australia trademark** — search.ipaustralia.gov.au, Class 42
6. **Supabase Site URL fix** — update Site URL in Supabase dashboard + update `signInWithOAuth` to use `redirectTo: window.location.origin`
7. **Live Stripe account** — currently test mode only
8. **Facebook Page** — reserve "Your Pool Mate" handle before launch
9. **Facebook Group warm-up** — 2-week value-posting phase before founder story post
10. **Founding member launch** — Facebook Group soft launch, 200 spots at $79

---

## KNOWN RESOLVED BUGS (do not re-introduce)

- **Supabase auth redirect bug:** was pointing to marketing domain. Fix = `redirectTo: window.location.origin` in `signInWithOAuth` + correct Site URL in Supabase dashboard + explicit `SIGNED_IN` handler in `onAuthStateChange`
- **Indefinite guest mode:** removed. Hard-countdown trial replaces it (now 30 days, June 2026). Never re-introduce indefinite guest access.
- **AppSumo as a channel:** explicitly rejected — wrong audience for a vertical consumer app

---

## HOW JAMES WORKS WITH CLAUDE

- Provides strategic direction; Claude produces complete, deployable outputs
- All code must be **complete files** — never diffs, never partial components, never "add this section"
- Always format code for **GitHub web UI paste** (full file content, clearly labelled with the file path)
- When a major decision changes (name, model, stack, pricing), update this CLAUDE.md and the relevant skill files

---

## INVIOLABLE PRINCIPLES

These are never up for debate within a session:

1. **B2B never before B2C traction** — don't build B2B features until local consumer density exists
2. **Guest trial is 30-day hard countdown** — no indefinite free access, no soft gates (changed from 7 days, June 2026: weekly testing cadence meant a 7-day trial showed users one test and zero trend value)
3. **Light mode is the consumer default** — outdoor Australian usability
4. **RLS on every Supabase table** — no exceptions
5. **Deno, not Node** — all Edge Functions use Deno runtime
6. **Accessibility is pre-launch non-negotiable** — 44px taps, 4.5:1 contrast
7. **Value-led conversion, not urgency-led** — scarcity is real (200 spots), never manufactured panic
8. **Clear water is the outcome, not the motivation** — copy must speak to independence, warranty protection, safety confidence, and asset value — not "keep your pool clean"

---

## SKILL FILES

Domain-specific skills live in the installed plugin. If a skill triggers, read it before producing domain-specific output.

| Skill | Use for |
|-------|---------|
| `poolconnection-app-development` | Any code, components, Edge Functions, DB schema, deployment |
| `poolconnection-business-operations` | Strategy, pricing, model, prioritisation |
| `poolconnection-marketing-growth` | Copy, Facebook posts, SEO content, launch campaign |
| `poolconnection-ux-product` | Screen design, flows, in-app copy, Health Score |
| `poolconnection-master` | Cross-domain decisions, roadmap, project overview |

Updated versions of all skill files are in `/_skill-updates/` in this folder, ready to paste into the skill-creator.
