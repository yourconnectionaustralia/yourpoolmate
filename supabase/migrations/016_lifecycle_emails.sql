-- File: supabase/migrations/016_lifecycle_emails.sql
-- Your Pool Mate — L1–L7 lifecycle email ledger (Sep 2026)
-- Run AFTER 015_beta_open_trial.sql.
--
-- Applied only when someone runs Deploy Supabase by hand (workflow_dispatch).
-- A push to main deploys the edge functions and does not run this file.
--
-- What this does:
--   1. email_sends — one row per user per template (L1…L7). Service role only.
--   2. lifecycle_email_candidates() — who the sweep should look at.
--      Recent signups, recent tests, recent payments, and failed sends.
--      It does not select the whole historical base.
--
-- S1–S3 seasonal emails are manual. They are not template keys.
-- status 'pending' is the in-flight claim. Terminal statuses are
-- sent, skipped, and failed (failed may be retried). A skipped row is
-- terminal for the sweep so a later allowlist change cannot backfill it.

-- ─── 1. Ledger ───────────────────────────────────────────────
create table if not exists public.email_sends (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  template_key text not null check (template_key in ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7')),
  provider_id  text,
  to_email     text,
  status       text not null check (status in ('pending', 'sent', 'skipped', 'failed')),
  error        text,
  created_at   timestamptz not null default now(),
  unique (user_id, template_key)
);

comment on table public.email_sends is
  'Once-only L1-L7 lifecycle sends. Writes are service-role only. S1-S3 are not stored here.';

alter table public.email_sends enable row level security;
-- No policies: anon and authenticated cannot read or write.
revoke all on public.email_sends from anon, authenticated;

create index if not exists email_sends_status_created
  on public.email_sends (status, created_at desc);

-- ─── 2. Sweep candidates ─────────────────────────────────────
-- security definer so the edge function (service role) can read auth-linked
-- rows in one round trip. Not callable by app users.
create or replace function public.lifecycle_email_candidates(p_now timestamptz default now())
returns table (
  user_id        uuid,
  created_at     timestamptz,
  trial_ends_at  timestamptz,
  is_premium     boolean,
  founding_member boolean,
  plan           text,
  premium_since  timestamptz,
  test_count     integer,
  first_test_at  timestamptz,
  third_test_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.created_at,
    p.trial_ends_at,
    p.is_premium,
    p.founding_member,
    p.plan,
    p.premium_since,
    (select count(*)::integer from public.water_tests w where w.user_id = p.id),
    (select min(w.created_at) from public.water_tests w where w.user_id = p.id),
    (
      select w.created_at
      from public.water_tests w
      where w.user_id = p.id
      order by w.created_at asc
      offset 2
      limit 1
    )
  from public.user_profiles p
  where
    p.created_at >= p_now - interval '32 days'
    or (
      p.is_premium
      and p.premium_since is not null
      and p.premium_since >= p_now - interval '21 days'
    )
    or exists (
      select 1 from public.water_tests w
      where w.user_id = p.id
        and w.created_at >= p_now - interval '21 days'
    )
    or exists (
      select 1 from public.email_sends e
      where e.user_id = p.id
        and e.status = 'failed'
        and e.created_at >= p_now - interval '14 days'
    )
  order by p.created_at desc
  limit 1000;
$$;

revoke execute on function public.lifecycle_email_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.lifecycle_email_candidates(timestamptz) to service_role;

-- ─── Verify ──────────────────────────────────────────────────
-- 1. As a signed-in user this must return permission denied / zero rows:
--      select * from public.email_sends;
-- 2. This must fail for anon/authenticated:
--      select * from public.lifecycle_email_candidates(now());
