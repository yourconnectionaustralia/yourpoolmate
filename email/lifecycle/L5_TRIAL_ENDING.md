# L5 - Trial ending

**Subject:** Your trial ends in a few days - here's the choice
**Preview (founding member):** First 300 keep $79 lifetime. After that it's $49/year.
**Preview (not founding):** After the trial, access is $49/year.
**Trigger:** About day 27, still unpaid, and the trial length is about 30 days
**From (API):** Your Pool Mate `<hello@email.yourpoolmate.com.au>`
**Reply-to:** `hello@yourpoolmate.com.au`
**CTA:** Lock in access → https://app.yourpoolmate.com.au

## Plain text (founding member)

Hi {{first_name|there}},

Your 30-day Your Pool Mate trial ends in about three days.

If the app's been useful - clearer water tests, Health Score, and plain-English next steps - you can keep it. Here's how.

- Founding (while under 300 paid members): $79 once, lifetime access
- After founding is full: $49/year

Open the app to lock in (or keep using the trial until it ends):
https://app.yourpoolmate.com.au

No card was required to start the trial. If you do nothing, access ends when the trial does - no surprise charge.

If you have any questions, reply to this email.

- James
Your Pool Mate
hello@yourpoolmate.com.au

## Plain text (not a founding member)

Same email, with only this price line:

- After founding is full: $49/year

The `$79` line is omitted. Open-beta extensions do not receive L5.

HTML for both variants is rendered by `supabase/functions/_shared/lifecycle-templates.js`.
Skip anyone who has already paid.
