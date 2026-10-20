# Your Pool Mate v3 — staging features, built for launch (Oct 2026)

## What this is

The staging build (`yourpoolmate-x-staging` Cloudflare Worker) is a separate Next.js app. It
stores everything in the phone's browser storage, fakes the Stripe checkout and keeps emails in a
mock outbox. It has the features we want, but it can't replace the live app as it stands: live
members' accounts, tests, payments and warranty records are in Supabase.

v3 takes the staging features into the live app (Vite + React + Supabase + Stripe, the locked
stack), so existing members keep their data and the paywall keeps working.

## What's new for members

| Feature | Where | Notes |
|---|---|---|
| **Safe-to-swim call** | Home, under the score | "Safe to swim", "Hold off", "Test again before swim day". Conservative: FC under 1 or over 5, pH out of band, score under 60 or a stale test all say wait. |
| **Next dose, one tap** | Home | "I added 520 mL hydrochloric acid" straight from Home. |
| **Plan tab** | Bottom nav + sidebar | Steps in balancing order. Each step offers *I added it*, *I added a different amount* (with "expect pH of about 7.5"), or *I haven't bought it yet* (adds it to the shopping list). Shows safety, the wait before re-testing, and why the steps come in that order. |
| **Ticks follow the member** | Plan | Ticks are saved with the dose in the history (test + step), not in one phone's storage. Undo removes the dose. |
| **Month-aware chlorine aim** | Plan | Aims 2.5 ppm in high-UV months and 1.5 in cool winter months. The acceptable band stays 1–3. The state comes from the member's postcode. |
| **Chlorinator first** | Plan, salt pools | Estimates what the cell makes from its size, output %, pump hours, the month's temperature and the salt level, then says "turn it up to 80% for 8 hours" before suggesting liquid chlorine. |
| **Chloramine shock** | Plan | With total chlorine entered, combined chlorine of 0.5+ becomes a shock step. Total chlorine is now on the test form and read by the scanner. |
| **Balance index (LSI)** | Plan | Labelled: balanced, slightly corrosive or scale-forming. |
| **My Shed** | More / sidebar | What's on hand, with a gauge. Doses draw from it automatically and the plan says "you have enough — don't buy more". Low-stock warning at under 3 weeks of the member's own usage. |
| **Receipt scan** | My Shed | Photograph a pool-shop receipt. Lines are read (same scanner function, same 10/hour limit), matched to products and checked by the member before anything is saved. |
| **Shopping list** | More / sidebar | Plan shortfalls are suggested, plus the member's own items, rounded up to the pack size they last bought. *Send the list* opens the phone's share sheet. *Bought → put it in My Shed*. |
| **Costs** | More / sidebar | 30 days / 90 days / 12 months, by week or month, and where the money went. Every dollar is from a price the member typed. Unpriced and free steps are counted, not priced. |
| **Last 30 days** | Home | Average score and doses, against the 30 days before. |
| **This month** | Home | Typical temperature, UV and pump hours for the member's state, and pool turnover time. Labelled as long-term averages, never a forecast. |
| **Share a report link** | Chemistry log | Read-only report (last 12 tests, doses in the last 90 days) that opens with no account. Name, email and address are left out. |
| **Pinned shortcuts** | More drawer ★ → Home | Up to 6. Saved to the account. |
| **Pump and chlorinator settings** | Pool setup | Daily hours (or by season), timer note, output %, cell size. |

## Where v3 goes further than staging (and why)

1. **Real accounts, not browser storage.** Staging loses everything when Safari clears site data
   or the member changes phones. That's fatal for a product whose pitch is a warranty record.
2. **Stock is never stored as a running balance.** Stock left = bought − what doses drew. Undoing
   a dose, or deleting one from the history, puts the stock back. Staging kept a running number
   that could drift.
3. **Costs are frozen at dose time.** Each dose stores its own cost, so deleting a shed item later
   doesn't change past spending.
4. **Receipts are read by the scanner, not on the phone.** Staging bundled a 7 MB on-device OCR
   with a "practice receipt". Claude Vision reads real receipts far better, and nothing is saved
   until the member confirms each line. The photo isn't kept.
5. **State from the postcode.** Staging asked for the state separately. v3 works it out from the
   postcode members already enter in Profile.
6. **Climate figures per capital city.** Staging shifted Melbourne's numbers by a fixed amount for
   each state. v3 has a monthly table for each capital and labels it as averages.
7. **Shopping list is a live view of the plan.** Suggestions come from the current plan and shed,
   so stale "shortfall" rows can't pile up. Only items the member chooses are stored.
8. **Chlorinator text can't contradict itself.** Staging could say the cell made more than a
   typical day needs, then tell the member to turn it up. Fixed and tested.
9. **Salt pools aren't told to buy liquid chlorine** when turning the chlorinator up covers it.
10. **Report link is private by design.** The report sits after `#` in the URL, so it never
    reaches a server or its logs, and there's nothing to revoke or leak.
11. **Safe before the migration runs.** Until migration 021 is applied, doses save the way they
    always did and Shed / Shopping list say "Nearly ready". Nothing errors.
12. **One dose engine.** The plan logic moved out of the 3,400-line `App.jsx` into
    `src/lib/plan.js`, with tests. Dose factors are still only in `dosing.js`, which the marketing
    calculator shares.
13. **Score colours agree.** The ring and history tags used 50 as the "act now" line while the
    other ring used 60. All now use 60, matching the swim call.

## Left out on purpose (staging-only tooling)

Demo pool / reset, mock email outbox, the "preview paywall" switch, invite links, the `/admin`
tester dashboard, crash reporting to D1, and the screen-pinning feedback mode. Live already has
real emails (Resend), a real paywall and the Feedback panel.

## Launch checklist (James)

1. **Merge the PR.** Cloudflare Pages deploys the app. The scanner function redeploys by itself
   (it reads receipts now).
2. **Apply migration 021:** GitHub → Actions → *Deploy Supabase* → *Run workflow*. It adds
   `shed_items` and `shop_items` (owner-only RLS), dose detail on `pool_events`, pump settings on
   `pool_profiles` and `app_prefs` on `user_profiles`. Preflight checks the new columns.
3. **Smoke test on your phone:** log a test → Home shows the swim call and next dose → tap it →
   Plan shows "1 of N added" → Undo → *I haven't bought it yet* → Shopping list → Bought → put it
   in My Shed → Costs. Share a report link from the Chemistry log and open it in a private window.
4. **Members without a postcode** see Melbourne figures, with a prompt to add their postcode in
   Profile.

## Tests

`node --test src/lib/*.test.js supabase/functions/_shared/*.test.js` — 195 passing (plan, shed,
report link and the existing suites). `npm run build` is clean. The flows above were run in
Chromium at 390 px and 1280 px against an in-memory database, with and without migration 021.
