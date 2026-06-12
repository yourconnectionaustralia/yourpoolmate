-- File: supabase/migrations/005_ocr_rate_limit.sql
-- Your Pool Mate — OCR call tracking for rate limiting
-- Run AFTER 004_security_fixes.sql. (Renumbered from 003.)
--
-- The ocr-water-test Edge Function logs one row per call and refuses
-- service when a user exceeds 10 calls in the past hour. RLS is enabled
-- with NO policies — only the service role (used inside the function)
-- can read or write, so users cannot clear their own counter.

create table if not exists public.ocr_calls (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'ok',   -- 'ok' | 'error' | 'rejected'
  created_at  timestamptz not null default now()
);

alter table public.ocr_calls enable row level security;
-- Deliberately no policies: deny-all for anon/authenticated.

revoke all on public.ocr_calls from anon, authenticated;

create index if not exists ocr_calls_user_recent
  on public.ocr_calls (user_id, created_at desc);

-- Housekeeping: rows older than 7 days have no value. Optional cleanup —
-- run occasionally or schedule with pg_cron if enabled:
--   delete from public.ocr_calls where created_at < now() - interval '7 days';

-- ─── Verify ──────────────────────────────────────────────────
-- As a signed-in user this must return zero rows / permission denied:
--   select * from public.ocr_calls;
