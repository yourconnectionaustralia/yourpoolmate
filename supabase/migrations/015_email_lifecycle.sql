-- File: supabase/migrations/015_email_lifecycle.sql
-- Your Pool Mate — Lifecycle email system (Sep 2026)
-- Run AFTER 014_stripe_paywall.sql.
--
-- Backs the welcome + trial-reminder emails (send-welcome-email,
-- send-lifecycle-emails) and the one-click unsubscribe function.
--
-- Two tables:
--   • email_prefs — the user's postcode (→ derived AU state, for content
--     targeting only) and their opt-out timestamp. The user may set ONLY
--     their postcode; state and opted_out_at are not user-writable.
--   • email_log — one row per (user, template) actually sent. Service-role
--     only (same deny-all pattern as ocr_calls, migration 005) so the
--     scheduled sender is the sole writer and idempotency is enforced by a
--     unique (user_id, template_key).
--
-- Pipeline rules honoured here (see scripts/apply_migrations.py header):
--   • plain `create table` (NOT `if not exists`) — this migration runs once,
--     never re-applied; drift is fixed by a NEW migration, never a re-run.
--   • no `DO $$ ... $$` blocks and no dollar-quoting anywhere — function
--     bodies are single-quoted strings with doubled '' quotes.
--   • verification queries live at the bottom as separate statements to run
--     by hand in the SQL editor (this file only creates schema).

-- ─── au_state_from_postcode ──────────────────────────────────
-- Postcode → state. Approximate (border postcodes exist). Content targeting
-- only — never used for anything that must be exact.
create function public.au_state_from_postcode(pc text)
returns text
language sql
immutable
as '
  select case
    when pc !~ ''^[0-9]{4}$'' then null
    when pc::int between 200 and 299 then ''ACT''
    when pc::int between 800 and 999 then ''NT''
    when pc::int between 1000 and 2599 then ''NSW''
    when pc::int between 2600 and 2618 then ''ACT''
    when pc::int between 2619 and 2899 then ''NSW''
    when pc::int between 2900 and 2920 then ''ACT''
    when pc::int between 2921 and 2999 then ''NSW''
    when pc::int between 3000 and 3999 then ''VIC''
    when pc::int between 4000 and 4999 then ''QLD''
    when pc::int between 5000 and 5999 then ''SA''
    when pc::int between 6000 and 6999 then ''WA''
    when pc::int between 7000 and 7999 then ''TAS''
    when pc::int between 8000 and 8999 then ''VIC''
    when pc::int between 9000 and 9999 then ''QLD''
    else null
  end
';

-- ─── email_prefs ─────────────────────────────────────────────
create table public.email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  postcode text check (postcode is null or postcode ~ '^[0-9]{4}$'),
  state text,
  opted_out_at timestamptz,
  created_at timestamptz not null default now()
);

-- state is always derived from postcode by this trigger, so a user can never
-- write it directly (nor is it in their column grants below).
create function public.email_prefs_set_state()
returns trigger
language plpgsql
as '
begin
  new.state := public.au_state_from_postcode(new.postcode);
  return new;
end
';

create trigger email_prefs_set_state
before insert or update of postcode on public.email_prefs
for each row execute function public.email_prefs_set_state();

alter table public.email_prefs enable row level security;

create policy "email_prefs_select_own" on public.email_prefs
  for select to authenticated using (user_id = auth.uid());
create policy "email_prefs_insert_own" on public.email_prefs
  for insert to authenticated with check (user_id = auth.uid());
create policy "email_prefs_update_own" on public.email_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Deliberately no DELETE policy: rows go when the user is deleted (cascade).

-- Users may set their postcode only. state and opted_out_at are not
-- user-writable — the service role (unsubscribe fn / trigger) owns those.
revoke all on public.email_prefs from anon, authenticated;
grant select on public.email_prefs to authenticated;
grant insert (user_id, postcode) on public.email_prefs to authenticated;
grant update (postcode) on public.email_prefs to authenticated;

-- ─── email_log ───────────────────────────────────────────────
-- One row per (user, template) actually claimed/sent. Service role only —
-- no policies, deny-all for anon/authenticated (same as ocr_calls).
create table public.email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,
  resend_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, template_key)
);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
-- No policies on purpose: service role only.

-- ─── Verify (run each as its own statement in the SQL editor) ─
-- 1. Columns of email_prefs:
--    select column_name, data_type, is_nullable
--    from information_schema.columns
--    where table_schema = 'public' and table_name = 'email_prefs'
--    order by ordinal_position;
--    Expect: user_id uuid NO, postcode text YES, state text YES,
--            opted_out_at timestamptz YES, created_at timestamptz NO.
--
-- 2. Columns of email_log:
--    select column_name, data_type, is_nullable
--    from information_schema.columns
--    where table_schema = 'public' and table_name = 'email_log'
--    order by ordinal_position;
--    Expect: id bigint NO, user_id uuid NO, template_key text NO,
--            resend_id text YES, created_at timestamptz NO, sent_at timestamptz YES.
--
-- 3. State derivation:
--    select public.au_state_from_postcode('3000');   -- → VIC
--
-- 4. Policies — three on email_prefs, none on email_log:
--    select tablename, policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename in ('email_prefs','email_log')
--    order by tablename, policyname;
--    Expect: email_prefs_insert_own (INSERT), email_prefs_select_own (SELECT),
--            email_prefs_update_own (UPDATE); email_log → zero rows.
