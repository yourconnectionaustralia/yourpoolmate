-- File: supabase/migrations/001_initial_schema.sql
-- Your Pool Mate — Initial Database Schema
-- Run in Supabase SQL editor.
-- RLS is enabled on every table — non-negotiable.

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── user_profiles ───────────────────────────────────────────
-- One row per user. Extends auth.users.
create table if not exists public.user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  is_premium      boolean not null default false,
  trial_ends_at   timestamptz,
  stripe_customer_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, trial_ends_at)
  values (
    new.id,
    now() + interval '7 days'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── pool_profiles ───────────────────────────────────────────
-- A user's pool. One user, one pool (for now).
create table if not exists public.pool_profiles (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  pool_shape      text,          -- 'rectangular', 'round', 'freeform', 'lap'
  volume_litres   integer,       -- e.g. 50000
  sanitiser_type  text,          -- 'chlorine_tabs', 'liquid_chlorine', 'saltwater', 'mineral'
  pump_brand      text,
  filter_type     text,          -- 'sand', 'cartridge', 'glass', 'DE'
  has_heater      boolean default false,
  has_spa         boolean default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

alter table public.pool_profiles enable row level security;

create policy "Users can view their own pool profile"
  on public.pool_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own pool profile"
  on public.pool_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own pool profile"
  on public.pool_profiles for update
  using (auth.uid() = user_id);

-- ─── water_tests ─────────────────────────────────────────────
-- Every water test entry. Core data table.
-- Timestamped record serves as the warranty documentation.
create table if not exists public.water_tests (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  pool_id         uuid references public.pool_profiles(id) on delete cascade,

  -- Chemical readings
  ph              numeric(4,2),
  free_chlorine   numeric(5,2),
  total_chlorine  numeric(5,2),
  alkalinity      numeric(6,1),
  cyanuric_acid   numeric(6,1),
  calcium         numeric(6,1),
  salt            numeric(6,1),
  phosphates      numeric(6,1),
  tds             numeric(8,1),

  -- Calculated
  health_score    integer check (health_score >= 0 and health_score <= 100),

  -- Source
  source          text default 'manual', -- 'manual' | 'ocr' | 'shop_import'
  ocr_image_url   text,

  -- Dosing actioned
  dosing_completed boolean default false,

  tested_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table public.water_tests enable row level security;

create policy "Users can view their own water tests"
  on public.water_tests for select
  using (auth.uid() = user_id);

create policy "Users can insert their own water tests"
  on public.water_tests for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own water tests"
  on public.water_tests for update
  using (auth.uid() = user_id);

create policy "Users can delete their own water tests"
  on public.water_tests for delete
  using (auth.uid() = user_id);

-- Index for fast history queries
create index if not exists water_tests_user_id_tested_at
  on public.water_tests (user_id, tested_at desc);

-- ─── feedback ────────────────────────────────────────────────
-- Floating feedback widget submissions
create table if not exists public.feedback (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete set null,
  type            text not null, -- 'bug' | 'idea' | 'love'
  message         text not null,
  app_version     text,
  created_at      timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Users can submit feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id or user_id is null);

-- ─── Verify ──────────────────────────────────────────────────
-- Quick sanity check — run after migration:
-- select table_name, row_security from information_schema.tables
-- where table_schema = 'public' and table_type = 'BASE TABLE';
