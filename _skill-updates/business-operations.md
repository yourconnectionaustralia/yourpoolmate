---
name: poolconnection-business-operations
description: >
  Use this skill for ALL business, financial, strategic, and operational decisions for
  Your Pool Mate. Triggers on: pricing decisions, revenue modelling, B2B flywheel planning,
  cohort analysis, subscription metrics, churn, unit economics, legal/terms questions, investor
  framing, roadmap prioritisation, or any request to evaluate a strategic option. Also triggers
  on phrases like "is this worth building", "what should I prioritise", "how does the business
  model work", "B2B pool shops", "unit economics", "revenue forecast", "should I do X", or
  "what's the plan". Always use this skill before making any strategic or financial decision
  for Your Pool Mate — the model, sequencing, and flywheel logic here must be preserved across
  every decision.
---

# Your Pool Mate — Business Operations Skill
**Version:** 2.0 | **Rebrand:** PoolConnection → Your Pool Mate (May 2026)

This skill governs strategic, financial, and operational decisions for Your Pool Mate.
Apply before advising on any business decision, model, or priority.

---

## BUSINESS MODEL

Your Pool Mate is a **two-sided local marketplace** with a sequential but partially overlapping build:

```
Phase 1: B2C consumer adoption
    ↓ (creates an audience of verified, engaged pool owners by postcode)
Phase 2: B2B paid shop listings — PRIMARY B2B revenue
    ↓ (shops pay for premium positions in the "find a shop near me" directory)
Phase 3: B2B data intelligence — SECONDARY B2B value
    ↓ (shops gain anonymised demand signals from local user base)
Phase 4: Closed-loop marketplace (in-app bookings, product purchases)
```

**Primary B2B sell:** Paid directory placement — shops buy position 1, 2, or 3 in the "Shop Near Me" listing. Same model as Google local search ads: intent-driven, proximity-ranked, tiered pricing.

**Secondary B2B sell:** Data intelligence — anonymised local chemical demand trends. Valuable, but requires B2C data density first. Lead with listings. Follow with data.

---

## REVENUE MODEL

### B2C Revenue (current)

| Stream | Price | Unit | Notes |
|--------|-------|------|-------|
| 30-day hard trial | Free | — | Hard block at expiry |
| Founding Member LTD | $79 AUD | once-off | Capped at 200 spots |
| FOMO close | $99 AUD | once-off | ~175 spots trigger |
| Annual subscription | $39 AUD | per year | Permanent post-LTD |

### B2B Revenue (Phase 2+)

| Tier | Position | Price | Notes |
|------|----------|-------|-------|
| Position 1 | Top of "Shop Near Me" list | $149 AUD/month | Exclusive per postcode cluster |
| Position 2 | Second listing | $99 AUD/month | Exclusive per postcode cluster |
| Position 3 | Third listing | $69 AUD/month | Exclusive per postcode cluster |
| Organic | Below paid (proximity-sorted) | Free | All registered shops appear organically |
| Data Intelligence add-on | Dashboard + local demand signals | $49 AUD/month | Upsell after 30+ days of listing |

**Postcode cluster:** ~5km radius cluster. 3 paid positions per cluster. Scarcity is real and geographic.

**Pitch threshold:** ≥ 50 active users in the shop's postcode cluster. Never pitch earlier.

**ROI story:** Position 1 at $149/month = $1,788/year. One extra customer per month breaks even immediately.

---

## STRATEGIC SEQUENCING (locked)

1. **B2C product-market fit** — trial users find genuine value, health score is trusted
2. **Founding member LTD launch** — Facebook Groups, 200 spots, $79
3. **Domain + SEO foundation** — `yourpoolmate.com.au` registered, marketing site live
4. **Subscription conversion** — LTD closes, $39/year becomes default
5. **"Shop Near Me" feature live** — directory built in-app, all shops appear organically (free), proximity-sorted
6. **B2B listing sales begin** — pitch paid positions to shops in areas with ≥ 50 local users
7. **B2B data intelligence upsell** — once listing shops are retained 30+ days, offer data dashboard
8. **Closed-loop marketplace** — in-app product/service transactions via listed shops

---

## B2B FLYWHEEL LOGIC

### Primary sell — Paid Directory Listings

