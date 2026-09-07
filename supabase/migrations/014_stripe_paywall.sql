-- File: supabase/migrations/014_stripe_paywall.sql
-- Your Pool Mate — Stripe paywall + founding-rate model (Sep 2026)
-- Run AFTER 013_null_unscored_health_scores.sql.
--
-- Model (set by James, Sep 2026 — replaces the marketing-page $79 LTD checkout):
--   • No payment up front. Everyone gets the 30-day free trial.
--   • When the trial ends, the user must pay inside the app to continue.
--   • The FIRST 300 users (by signup order) get the FOUNDING rate:
--         $79 AUD once, lifetime.
--   • Everyone after the first 300 pays the STANDARD rate:
--         $49 AUD / year (recurring subscription).
--
-- This migration:
--   1. Adds the subscription/plan columns Stripe fulfilment writes to.
--   2. Stamps every user with a stable signup_rank + founding_member flag
--      (backfilled for existing users, set on signup for new ones).
--   3. Extends the premium-field lockdown so the new columns are also
--      writable ONLY by the service role (the Stripe webhook).
--
-- All writes to premium/plan columns happen via the service role in the
-- stripe-webhook Edge Function. Users can never grant themselves premium.

-- ─── 0. Founding cap ─────────────────────────────────────────
-- The first N signups get the lifetime founding rate. Change here if the
-- cap ever moves; is_founding is stamped at signup so it never shifts
-- retroactively for a given user.
--   Founding cap: 300

-- ─── 1. New columns on user_profiles ─────────────────────────
alter table public.user_profiles
  add column if not exists signup_rank          integer,
  add column if not exists founding_member      boolean not null default false,
  add column if not exists plan                 text,          -- 'founding_lifetime' | 'annual' | null
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status  text,          -- Stripe sub status: active | past_due | canceled | ...
  add column if not exists current_period_end   timestamptz,   -- when the current paid period ends (subscriptions)
  add column if not exists premium_since        timestamptz;

comment on column public.user_profiles.founding_member is
  'True if this user is among the first 300 signups — eligible for the $79 lifetime founding rate. Stamped at signup, never shifts.';
comment on column public.user_profiles.plan is
  'Active paid plan: founding_lifetime ($79 once), annual ($49/yr), or null (trial/expired).';

-- ─── 2. Backfill signup_rank + founding_member for existing users ─
-- Rank strictly by created_at so it matches "first N users". Ties broken
-- by id for determinism. Only fill rows that don't already have a rank.
with ranked as (
  select id,
         row_number() over (order by created_at asc, id asc) as rnk
  from public.user_profiles
)
update public.user_profiles p
set signup_rank     = r.rnk,
    founding_member = (r.rnk <= 300)
from ranked r
where p.id = r.id
  and p.signup_rank is null;

-- ─── 3. Stamp rank + founding flag on every new signup ───────
-- Rebuilds handle_new_user (last touched in migration 004) to also assign
-- a stable signup_rank and founding_member flag. Keeps the 30-day trial.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_rank integer;
begin
  -- Rank = number of profiles that already exist + 1.
  -- Low signup volume makes the count race negligible; the flag is stamped
  -- once and never recomputed, so early users keep founding status for good.
  select count(*) + 1 into v_rank from public.user_profiles;

  insert into public.user_profiles (id, trial_ends_at, signup_rank, founding_member)
  values (
    new.id,
    now() + interval '30 days',
    v_rank,
    (v_rank <= 300)
  );
  return new;
end;
$$;

-- ─── 4. Extend the premium-field lockdown to the new columns ─
-- Migration 004 locked is_premium / trial_ends_at / stripe_customer_id to
-- the service role. The new plan/subscription columns must be equally
-- tamper-proof — otherwise a user could self-grant premium via the API.
create or replace function public.protect_premium_fields()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('request.jwt.claims', true)::jsonb->>'role'
       is distinct from 'service_role' then
    if new.is_premium            is distinct from old.is_premium
       or new.trial_ends_at        is distinct from old.trial_ends_at
       or new.stripe_customer_id   is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.plan                 is distinct from old.plan
       or new.subscription_status  is distinct from old.subscription_status
       or new.current_period_end   is distinct from old.current_period_end
       or new.premium_since        is distinct from old.premium_since
       or new.founding_member      is distinct from old.founding_member
       or new.signup_rank          is distinct from old.signup_rank then
      raise exception 'premium/plan fields are read-only';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Trigger itself is unchanged (created in 004); the function body above is
-- what runs. Re-create defensively in case 004 wasn't applied here.
drop trigger if exists protect_premium_fields on public.user_profiles;
create trigger protect_premium_fields
  before update on public.user_profiles
  for each row execute function public.protect_premium_fields();

-- ─── Verify ──────────────────────────────────────────────────
-- 1. select signup_rank, founding_member from public.user_profiles order by signup_rank;
--    → first 300 rows founding_member = true, rest false
-- 2. As a signed-in user, this must FAIL:
--    update public.user_profiles set plan = 'founding_lifetime' where id = auth.uid();
