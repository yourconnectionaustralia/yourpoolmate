-- File: supabase/migrations/004_security_fixes.sql
-- Your Pool Mate — Security & Trial Fixes (June 2026 review)
-- Run AFTER 003_pool_setup_fields.sql. (Renumbered from 002 — the repo already had migrations 002/003.)
--
-- Fixes:
--   1. CRITICAL: users could set is_premium = true / extend trial_ends_at
--      on their own profile via the API. Premium + trial fields are now
--      writable ONLY by the service role (Stripe webhook / admin).
--   2. Feedback table hardening (auth required, length cap, hourly throttle).
--   3. Trial length: 7 days → 30 days (covers 4+ weekly test cycles).
--   4. pool_profiles delete policy (was missing).

-- ─── 1. user_profiles lockdown ───────────────────────────────
-- Users have nothing they legitimately self-edit on this table today.
-- Remove the UPDATE policy entirely and revoke column privileges.
-- The service role bypasses RLS and keeps full access, so Stripe
-- webhooks / admin updates continue to work.

drop policy if exists "Users can update their own profile" on public.user_profiles;

revoke update on public.user_profiles from anon, authenticated;

-- Belt-and-braces: even if a future policy re-opens UPDATE, this trigger
-- blocks non-service-role changes to the protected columns.
create or replace function public.protect_premium_fields()
returns trigger language plpgsql security definer as $$
begin
  if current_setting('request.jwt.claims', true)::jsonb->>'role'
       is distinct from 'service_role' then
    if new.is_premium is distinct from old.is_premium
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'premium/trial fields are read-only';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_premium_fields on public.user_profiles;
create trigger protect_premium_fields
  before update on public.user_profiles
  for each row execute function public.protect_premium_fields();

-- ─── 2. feedback hardening ───────────────────────────────────
-- Old policy allowed anonymous inserts (user_id null) with no limits —
-- an open spam vector. Now: must be signed in, 2000-char cap,
-- max 10 submissions per user per hour.

-- NOTE: a `feedback` table already existed in this database (created via
-- the dashboard before migration 001 ran), so its columns may not match
-- 001's definition. Apply each guard only if the relevant column exists.

do $feedback$
begin
  -- 2a. Cap message length (only if the table has a `message` column)
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'feedback'
               and column_name = 'message') then
    execute 'alter table public.feedback drop constraint if exists feedback_message_length';
    execute 'alter table public.feedback add constraint feedback_message_length
             check (char_length(message) <= 2000)';
  end if;

  -- 2b. Require authenticated inserts + hourly throttle
  --     (only if the table has user_id + created_at columns)
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'feedback'
               and column_name = 'user_id')
     and exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'feedback'
               and column_name = 'created_at') then

    execute 'drop policy if exists "Users can submit feedback" on public.feedback';
    execute 'drop policy if exists "Authenticated users can submit feedback" on public.feedback';
    execute 'create policy "Authenticated users can submit feedback"
             on public.feedback for insert
             with check (auth.uid() = user_id)';

    execute $fn$
      create or replace function public.throttle_feedback()
      returns trigger language plpgsql security definer as $body$
      begin
        if (select count(*) from public.feedback
            where user_id = new.user_id
              and created_at > now() - interval '1 hour') >= 10 then
          raise exception 'feedback rate limit reached — try again later';
        end if;
        return new;
      end;
      $body$;
    $fn$;

    execute 'drop trigger if exists throttle_feedback on public.feedback';
    execute 'create trigger throttle_feedback
             before insert on public.feedback
             for each row execute function public.throttle_feedback()';
  else
    raise notice 'feedback table missing user_id/created_at — throttle skipped';
  end if;
end
$feedback$;

-- ─── 3. Trial length: 30 days ────────────────────────────────
-- Weekly testing cadence means a 7-day trial showed users one test.
-- 30 days covers a month of history — the trend value that converts.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, trial_ends_at)
  values (
    new.id,
    now() + interval '30 days'
  );
  return new;
end;
$$;

-- Extend any existing non-premium trialists to the new window
-- (measured from their signup, not from today).
update public.user_profiles
set trial_ends_at = created_at + interval '30 days'
where is_premium = false
  and trial_ends_at is not null;

-- ─── 4. pool_profiles delete policy (was missing) ────────────
drop policy if exists "Users can delete their own pool profile" on public.pool_profiles;
create policy "Users can delete their own pool profile"
  on public.pool_profiles for delete
  using (auth.uid() = user_id);

-- ─── Verify ──────────────────────────────────────────────────
-- 1. As a signed-in user, this must FAIL:
--    update public.user_profiles set is_premium = true where id = auth.uid();
-- 2. select trial_ends_at from public.user_profiles; → 30 days from signup

-- ─── 5. feedback_rounds hardening ────────────────────────────
-- 002_feedback_rounds allows anonymous inserts with no size limits —
-- an open spam vector. Keep anonymous submission (beta testers) but cap
-- payload sizes so it can't be abused for storage flooding.

alter table public.feedback_rounds
  drop constraint if exists feedback_rounds_size_limits;
alter table public.feedback_rounds
  add constraint feedback_rounds_size_limits check (
    pg_column_size(notes) <= 51200                      -- 50KB of notes per round
    and char_length(coalesce(submitted_by, '')) <= 320
    and char_length(coalesce(round_label, '')) <= 200
    and char_length(coalesce(device_info, '')) <= 500
  );
