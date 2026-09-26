# L6 - Paid thanks / Welcome aboard

**Subject:** Welcome aboard - here's what happens next
**Preview:** Access is active. A quick note on what to do from here.
**Trigger:** Paid checkout only. Not trial start. Not a renewal.
**From (API):** Your Pool Mate `<hello@email.yourpoolmate.com.au>`
**Reply-to:** `hello@yourpoolmate.com.au`
**CTA:** Open the app → https://app.yourpoolmate.com.au

Merge fields:

- `{{first_name|there}}`
- `{{plan_label}}` → "Founding lifetime ($79)" or "Yearly ($49/year)"
- `{{amount_aud}}` → "$79.00 AUD" or "$49.00 AUD"
- receipt URL when Stripe returns an https link. The line is omitted when it does not.

## Plain text

Hi {{first_name|there}},

Welcome aboard. Thanks for joining Your Pool Mate.

Here's what happens next: your access is active now. Keep adding water tests when you check the pool - Health Score and plain-English next steps get clearer the more history you have.

Open the app: https://app.yourpoolmate.com.au

For your records: {{plan_label}} · {{amount_aud}}
Receipt: {{receipt_url}}

Omit that receipt line entirely when there is no https receipt.

If anything looks off with billing or the account, reply to this email. It comes to me.

- James
Your Pool Mate
hello@yourpoolmate.com.au

HTML for this body is rendered by `supabase/functions/_shared/lifecycle-templates.js`.
The Stripe webhook calls the sender after premium is granted. A mail failure does not undo the grant.
