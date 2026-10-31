-- File: supabase/migrations/024_water_tests_source_voice.sql
-- Your Pool Mate — let voice-entered tests save (31 Oct 2026)
-- Run AFTER 023_trial_30_days_founding_on_payment.sql.
--
-- The live water_tests_source_check only allows 'manual', 'ocr' and
-- 'shop_import'. Speak-your-results saves source = 'voice'
-- (src/lib/parseVoiceReadings.js), so the database rejects every voice test.
-- Widen the check to include 'voice'. Every existing row already satisfies
-- the wider list, so nothing is rewritten.

alter table public.water_tests
  drop constraint if exists water_tests_source_check;

alter table public.water_tests
  add constraint water_tests_source_check
  check (source = any (array['manual', 'ocr', 'shop_import', 'voice']));

-- ─── Verify ──────────────────────────────────────────────────────
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.water_tests'::regclass and conname = 'water_tests_source_check';
-- → CHECK ((source = ANY (ARRAY['manual', 'ocr', 'shop_import', 'voice'])))
-- Then save one test by voice in the app and confirm it appears after a reload.
