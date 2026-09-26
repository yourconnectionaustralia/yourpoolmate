# Your Pool Mate - lifecycle email plan

**From (API / auto):** Your Pool Mate `<hello@mail.yourpoolmate.com.au>`
**From (manual Gmail):** `hello@yourpoolmate.com.au`
**Reply-to:** `hello@yourpoolmate.com.au`
**Tone:** clear Australian mate - calm, practical, no hype, no unbuilt features
**Pricing:** 30-day free trial, first 300 at `$79` lifetime, then `$49/year`. No `$99` bump.
**Send gate:** allowlist only until live sends are explicitly approved. See `README.md`.

## Principles

- Short. One job per email.
- Always a single primary CTA.
- Prefer usefulness over engagement.
- Referral asks only after a clear win (first tests, or paid).
- Seasonal emails are manual, to existing users only, never cold.

## Map

| # | Email | Trigger | Timing | Goal | Status |
| --- | --- | --- | --- | --- | --- |
| L1 | Welcome | Account created / trial start | Next sweep (about 15 min) or a manual send | Orient + first action | Approved, allowlisted |
| L2 | First-test nudge | No water test after signup | Day 2, after L1 has settled | Get the first reading in | Approved, allowlisted |
| L3 | After first test | First successful test | 15 min to 7 days after that test | Reinforce the habit + Health Score | Approved, allowlisted |
| L4 | Mid-trial | Trial day 14, unpaid, normal 30-day trial | Day 14 | Value recap + founding reminder | Approved, allowlisted |
| L5 | Trial ending | Trial day 27, unpaid, normal 30-day trial | Day 27 | Clear choice: `$79` founding / later `$49/year` | Approved, allowlisted |
| L6 | Paid thanks | Checkout completed | Webhook, after premium is granted | Welcome + what happens next | Approved, allowlisted |
| L7 | Referral ask | 3+ tests or paid | Once, at least 2 days after L6 | Share with one pool-owner mate | Approved, allowlisted |
| S1 | Seasonal - spring open | Manual | Sep-Oct AU | Opening checklist | Approved, not automated |
| S2 | Seasonal - summer peak | Manual | Dec-Jan AU | Heat / chlorine cadence | Approved, not automated |
| S3 | Seasonal - autumn wind-down | Manual | Mar-Apr AU | Lower frequency tips | Approved, not automated |

## Not in v1

- Weekly digests
- Abandoned-cart mail beyond L5
- Shop Near Me / B2B emails
- Anything from `noreply@`
- Automating S1-S3
