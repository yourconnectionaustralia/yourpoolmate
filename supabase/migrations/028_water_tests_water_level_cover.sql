-- Your Pool Mate — water level and pool cover saved with each test (28 Nov 2026)
-- Run AFTER 027_water_tests_pool_look.sql (running Deploy Supabase by hand
-- applies both in order).
--
-- Every new test now also asks where the water level is and whether the pool
-- cover was on. Neither shows in the readings, and both change what is worth
-- doing next.
--
-- Two nullable text columns. Existing rows stay null ("not asked"), and so do
-- past results typed in later and shop CSV imports. The app works before this
-- runs: it saves the test without the answers, and starts keeping them as soon
-- as the columns exist. No new table, so no new RLS or grants: water_tests
-- keeps the ones it has.
--
-- Notes of jobs done after a test need no change: they are pool_events rows
-- (event_type 'job_note'), using columns that migration 021 already added.

alter table public.water_tests
  add column if not exists water_level text,
  add column if not exists cover_state text;

alter table public.water_tests
  drop constraint if exists water_tests_water_level_check;

alter table public.water_tests
  add constraint water_tests_water_level_check
  check (water_level is null or water_level = any (array['normal', 'high', 'low', 'unsure']));

alter table public.water_tests
  drop constraint if exists water_tests_cover_state_check;

alter table public.water_tests
  add constraint water_tests_cover_state_check
  check (cover_state is null or cover_state = any (array['on', 'off', 'none', 'unsure']));

-- ─── Verify ──────────────────────────────────────────────────────
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema = 'public' and table_name = 'water_tests'
--    and column_name in ('water_level', 'cover_state');
-- → two rows, both text | YES
