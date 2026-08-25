-- File: supabase/migrations/013_null_unscored_health_scores.sql
-- Clear stored "fake zero" Health Scores.
--
-- Until now, calculateScore() (both the client and the calculate-health-score
-- edge function) returned 0 when a test had no scoreable reading — so a test
-- saved with, say, only a total-chlorine value was stored with health_score = 0.
-- A 0 there is indistinguishable from a genuinely terrible score, which is the
-- exact confusion this release fixes: no scoreable reading now means NULL, not 0.
--
-- This backfills existing rows to the new model. It only touches rows that have
-- NONE of the six scoreable columns populated — i.e. rows whose score could only
-- ever have been the fake zero. A real low score (e.g. free chlorine 0, pH 8.8)
-- has scoreable readings and is left untouched.
--
-- Safe: no rows are read out, deleted, or restructured — only health_score is
-- nulled on genuinely unscoreable rows. Idempotent (re-running changes nothing).

update public.water_tests
set health_score = null
where health_score is not null
  and free_chlorine is null
  and ph            is null
  and alkalinity    is null
  and cyanuric_acid is null
  and calcium       is null
  and salt          is null;
