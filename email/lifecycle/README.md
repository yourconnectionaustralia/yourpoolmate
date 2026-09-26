# Lifecycle email (L1-L7)

Automated mail for Your Pool Mate. Seasonal emails S1-S3 stay manual. Nothing in this folder sends them.

**From:** Your Pool Mate `<hello@mail.yourpoolmate.com.au>`
**Reply-To:** `hello@yourpoolmate.com.au`

Pricing in the copy: 30-day free trial, first 300 members `$79` lifetime, then `$49/year`.

## Allowlist

Resend is called only when `mayCallResend()` is true: the address is on the allowlist and `RESEND_API_KEY` is set.

| `EMAIL_ALLOWLIST` | Who can be mailed |
| --- | --- |
| unset or blank | `yourconnectionaustralia@gmail.com` only |
| `a@example.com, b@example.com` | those addresses, plus the default inbox above |
| `*` or `ALL` (the whole value, nothing else) | everyone eligible. Do not set this until live sends are approved. |

If the address is not allowed, the sender writes `email_sends.status = skipped` and does not call Resend. The sweep does not retry a skipped row. Opening the allowlist later does not backfill old welcomes.

A manual send (below) can retry one skipped row for an address that is now on the allowlist. It still will not send twice after `sent`.

## Secrets

Set these as GitHub Actions secrets, then run **Deploy Supabase** with **workflow_dispatch** so they are copied to the Edge Function. Empty values are skipped. This repo does not contain live keys.

| Secret | Where it is used |
| --- | --- |
| `RESEND_API_KEY` | Edge Function. Required before any real send. |
| `EMAIL_ALLOWLIST` | Edge Function. Optional. Blank keeps the default inbox. |
| `LIFECYCLE_CRON_SECRET` | GitHub Actions and the Edge Function. Same value in both places. Required to call the sweep. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase.

## What sends when

The sweep runs every 15 minutes from `.github/workflows/lifecycle-email-sweep.yml` once that file is on `main` and the cron secret is set. It sends at most 20 messages per run, and at most one template per person per run.

| Email | When |
| --- | --- |
| L1 Welcome | Account created in the last 7 days |
| L2 First-test nudge | Day 2 to day 7, no water test, trial still open, and at least a day after L1 was recorded |
| L3 After first test | First test is between 15 minutes and 7 days old |
| L4 Mid-trial | About day 14 of a normal 30-day trial, still unpaid |
| L5 Trial ending | About day 27 of a normal 30-day trial, still unpaid |
| L6 Paid thanks | Straight after a paid checkout (Stripe webhook). The sweep retries a missed L6 from 10 minutes to 7 days after `premium_since` |
| L7 Referral | 3 or more tests (the third is 1 to 21 days old) or paid 2 to 21 days ago, and at least 2 days after any L6 row. Once only |

Founding paragraphs in L1, L4, and L5 render only when `user_profiles.founding_member` is true.

L4 and L5 do not send while the open beta has stretched `trial_ends_at` well past 30 days. The copy says the 30-day trial is halfway through, or ending in about three days, and that would be wrong during the beta.

People who already had an account when this ships are outside these windows, so the first sweep does not mail the existing beta base.

## How to test L1 to the allowlisted Gmail

Do this only after the pull request is merged. Merging deploys the functions. It does not apply the database migration. Do not expect a customer blast: the default allowlist is one inbox.

1. GitHub → Settings → Secrets and variables → Actions. Add `RESEND_API_KEY` and `LIFECYCLE_CRON_SECRET` (a long random string). Leave `EMAIL_ALLOWLIST` empty unless you want extra test addresses.
2. Actions → **Deploy Supabase** → Run workflow. That applies migration `016_lifecycle_emails.sql` and copies the secrets onto the Edge Function. A normal push does not apply the migration.
3. Confirm `yourconnectionaustralia@gmail.com` exists as a user (Authentication → Users). Copy the user UUID.
4. Send L1 once, to that user only:

```bash
curl -sS -X POST \
  "https://chmjvbuesynicrmtkrqp.supabase.co/functions/v1/send-lifecycle-email" \
  -H "Authorization: Bearer $LIFECYCLE_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"send","template":"L1","user_id":"PASTE-UUID"}'
```

5. Check the Gmail inbox (and spam). In the SQL editor, `select template_key, status, provider_id, error from email_sends where user_id = 'PASTE-UUID';` should show `L1` / `sent`. A second call returns `already` and does not send again.

If the address was already marked `skipped`, the manual send above will try once more now that it is allowlisted. The sweep will not.

To exercise the timer instead of a one-off send, use Actions → **Lifecycle email sweep** → Run workflow. That only mails people who are inside a window and on the allowlist.

## Files

- `email/lifecycle/` - approved copy
- `supabase/functions/_shared/lifecycle-templates.js` - HTML and plain text actually sent
- `supabase/functions/_shared/lifecycle-rules.js` - windows and allowlist
- `supabase/functions/send-lifecycle-email/index.ts` - sweep and manual send
- `supabase/functions/stripe-webhook/index.ts` - L6 after premium is granted
- `supabase/migrations/016_lifecycle_emails.sql` - `email_sends` ledger
