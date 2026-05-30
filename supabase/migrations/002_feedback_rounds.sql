-- File: supabase/migrations/002_feedback_rounds.sql
-- Your Pool Mate — Feedback Rounds
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- RLS enabled. Anyone can INSERT. Only service_role can SELECT (use dashboard to query).

-- ─── feedback_rounds ────────────────────────────────────────────
-- Stores batched feedback rounds from beta testers and internal review.
-- Each round is a set of per-page notes accumulated before submission.
--
-- notes JSON shape (array of objects):
-- [
--   {
--     "page":       "health",            -- activeView key
--     "page_label": "Health Score",      -- human-readable page name
--     "note":       "Score ring is ...", -- the feedback text
--     "x":          412,                 -- page X coordinate (px, document-relative); null if not pinned to a spot
--     "y":          268,                 -- page Y coordinate (px, document-relative); null if not pinned to a spot
--     "added_at":   "2026-05-28T10:23Z"  -- ISO timestamp when note was added
--   },
--   ...
-- ]
-- Notes placed via the "Pin a spot on the page" flow carry x/y document
-- coordinates so the exact location can be reproduced. General page-level
-- notes have x = y = null. Stored as-is inside the jsonb array (no schema change).
--
-- To export all rounds as JSON for Claude:
--   SELECT row_to_json(r) FROM feedback_rounds r ORDER BY created_at DESC;
--
-- To export a single round:
--   SELECT row_to_json(r) FROM feedback_rounds r WHERE id = '<uuid>';

create table if not exists public.feedback_rounds (
  id            uuid        primary key default uuid_generate_v4(),
  submitted_by  text,                         -- user email or null (anonymous)
  round_label   text,                         -- optional name, e.g. 'Beta round 1'
  notes         jsonb       not null,          -- array of note objects (see shape above)
  device_info   text,                         -- navigator.userAgent
  created_at    timestamptz not null default now()
);

alter table public.feedback_rounds enable row level security;

-- Allow anyone (authenticated or anonymous) to submit a feedback round.
-- The anon key is the only key exposed in the browser bundle — this is safe.
create policy "Anyone can submit a feedback round"
  on public.feedback_rounds for insert
  with check (true);

-- No SELECT policy — James queries via Supabase dashboard (service_role bypasses RLS).
-- If you add a SELECT policy later, scope it to an admin role check.

-- ─── Verify ─────────────────────────────────────────────────────
-- After running: confirm the table and policy exist.
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name = 'feedback_rounds';
--
-- select polname, polcmd from pg_policies
-- where tablename = 'feedback_rounds';
