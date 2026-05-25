---
name: poolconnection-ux-product
description: >
  Use this skill for ALL UX, product design, user experience, onboarding, feature design,
  and user journey decisions for Your Pool Mate. Triggers on: designing a new screen or flow,
  reviewing an existing UX, planning onboarding improvements, deciding how a feature should
  behave, writing in-app copy (tooltips, empty states, error messages, CTAs), defining the
  Health Score display, or evaluating any user-facing decision. Also triggers on phrases like
  "how should this work", "what should the user see", "improve the onboarding", "in-app copy",
  "empty state", "error message", "Health Score", "user flow", or "UX review". Always use this
  skill before designing any screen or writing any in-app copy — the user mental model, core
  flows, and micro-copy principles here must be consistent across every interaction.
---

# Your Pool Mate — UX & Product Skill
**Version:** 2.0 | **Rebrand:** PoolConnection → Your Pool Mate (May 2026)

This skill governs all UX, product design, and user experience decisions for Your Pool Mate.
Apply it before designing any screen, writing any in-app copy, or making any feature decision.

---

## USER MENTAL MODEL

Pool owners (55–70 years old, Australian) think about their pool in these terms (in order of awareness):

1. **"Is my pool safe to swim in?"** — chlorine, pH (immediate safety — grandchildren)
2. **"Why does it look green/cloudy/foamy?"** — visible problems first
3. **"What do I add and how much?"** — action oriented, not chemistry-curious
4. **"Am I spending too much at the shop?"** — cost consciousness after trust builds
5. **"Is my warranty protected?"** — anxiety about documentation surfaces after onboarding

Your Pool Mate must meet users at level 1 and 2, then graduate them to 3 and 4.
Never lead with chemistry education — lead with the answer.

---

## THE HEALTH SCORE

The Health Score is the core value delivery mechanism. It must:

- Be the **first thing a user sees** after completing their water test entry
- Be a **single number (0–100)** with a colour status: 🟢 Great / 🟡 Needs attention / 🔴 Act now
- Show **what's wrong** (not just the score) — e.g. "pH is too low"
- Show **what to do** — e.g. "Add 200g of sodium carbonate"
- Be **explainable in plain English** — no jargon unless tapped for detail
- Update **immediately** when readings change — real-time feedback loop

**Health Score calculation inputs (in weighted order):**
1. Free chlorine (35% weight) — most critical for safety
2. pH (25%) — affects everything else
3. Total alkalinity (20%) — pH stability buffer
4. Cyanuric acid (10%) — chlorine protection outdoors
5. Calcium hardness (10%) — equipment protection

---

## CORE USER FLOWS

### 1. First-time user (trial start)
```
App open → 7-day trial start screen (countdown visible) →
Guest onboarding (6 steps) → Health Score preview →
"Complete setup to get your real score" CTA → Account creation
```

### 2. Returning user (water test entry)
```
Dashboard → "Log water test" →
[Option A] Manual entry → readings form →
[Option B] Scan test results → camera → OCR auto-fill → confirm →
Health Score update → dosing recommendations → done
```

### 3. Trial expiry
```
Day 7: Hard block screen → "Your trial has ended" →
Founding member offer (if spots remain) OR subscription CTA →
No access until payment (no soft gates, no "remind me later")
```

### 4. Shop test photo (OCR trust bridge)
```
"I just got a test from my pool shop" → scan CTA →
Camera opens → photo → OCR extracts readings →
"Here's what your shop found" + Health Score →
"Here's what you actually need to add" (may differ from shop advice)
```

---

## ONBOARDING FLOW (6 steps — built)

| Step | Content | Skippable? |
|------|---------|-----------|
| 1 | Welcome + value prop (health score + warranty protection) | No |
| 2 | Pool basics (shape, volume calculator) | No — required for dosing |
| 3 | Sanitisation system (chlorine type) | No — required for dosing |
| 4 | Equipment (pump, filter, heater) | Yes — enhances but not required |
| 5 | Water test readings | Yes — can enter later |
| 6 | Completion + Health Score preview | No |

**Pending:** Auto-trigger this flow for any guest user with no pool profile.
This is the single highest-conversion-impact fix before launch.

---

## IN-APP COPY PRINCIPLES

**Voice:** Direct, warm, never condescending. Like a knowledgeable mate.

| Situation | Do | Don't |
|-----------|-----|-------|
| Empty state (no test logged) | "Log your first water test to see your Health Score" | "No data available" |
| Error (OCR failed) | "Couldn't read that photo — try again in better light" | "Error 422: OCR processing failed" |
| Success | "Your pool is looking great. pH and chlorine are spot on." | "Test recorded successfully." |
| Dosing instruction | "Add 150g of sodium bicarbonate to raise your alkalinity" | "Alkalinity adjustment required: +1.2 mEq/L" |
| Trial countdown | "5 days left in your free trial" | "Trial expires in 120 hours" |
| Warranty prompt | "Every test is saved to your warranty record" | "Data stored in database" |

**Micro-copy rules:**
- Chemical names: use the common name first, technical name in brackets for detail view
- Volume: always in grams for solids, millilitres for liquids (Australian convention)
- Dates: DD/MM/YYYY (Australian convention, never MM/DD)
- Never use "purchase" — use "join" or "get access"
- Never use "subscribe" in founding member context — use "become a founding member"
- Warranty angle: surface naturally at test completion ("Saved to your warranty record ✓")

---

## SCREEN-LEVEL UX PATTERNS

### Cards (water test results)
- Colour coded by status: green/amber/red
- Reading + target range visible at glance
- Tap to expand → explanation + action

### Dosing recommendations
- Show chemical name + weight/volume
- "Why?" expand for explanation
- "Done" to mark as actioned (builds history + warranty record)

### Loading states
- Never blank — show skeleton/shimmer
- OCR scan: progress indicator ("Reading your test results...")
- Health Score calculation: animated score reveal (moment of delight)

### Error recovery
- Always offer a next step — never dead ends
- OCR fail → "Enter manually instead" always visible
- Network error → "We'll sync when you're back online" (PWA offline capability)

### Accessibility (non-negotiable)
- 44px minimum tap targets on all interactive elements
- 4.5:1 contrast ratio minimum
- System font scaling support (user's device font size respected)
- Light mode default — outdoor Australian sun usability

---

## FEATURE EVALUATION CRITERIA

Before adding any new feature, answer:
1. Does it help the user understand their pool faster? (Core job)
2. Does it reduce friction in the water test → dosing workflow? (Core loop)
3. Does it work on a 375px mobile screen in bright sunlight? (Context)
4. Can James build it solo in < 1 week? (Capacity)
5. Does it generate data useful for the future B2B flywheel? (Strategic bonus)
6. Does it contribute to the warranty record value proposition? (Retention bonus)

If the answer to #1 and #2 is no, don't build it yet.

---

## SELF-IMPROVEMENT LOG

| # | Date | Correction / Learning | Applied To |
|---|------|-----------------------|------------|
| 1 | Init | Equipment + readings steps in onboarding are skippable — never block on optional data | Onboarding |
| 2 | Init | OCR is a "trust bridge" — shop test photo flow should feel like validation, not competition | OCR UX |
| 3 | Init | 7-day trial must be a hard block at expiry — no soft gates or "remind me later" | Trial UX |
| 4 | Init | Light mode is consumer default — outdoor usability in Australian sun is non-negotiable | All screens |
| 5 | May 2026 | Rebrand: PoolConnection → Your Pool Mate. ICP: 55–70. Warranty angle surfaces in-app at completion. | All |
