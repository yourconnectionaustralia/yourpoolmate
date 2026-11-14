-- File: supabase/migrations/027_water_tests_pool_look.sql
-- Your Pool Mate — "How does your pool look?" saved with each test (14 Nov 2026)
-- Run AFTER 025_security_hardening.sql. 026 is already used by 026_email_optout_and_events.sql, so this is 027;
-- the two do not depend on each other and can run in either order.)
--
-- Every new test now asks how the pool looks: clear, cloudy, green, something
-- else wrong, or not sure. The readings cannot show green or cloudy water, and
-- balanced water can still be green, so the answer is kept with the test and
-- used next to the numbers (swim call, plan watch-outs, problem fixer).
--
-- One nullable text column. Existing rows stay null ("not asked"), and so do
-- past results typed in later and shop CSV imports. The app works before this
-- runs: it saves the test without the answer, and starts keeping it as soon as
-- the column exists. No new table, so no new RLS or grants: water_tests keeps
-- the ones it has.

alter table public.water_tests
  add column if not exists pool_look text;

alter table public.water_tests
  drop constraint if exists water_tests_pool_look_check;

alter table public.water_tests
  add constraint water_tests_pool_look_check
  check (pool_look is null or pool_look = any (array['clear', 'cloudy', 'green', 'other', 'unsure']));

-- ─── Verify ──────────────────────────────────────────────────────
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema = 'public' and table_name = 'water_tests' and column_name = 'pool_look';
-- → pool_look | text | YES
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.water_tests'::regclass and conname = 'water_tests_pool_look_check';
-- → CHECK ((pool_look IS NULL) OR (pool_look = ANY (ARRAY['clear', 'cloudy', 'green', 'other', 'unsure'])))
-- Then add a test, pick "Green", reload the app, and the Health Score page should still show the green-water note.
