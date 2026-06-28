-- File: supabase/migrations/007_pool_events.sql
-- Your Pool Mate — Pool events (timeline annotations)
-- Applied automatically by CI on push to supabase/**.
--
-- Backs the new water-analysis trend graph. Stores MANUAL special events the
-- owner adds to their water-test timeline — green-pool treatments, shock doses,
-- drain/refills, custom notes, etc. (Two event kinds are derived automatically
-- at render time and are NOT stored here: "untested > 2 months" gaps, computed
-- from the spacing of water_tests, and "new equipment", computed from
-- equipment.created_at. Keeping those out of the table avoids duplicate/stale rows.)
--
-- RLS enabled — non-negotiable.

create table if not exists public.pool_events (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  pool_id      uuid references public.pool_profiles(id) on delete cascade,

  -- 'green_treatment' | 'shock' | 'new_equipment' | 'drain_refill' | 'treatment' | 'custom'
  event_type   text not null default 'custom',
  title        text not null,
  notes        text,

  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table public.pool_events enable row level security;

create policy "Users can view their own events"
  on public.pool_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own events"
  on public.pool_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own events"
  on public.pool_events for update
  using (auth.uid() = user_id);

create policy "Users can delete their own events"
  on public.pool_events for delete
  using (auth.uid() = user_id);

create index if not exists pool_events_user_occurred
  on public.pool_events (user_id, occurred_at desc);

-- ─── Verify ──────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'pool_events'
-- order by ordinal_position;
