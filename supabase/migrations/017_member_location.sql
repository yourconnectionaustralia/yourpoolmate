-- Your Pool Mate — member location on the existing user profile (Oct 2026)
-- Run AFTER 016_lifecycle_emails.sql.
--
-- Members can save where they live so local tips (for example heavy rain
-- in their postcode) can use it later. This does not add weather, tips,
-- or notifications.
--
-- Stored on user_profiles — the one member row — not a second profile table.
-- Email stays on auth.users. Premium, trial, and Stripe columns stay
-- locked to the service role (migrations 004 and 014).
--
-- Postcode is text so a leading zero survives (0800 is a real postcode).
-- Null until the member saves. The app requires 4 digits before it writes.

alter table public.user_profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists address    text,
  add column if not exists suburb     text,
  add column if not exists postcode   text;

comment on column public.user_profiles.first_name is
  'Optional given name. Not used for sign-in.';
comment on column public.user_profiles.last_name is
  'Optional family name.';
comment on column public.user_profiles.address is
  'Optional street address, for local tips later.';
comment on column public.user_profiles.suburb is
  'Optional suburb or locality.';
comment on column public.user_profiles.postcode is
  'Australian postcode, 4 digits, stored as text so 0800 keeps its leading zero. Null until the member saves their profile.';

alter table public.user_profiles
  drop constraint if exists user_profiles_member_details_check;

alter table public.user_profiles
  add constraint user_profiles_member_details_check check (
    char_length(coalesce(first_name, '')) <= 80
    and char_length(coalesce(last_name, '')) <= 80
    and char_length(coalesce(address, '')) <= 200
    and char_length(coalesce(suburb, '')) <= 80
    and (postcode is null or postcode ~ '^[0-9]{4}$')
  );

-- Migration 004 revoked table-level UPDATE and dropped the update policy
-- because nothing on this row was member-editable. Re-open UPDATE only for
-- these five columns. Table-level UPDATE stays revoked, so is_premium,
-- trial_ends_at, Stripe, plan, and rank columns are still not writable by
-- a signed-in member. The protect_premium_fields trigger remains the
-- backstop if a later grant is wider than it should be.

revoke update on public.user_profiles from anon, authenticated;

grant update (first_name, last_name, address, suburb, postcode)
  on public.user_profiles to authenticated;

drop policy if exists "Users can update their own profile details" on public.user_profiles;
create policy "Users can update their own profile details"
  on public.user_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── Verify ──────────────────────────────────────────────────
-- 1. As a signed-in user, this must SUCCEED:
--    update public.user_profiles
--       set postcode = '3000', first_name = null
--     where id = auth.uid();
-- 2. As a signed-in user, this must FAIL (column privilege):
--    update public.user_profiles set is_premium = true where id = auth.uid();
-- 3. This must FAIL (check constraint):
--    update public.user_profiles set postcode = '300' where id = auth.uid();
