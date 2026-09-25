-- File: supabase/migrations/015_beta_open_trial.sql
-- Your Pool Mate — open beta: trial runs to a single beta end date (Sep 2026)
-- Run AFTER 014_stripe_paywall.sql.
--
-- Why a date instead of a discount code:
--   • Testers never hit the paywall, so there's nothing to "redeem".
--   • No $0 Stripe purchases polluting founding/revenue data, and nobody
--     ends up with accidental lifetime premium.
--   • No frontend change — the app already reads trial_ends_at, so the
--     "X days left" badge just shows the days until the beta end date.
--
-- What this does:
--   1. app_config table (RLS on, no policies → service role / SQL editor only)
--      holding beta_trial_until.
--   2. New signups get trial_ends_at = the LATER of (now + 30 days) and the
--      beta end date. After the beta date passes, signups revert to the
--      normal 30-day trial automatically.
--   3. Every existing non-premium user is moved to the beta end date
--      (including anyone whose trial had already expired).
--   4. set_beta_trial_until(date) — one-line control from the SQL editor.
--      NOT callable by app users (execute revoked from anon/authenticated).
--
-- Day-to-day control (Supabase dashboard → SQL Editor):
--   Extend the beta:          select public.set_beta_trial_until('2027-06-30 23:59:59+10');
--   Wind down with notice:    select public.set_beta_trial_until(now() + interval '14 days');
--   End beta immediately:     select public.set_beta_trial_until(null);
--     ↳ null puts every non-premium user back on signup + 30 days, which
--       EXPIRES anyone older than 30 days straight away. Prefer the
--       "wind down with notice" line.
--   Check current setting:    select value from public.app_config where key = 'beta_trial_until';

-- ─── 1. Config table ─────────────────────────────────────────
create table if not exists public.app_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- Deliberately no policies: anon/authenticated can't read or write.
revoke all on public.app_config from anon, authenticated;

-- Beta end date: 31 March 2027, end of day Melbourne time (AEDT).
insert into public.app_config (key, value)
values ('beta_trial_until', '2027-03-31 23:59:59+11')
on conflict (key) do update
  set value = excluded.value, updated_at = now();

-- Safe reader: a malformed value must never break signups.
create or replace function public.beta_trial_until()
returns timestamptz
language plpgsql stable security definer
set search_path = public
as $$
declare
  v timestamptz;
begin
  begin
    select nullif(value, '')::timestamptz into v
    from public.app_config where key = 'beta_trial_until';
  exception when others then
    v := null;
  end;
  return v;
end;
$$;

revoke execute on function public.beta_trial_until() from public, anon, authenticated;

-- ─── 2. New signups: later of 30 days or beta end ────────────
-- Same as 014 (signup_rank + founding flag) plus the beta date.
-- greatest() ignores nulls, so no beta date = plain 30-day trial.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_rank integer;
begin
  select count(*) + 1 into v_rank from public.user_profiles;

  insert into public.user_profiles (id, trial_ends_at, signup_rank, founding_member)
  values (
    new.id,
    greatest(now() + interval '30 days', public.beta_trial_until()),
    v_rank,
    (v_rank <= 300)
  );
  return new;
end;
$$;

-- ─── 3. Control function (SQL editor only) ───────────────────
-- Sets the beta date and re-points every NON-premium user's trial to
-- greatest(signup + 30 days, beta date). Paid users are never touched.
-- Returns the number of profiles updated.
create or replace function public.set_beta_trial_until(p_until timestamptz)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.app_config (key, value, updated_at)
  values ('beta_trial_until', p_until::text, now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();

  -- protect_premium_fields (004/014) only lets the service role touch
  -- trial_ends_at. Claim that role for THIS transaction only.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  update public.user_profiles
  set trial_ends_at = greatest(created_at + interval '30 days', p_until)
  where is_premium = false
    and trial_ends_at is distinct from greatest(created_at + interval '30 days', p_until);

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Critical: app users must never be able to call this via RPC.
revoke execute on function public.set_beta_trial_until(timestamptz) from public, anon, authenticated;

-- ─── 4. Apply to everyone already signed up ──────────────────
select public.set_beta_trial_until(public.beta_trial_until());

-- ─── Verify ──────────────────────────────────────────────────
-- 1. select id, is_premium, trial_ends_at from public.user_profiles order by created_at;
--    → every non-premium row = 2027-03-31 (or later of signup + 30 days)
-- 2. Sign up a fresh test account → app shows "~187 days left", no paywall.
-- 3. As a signed-in user (browser console), this must FAIL with permission denied:
--    await supabase.rpc('set_beta_trial_until', { p_until: '2099-01-01' })
