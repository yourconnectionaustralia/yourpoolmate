# Stripe Integration — TODO

Single source of truth for the remaining Stripe Checkout setup for Your Pool Mate.

## Values to Replace

**None.** The existing Checkout Session call already uses real values for every
`sample_only` parameter, and they've been kept as they were:

**File:** [supabase/functions/stripe-checkout/index.ts](supabase/functions/stripe-checkout/index.ts)

| Field | Current Value | Notes |
|-------|--------------|-------|
| mode | `payment` (founding, first 300) / `subscription` (everyone else) | Chosen server-side from `user_profiles.founding_member`. |
| success_url | `${APP_URL}?checkout=success&session_id={CHECKOUT_SESSION_ID}` | `APP_URL` secret, default `https://app.yourpoolmate.com.au`. |
| cancel_url | `${APP_URL}?checkout=cancelled` | Same. |
| line_items | Inline `price_data`: AUD $79 once / AUD $49 per year | No Stripe Price IDs needed. |

## Configured Parameters

These come from Checkout Studio and are already set.

**File:** [supabase/functions/stripe-checkout/index.ts](supabase/functions/stripe-checkout/index.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` |
| billing_address_collection | `auto` |
| phone_number_collection.enabled | `false` |
| automatic_tax.enabled | `false` |
| allow_promotion_codes | `true` |
| payment_method_collection | `always` (subscription mode only) |
| submit_type | `pay` (payment mode only, because Stripe rejects it on subscriptions) |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |
| branding_settings | background `#ffffff`, button `#0b7799`, font `default`, border `rounded` (logo removed, see below) |

### Two things to check on the first test checkout

1. **`ui_mode: hosted_page` and the API version.** The function calls the Stripe REST API
   directly. It doesn't use an SDK and doesn't send a `Stripe-Version` header, so your Stripe account's
   default API version applies. If the test checkout fails with an error about `ui_mode`,
   change `"hosted_page"` to `"hosted"` (the older name for the same thing).
2. **Logo (removed Oct 2026).** The Checkout Studio logo (`file_1UQ0SXDMRJHtujiuLpeUXL0O`) was
   a sandbox file, and live mode can't see it, so it was taken out when Stripe went live.
   Checkout now uses the logo set in Stripe Dashboard → Settings → Branding (live mode).
   To set a logo on the checkout itself: upload it in live mode, then add
   `branding_settings[logo][type]=file` and `branding_settings[logo][file]=<live file_… ID>` back.

### Kept on purpose (not part of Checkout Studio)

`client_reference_id`, `metadata[user_id]`, `metadata[plan]`, `customer` / `customer_email`
and `subscription_data[metadata][user_id]` were left in. The `stripe-webhook` function
needs them to know which user paid and to grant premium. Removing them would break fulfilment.

## Setup

GitHub → repo → Settings → Secrets and variables → Actions:

- `STRIPE_SECRET_KEY`: `sk_test_…` for now, `sk_live_…` at launch. Server-only, so no `VITE_` prefix.
- `STRIPE_WEBHOOK_SECRET`: `whsec_…` from the webhook endpoint below.
- Optional: `APP_URL` (defaults to `https://app.yourpoolmate.com.au`).

No publishable key is needed. The app only redirects to the Stripe-hosted URL.

Stripe Dashboard → Developers → Webhooks: add an endpoint pointing at the
`stripe-webhook` function URL with these events: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
`invoice.payment_failed`.

Then run the **Deploy Supabase** workflow manually. It deploys both functions and applies migration 014.

## How it works

1. The trial ends and `TrialExpiredScreen` (`src/App.jsx`) calls `stripe-checkout` with `get_pricing`, then `create_session`.
2. The function decides the price server-side and returns the Stripe-hosted Checkout URL.
3. The user pays on Stripe and comes back to the app with `?checkout=success`.
4. `stripe-webhook` gets `checkout.session.completed` and sets `is_premium` on the user's profile.

## Testing

- Card `4242 4242 4242 4242`, any future expiry date, any CVC.
- Test both cohorts: a founding user (one-off $79) and a standard user ($49/yr subscription).
- Declined card: `4000 0000 0000 0002`. Card that needs 3-D Secure: `4000 0027 6000 3184`.

## Next steps

- Create promotion codes in the Dashboard if you want to use them (`allow_promotion_codes` is on).
- Before going live: swap in the live keys, set up a live webhook endpoint and set your live Price IDs.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
