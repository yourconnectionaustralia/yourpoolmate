# One-tap sign-in (Google + Apple) — setup

The sign-up and sign-in screens can show **Continue with Google** and **Continue with Apple**
above the normal email form. The same tap creates a new account (and starts the 30-day trial)
or signs an existing user back in.

Nothing shows until you switch it on. The switch is one Cloudflare Pages environment variable:

| Variable | Example | Effect |
|----------|---------|--------|
| `VITE_AUTH_PROVIDERS` | `google` or `google,apple` | Shows those buttons. Blank/unset = email only (today's behaviour) |

**Order of work for each provider:** set it up below → enable it in Supabase → add its name to
`VITE_AUTH_PROVIDERS` → redeploy. Never add the name first: tapping the button would drop people on a Supabase error page.
To roll back, remove the name from the variable and redeploy — no code change.

---

## 1. Supabase settings (once, both providers)

Supabase dashboard → **Authentication → URL Configuration**

- **Site URL:** the app domain (`https://app.yourpoolmate.com.au`), not the marketing domain.
- **Redirect URLs:** must contain the bare app origin, `https://app.yourpoolmate.com.au`
  (a `/**` entry alone does not match it). Add the `pages.dev` preview origin too if you test there.

The callback address both providers need is:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

(Project ref = the part before `.supabase.co` in `VITE_SUPABASE_URL`.)

## 2. Google (about 15 minutes, free)

1. Google Cloud Console → create/select a project.
2. **APIs & Services → OAuth consent screen** → Get started. App name *Your Pool Mate*, your
   support email, audience **External**. Add your Privacy and Terms page links.
3. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
   Under **Authorized redirect URIs** add the Supabase callback address above. Create it and copy
   the **Client ID** and **Client secret**.
4. Back on the consent screen, **publish the app** (move it out of *Testing*). While it is in
   Testing, only people you list as test users can sign in. Email/profile sign-in does not need
   Google's verification review.
5. Supabase → **Authentication → Providers → Google** → enable, paste Client ID + secret, save.
6. Add `google` to `VITE_AUTH_PROVIDERS`.

## 3. Apple (about an hour, needs a paid Apple account)

Needs an **Apple Developer Program** membership (paid, yearly). Without it, leave `apple` out.

1. developer.apple.com → Certificates, Identifiers & Profiles. Note your **Team ID**.
2. **Identifiers → App IDs:** create one with the *Sign in with Apple* capability.
3. **Identifiers → Services IDs:** create one (this is the "Client ID"). Enable *Sign in with Apple*,
   then **Configure**: domain `<project-ref>.supabase.co`, return URL = the Supabase callback address.
4. **Keys:** create a key with *Sign in with Apple*. Download the `.p8` file (one-time download —
   keep it safe) and note the **Key ID**.
5. **Services → Sign in with Apple for Email Communication:** register the domain our emails are
   sent from, `mail.yourpoolmate.com.au` (see "Hide My Email" below).
6. Use Supabase's Apple setup page to generate the **secret key** from the `.p8`, Team ID, Key ID
   and Services ID. In Supabase → **Authentication → Providers → Apple** → enable, put the
   Services ID in **Client IDs**, paste the generated secret, save.
7. Add `apple` to `VITE_AUTH_PROVIDERS`.

**Calendar reminder: the Apple secret key expires every 6 months.** Generate a new one from the same
`.p8` and paste it into Supabase before then, or Apple sign-in silently stops working.

### Things that behave differently with Apple

- **"Hide My Email":** many Apple users get an address like `abc123@privaterelay.appleid.com`. Our
  trial and lifecycle emails only reach it if the sending domain is registered in step 5. Skip that
  step and those users never get the emails.
- **Name:** Apple does not pass the person's name on the web flow, so Apple sign-ups have no first
  name for the home greeting (Google sign-ups do).
- **Different emails = different accounts.** Someone who signed up by email and later taps Apple
  with a hidden address ends up with two accounts. Same real address (Google, or Apple with email
  shared) links to the existing account automatically.

## 4. Official logos (needed for both)

Google and Apple require their own logo on these buttons. Download the official files from their
brand pages and save them as:

```
public/auth/google.svg
public/auth/apple.svg
```

Until the files exist the buttons show text only (the logo hides itself). The button colours already
follow each company's guidelines.

## 5. Test before announcing

1. **New Google account** → lands in the pool setup; in Supabase the `user_profiles` row has a
   `trial_ends_at` 30 days out and a `signup_rank`.
2. **Existing email user** taps Google with the same address → same account, no duplicate.
3. **Cancel on the Google/Apple page** → back on the start screen with "Sign-in was cancelled".
4. **Press Back from the Google page** → the button returns to "Continue with Google".
5. **iPhone, installed from Safari ("Add to Home Screen")** → sign in from the installed app and
   confirm it lands back in the app signed in. This is the one most worth checking: installed
   iPhone apps handle the hop out to Google/Apple differently from a normal browser tab.
6. **Android Chrome**, same as above.
7. Email sign-up and "Email me a sign-in link" still work as before.
