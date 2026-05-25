---
name: poolconnection-master
description: >
  Use this skill when a request spans multiple domains of Your Pool Mate (e.g. a feature that
  touches both app development AND marketing, or a decision that affects both UX AND business
  strategy). Also use when James asks for a project overview, a cross-functional plan, a
  prioritised roadmap, or says "what should I focus on". Triggers on: "what's next", "project
  overview", "roadmap", "everything is connected", "how does it all fit together", "master
  plan", or any prompt where two or more of the four Your Pool Mate skill domains are implicated.
  This skill coordinates the other four — it doesn't replace them, it routes and sequences them.
---

# Your Pool Mate — Master Coordination Skill
**Version:** 2.0 | **Rebrand:** PoolConnection → Your Pool Mate (May 2026)

This is the coordination layer. It maps how the four domain skills relate and when to use each.
For any task, identify the domain(s) involved, load the relevant skill(s), and apply them together.

---

## THE FOUR SKILLS AND THEIR DOMAINS

| Skill | Domain | Load when... |
|-------|--------|-------------|
| `poolconnection-app-development` | Code, stack, deployment | Writing code, building features, fixing bugs |
| `poolconnection-marketing-growth` | Copy, channels, launch | Writing for customers, planning growth |
| `poolconnection-business-operations` | Strategy, model, metrics | Making decisions, evaluating options |
| `poolconnection-ux-product` | Flows, screens, copy | Designing UX, writing in-app text |

---

## CROSS-DOMAIN COORDINATION RULES

Some tasks touch multiple domains. Apply ALL relevant skills, in this order:

1. **Business Operations** → Is this worth doing? Does it fit the strategy?
2. **UX/Product** → How should it work for the user?
3. **App Development** → How do we build it?
4. **Marketing/Growth** → How do we communicate it?

Example: "Add a referral feature"
→ Business Ops: Does referral fit current phase? (No — too early, B2C volume not there yet)
→ Stop here and defer.

Example: "Wire the guest onboarding trigger"
→ Business Ops: Yes — highest conversion impact fix
→ UX: Auto-detect guest with no pool profile → display modal
→ App Dev: Check for pool profile in `useEffect` on mount, dispatch modal if null
→ Marketing: N/A (internal flow)

---

## CURRENT PROJECT STATE (update when major milestones hit)

| Domain | Status | Next action |
|--------|--------|-------------|
| App | Trial + onboarding built; OCR complete; all major features built | **Wire guest onboarding trigger** (highest priority); rebrand all PoolConnection references |
| Marketing | Channels identified; copy templates ready; brand renamed | Register yourpoolmate.com.au; reserve Facebook Page; 2-week warm-up; founder story post |
| Business | LTD model locked; B2B = listing-first; warranty angle confirmed as primary differentiator | Execute founding member launch; register business name; trademark search |
| UX | 6-step onboarding built | Auto-trigger onboarding for new guests; surface warranty angle at test completion |

---

## LAUNCH CHECKLIST (cross-domain)

### Before first user signs up
- [ ] Wire guest onboarding trigger (App Dev)
- [ ] Update all PoolConnection branding → Your Pool Mate (App Dev)
- [ ] Fix Supabase Site URL (App Dev)
- [ ] Register yourpoolmate.com.au + .app + .com (Operations)
- [ ] Register ASIC business name "Your Pool Mate" (Operations)
- [ ] Trademark search IP Australia Class 42 (Operations)

### Before founding member launch
- [ ] Live Stripe account (not test mode) (App Dev)
- [ ] Marketing site live at yourpoolmate.com.au (App Dev + Marketing)
- [ ] Facebook Page "Your Pool Mate" reserved (Marketing)
- [ ] 2-week Facebook Group warm-up complete (Marketing)

### Launch day
- [ ] Founder story post — Facebook Groups (Marketing)
- [ ] Monitor spots sold → FOMO post at ~175 (Marketing)
- [ ] Close LTD at 200 → transition to $39/year (Business + App Dev)

---

## STRATEGIC DIFFERENTIATORS (use in every domain)

1. **Warranty protection** — timestamped water test history, exportable. No competitor has this.
2. **OCR shop test scanner** — bridge between pool shop and independent action
3. **Health Score** — single number replaces complex chemistry confusion
4. **Shop Near Me** — future B2B surface; proximity-ranked with paid positions

---

## CROSS-DOMAIN SELF-IMPROVEMENT LOG

| # | Date | Cross-domain learning | Skills updated |
|---|------|-----------------------|---------------|
| 1 | Init | PWA-only is a discovery friction point — affects marketing AND business AND UX | All three |
| 2 | Init | OCR shop test photo is the primary trust bridge — affects UX, marketing, app | App, UX, Marketing |
| 3 | Apr 2026 | B2B primary revenue is paid directory listings (not data). Changes: Business, UX, Marketing, App | All four |
| 4 | May 2026 | Rebrand PoolConnection → Your Pool Mate. ICP: 55–70. Warranty angle added as primary differentiator. | All four |

---

## INSTRUCTIONS FOR UPDATING ALL SKILLS

When a major strategic decision changes:
1. Update this master skill's project state table
2. Identify which domain skills are affected
3. Update each affected skill's relevant section
4. Add a row to this log AND to each affected skill's self-improvement log
5. Update CLAUDE.md in the project folder
