-- File: supabase/migrations/023_lifecycle_setup_referral.sql
-- Your Pool Mate — L8 pool setup reminder + new L7 referral rule (Oct 2026)
-- Run AFTER 022_ask_mate_chat.sql.
--
-- Applied only when someone runs Deploy Supabase by hand (workflow_dispatch).
-- A push to main deploys the edge functions and does not run this file.
-- Safe in either order: the new function code ignores the new columns until
-- this runs, and the old function code ignores them after it runs.
--
-- What this does:
--   1. email_sends — L8 (pool setup reminder) is now an allowed template_key.
--   2. lifecycle_email_candidates() — four new columns for the sweep:
--        fifth_test_at  when the fifth test was added (referral ask, L7)
--        last_test_at   when the latest test was added (referral ask needs a recent one)
--        has_pool_size  Pool setup has a volume in litres (L8)
--        has_equipment  a pump is saved, or at least one equipment item exists (L8)
--      The columns that were already there are unchanged. The function is
--      dropped and recreated because Postgres will not change a function's
--      return columns in place. Access stays service-role only.
--
-- Why has_equipment looks at the pump and the equipment list, not the filter
-- or sanitiser: every pool record already has those two filled in by the
-- setup steps, so they say nothing about whether someone added their gear.
-- A trial user who has given a volume and a pump, or one equipment item, is
-- counted as set up.

begin;

-- ─── 1. Ledger accepts L8 ────────────────────────────────────
alter table public.email_sends
  drop constraint if exists email_sends_template_key_check;

alter table public.email_sends
  add constraint email_sends_template_key_check
  check (template_key in ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'));

comment on table public.email_sends is
  'Once-only L1-L8 lifecycle sends. Writes are service-role only. S1-S3 are not stored here.';

-- ─── 2. Sweep candidates, with the new columns ───────────────
drop function if exists public.lifecycle_email_candidates(timestamptz);

create function public.lifecycle_email_candidates(p_now timestamptz default now())
returns table (
  user_id         uuid,
  created_at      timestamptz,
  trial_ends_at   timestamptz,
  is_premium      boolean,
  founding_member boolean,
  plan            text,
  premium_since   timestamptz,
  test_count      integer,
  first_test_at   timestamptz,
  third_test_at   timestamptz,
  fifth_test_at   timestamptz,
  last_test_at    timestamptz,
  has_pool_size   boolean,
  has_equipment   boolean
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
    ),
    (
      select w.created_at
      from public.water_tests w
      where w.user_id = p.id
      order by w.created_at asc
      offset 4
      limit 1
    ),
    (select max(w.created_at) from public.water_tests w where w.user_id = p.id),
    exists (
      select 1 from public.pool_profiles pp
      where pp.user_id = p.id
        and pp.volume_litres is not null
        and pp.volume_litres > 0
    ),
    (
      exists (select 1 from public.equipment e where e.user_id = p.id)
      or exists (
        select 1 from public.pool_profiles pp
        where pp.user_id = p.id
          and nullif(btrim(pp.pump_brand), '') is not null
      )
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

commit;

-- ─── Verify ──────────────────────────────────────────────────
-- 1. As the service role, the new columns come back (counts only, no emails):
--      select count(*) filter (where not has_pool_size) as no_size,
--             count(*) filter (where not has_equipment) as no_equipment
--      from public.lifecycle_email_candidates(now());
-- 2. This must still fail for anon/authenticated:
--      select * from public.lifecycle_email_candidates(now());
-- 3. An L8 row is accepted (run as service role, then delete it):
--      select pg_get_constraintdef(oid) from pg_constraint
--      where conname = 'email_sends_template_key_check';
