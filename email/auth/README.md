# Supabase Auth emails (signup, sign-in link, password reset)

These are sent by Supabase Auth, not by the app code, so they live in the
Supabase dashboard. Paste each file there and set the subject. Nothing here
deploys automatically.

Supabase dashboard > Authentication > Emails (or Email Templates):

| Template | Subject | Paste |
|----------|---------|-------|
| Confirm signup | Confirm your email to start your trial | `confirm-signup.html` |
| Magic link | Your Your Pool Mate sign-in link | `magic-link.html` |
| Reset password | Reset your Your Pool Mate password | `reset-password.html` |

`{{ .ConfirmationURL }}` is a Supabase variable. Leave it exactly as written.

House style: plain hyphens, no HTML entities such as middot or bull (type the
character or use a hyphen), no em dashes. Test with a real signup after pasting.