When a consumer opens "find a shop near me":
```
[AD] Position 1 — Aqua Blue Pool Supplies, Blackburn (2.1km) ★★★★☆
[AD] Position 2 — Pool World, Box Hill (3.4km) ★★★★★
[AD] Position 3 — Clear Water Pools, Nunawading (4.0km) ★★★☆☆
─────────────────────────────────────────────────────────────────
Organic — Swimart Ringwood (5.2km)
Organic — Pool & Spa Warehouse (6.8km)
...
```

**The shop pitch (one sentence):** "Pool owners near you are already searching for shops in the app — lock in your position before your competitor does."

### Secondary sell — Data Intelligence Dashboard

Only offered after 30+ days of a paid listing. Shows:
- Chemical deficiency trends in their postcode cluster this month
- Pool size distribution of local users
- Seasonal demand spikes
- Anonymised test result trends

**Pricing:** $49/month add-on to any paid listing tier. Never sold standalone.

### The compounding flywheel
```
More consumers use app in postcode →
  Postcode cluster becomes more valuable to shops →
    Shops compete for paid positions (scarcity drives price) →
      Shops use data to stock better + serve app users better →
        App users get better shop experiences → retention improves →
          More consumers → (repeat)
```

---

## STRATEGIC DIFFERENTIATOR: WARRANTY ANGLE

Australian pool warranties require documented water chemistry records:
- Builders Installation Warranty: 6–7 years structural, 2 years non-structural
- Equipment manufacturers (Pentair, Zodiac, Astral) explicitly require chemistry logs
- Pool shops don't give owners a useful copy of test results
- **Your Pool Mate does.** Timestamped, exportable water test history.

No competitor has claimed this positioning. It is blue-ocean. Use it in every conversion context.

---

## PRIORITISATION FRAMEWORK

| Criterion | Weight | Question |
|-----------|--------|----------|
| Trial conversion impact | 40% | Does this help trial users hit their "aha moment" faster? |
| Retention impact | 30% | Does this make the app indispensable over a pool season? |
| Data density contribution | 20% | Does this generate richer data for the future B2B flywheel? |
| Effort | 10% | Can James build this alone in < 1 week? |

**Current top priorities (in order):**
1. Wire guest onboarding trigger (auto-display for new users with no pool profile)
2. Register `yourpoolmate.com.au` + launch marketing site
3. 30-day trial paywall enforcement + LTD purchase flow
4. Facebook Group founding member launch

---

## OPERATIONAL DEFAULTS

- **Solo founder:** All decisions must be executable by James alone, or clearly delegated to Claude
- **No VC, no employees:** Bootstrap discipline — build revenue before building team
- **Tools:** Supabase dashboard, Cloudflare Pages, GitHub web interface, Claude
- **Customer support:** Manual (email/DM) until 500+ users
- **Analytics:** Supabase query-based initially; consider PostHog when B2B tier launches

---

## RISKS & MITIGATIONS

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Trial users don't convert to LTD | Medium | Improve onboarding → Health Score aha moment |
| PWA-only creates app store friction | High | Acknowledged — SEO + Facebook compensate; warranty angle reduces friction |
| Shops don't see enough user traffic | Medium | Pitch only when ≥ 50 local users; show user count in pitch |
| Founding member spots fill too slowly | Medium | Community warm-up before launch, authentic scarcity |
| Data privacy (pool water data) | Low | Supabase RLS, anonymised B2B data, clear privacy policy |

---

## SELF-IMPROVEMENT LOG

| # | Date | Correction / Learning | Impact |
|---|------|-----------------------|--------|
| 1 | Init | AppSumo rejected — validates vertical consumer app ≠ SaaS tool audience | Channel strategy |
| 2 | Init | Indefinite guest mode is a conversion leak — replaced with 7-day hard trial | Retention model |
| 3 | Init | B2B sequenced strictly after B2C — never build B2B features prematurely | Roadmap |
| 4 | Init | PWA-only is a discovery friction point — acknowledged but not yet resolved | Risk register |
| 5 | Apr 2026 | B2B primary sell is paid directory listings (positions 1/2/3), NOT data — data is secondary | Entire B2B model |
| 6 | May 2026 | Rebrand: PoolConnection → Your Pool Mate. ICP age updated: 55–70. Warranty angle added. | All |
| 7 | Jun 2026 | Trial 7→30 days (weekly test cadence meant 7 days showed one test — no trend value before paywall). Launch re-timed: winter = warm-up + fixes, founding launch Sep–Oct pre-season, geo-concentrated (Melbourne metro first) so postcode clusters reach the ≥50-user B2B threshold | Trial, launch plan, B2B flywheel |
