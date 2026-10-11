-- File: supabase/migrations/020_reminders_and_report.sql
-- Your Pool Mate — weekly test reminder and monthly pool report (Oct 2026)
-- Run AFTER 019_printout_photos.sql.
--
-- Applied only when someone runs Deploy Supabase by hand (workflow_dispatch).
--
-- 1. user_profiles.reminder_day   — 0 (Sunday) to 6 (Saturday). Null = no weekly reminder.
--    Nobody has a reminder until they pick a day in the app, so existing members
--    are not switched on. The weekly email goes out at 8am Melbourne time on that day.
-- 2. user_profiles.monthly_report — the monthly report email. On unless the member
--    turns it off in the app or with the link in the email.
-- 3. recurring_email_sends        — one row per member, kind and period, so a weekly
--    reminder or a monthly report is never sent twice for the same day or month.
--    Service role only.
-- 4. weekly_reminder_candidates() and monthly_report_candidates() — who the sweep
--    should look at. Service role only.
--
-- The EMAIL_ALLOWLIST gate (see lifecycle-rules.js) applies to these emails too.

-- ─── 1 + 2. Member settings ──────────────────────────────────
alter table public.user_profiles
  add column if not exists reminder_day   smallint,
  add column if not exists monthly_report boolean not null default true;

alter table public.user_profiles
  drop constraint if exists user_profiles_reminder_day_check;
alter table public.user_profiles
  add constraint user_profiles_reminder_day_check
  check (reminder_day is null or (reminder_day between 0 and 6));

comment on column public.user_profiles.reminder_day is
  'Weekly test reminder day, 0 = Sunday to 6 = Saturday. Null = off.';
comment on column public.user_profiles.monthly_report is
  'Whether the monthly pool report email is sent.';

-- Members change these two settings themselves. Migration 017 left UPDATE
-- open only for the five location columns, so add these two. Table-level
-- UPDATE stays revoked: is_premium, trial_ends_at, Stripe, plan and rank
-- columns are still not writable by a signed-in member. The existing
-- "Users can update their own profile details" policy limits this to their own row.
grant update (reminder_day, monthly_report)
  on public.user_profiles to authenticated;

-- ─── 3. Ledger ───────────────────────────────────────────────
create table if not exists public.recurring_email_sends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('weekly_reminder', 'monthly_report')),
  period_key  text not null,   -- weekly: the Melbourne date, 2026-10-18. monthly: the month reported, 2026-09
  provider_id text,
  to_email    text,
  status      text not null check (status in ('pending', 'sent', 'skipped', 'failed')),
  error       text,
  created_at  timestamptz not null default now(),
  unique (user_id, kind, period_key)
);

comment on table public.recurring_email_sends is
  'Once-per-period weekly reminder and monthly report sends. Writes are service-role only.';

alter table public.recurring_email_sends enable row level security;
-- No policies: anon and authenticated cannot read or write.
revoke all on public.recurring_email_sends from anon, authenticated;

create index if not exists recurring_email_sends_status_created
  on public.recurring_email_sends (status, created_at desc);

-- ─── 4a. Weekly reminder candidates ──────────────────────────
-- Members who picked a day and can still use the app (paid, or trial not over).
-- The sweep decides which of them are due right now.
create or replace function public.weekly_reminder_candidates(p_now timestamptz default now())
returns table (
  user_id        uuid,
  reminder_day   smallint,
  last_test_at   timestamptz,
  last_score     integer,
  test_count     integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.reminder_day,
    (select max(w.tested_at) from public.water_tests w where w.user_id = p.id),
    (select w.health_score from public.water_tests w
       where w.user_id = p.id order by w.tested_at desc limit 1),
    (select count(*)::integer from public.water_tests w where w.user_id = p.id)
  from public.user_profiles p
  where p.reminder_day is not null
    and (p.is_premium or p.trial_ends_at is null or p.trial_ends_at > p_now)
  order by p.id
  limit 5000;
$$;

revoke execute on function public.weekly_reminder_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.weekly_reminder_candidates(timestamptz) to service_role;

-- ─── 4b. Monthly report candidates ───────────────────────────
-- Members with at least one test between p_from (inclusive) and p_to (exclusive),
-- who have not turned the report off and can still use the app.
create or replace function public.monthly_report_candidates(
  p_from timestamptz,
  p_to   timestamptz,
  p_now  timestamptz default now()
)
returns table (
  user_id        uuid,
  tests          integer,
  first_score    integer,
  last_score     integer,
  best_score     integer,
  lowest_score   integer,
  doses          integer,
  last_test_at   timestamptz,
  last_readings  jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    (select count(*)::integer from public.water_tests w
       where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to),
    (select w.health_score from public.water_tests w
       where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to and w.health_score is not null
       order by w.tested_at asc limit 1),
    (select w.health_score from public.water_tests w
       where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to and w.health_score is not null
       order by w.tested_at desc limit 1),
    (select max(w.health_score) from public.water_tests w
       where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to),
    (select min(w.health_score) from public.water_tests w
       where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to),
    (select count(*)::integer from public.pool_events e
       where e.user_id = p.id and e.event_type = 'dose'
         and e.occurred_at >= p_from and e.occurred_at < p_to),
    (select max(w.tested_at) from public.water_tests w
       where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to),
    (select jsonb_build_object(
        'free_chlorine', w.free_chlorine, 'ph', w.ph, 'alkalinity', w.alkalinity,
        'cyanuric_acid', w.cyanuric_acid, 'calcium', w.calcium, 'salt', w.salt)
       from public.water_tests w
       where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to
       order by w.tested_at desc limit 1)
  from public.user_profiles p
  where p.monthly_report
    and (p.is_premium or p.trial_ends_at is null or p.trial_ends_at > p_now)
    and exists (
      select 1 from public.water_tests w
      where w.user_id = p.id and w.tested_at >= p_from and w.tested_at < p_to
    )
  order by p.id
  limit 5000;
$$;

revoke execute on function public.monthly_report_candidates(timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.monthly_report_candidates(timestamptz, timestamptz, timestamptz) to service_role;

-- ─── Verify ──────────────────────────────────────────────────
-- 1. As a signed-in user these must fail:
--      select * from public.recurring_email_sends;
--      select * from public.weekly_reminder_candidates(now());
-- 2. As a signed-in user this must work, and only on your own row:
--      update public.user_profiles set reminder_day = 0 where id = auth.uid();
