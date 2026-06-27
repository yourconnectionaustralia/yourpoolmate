-- File: supabase/migrations/008_reconcile.sql
-- Reconcile the production `equipment` table with migration 006.
-- Some environments had an `equipment` table missing the columns 006 defines
-- (error 42703: column equipment.type does not exist). Idempotent + safe to
-- re-run; brings any environment up to the 006 shape.

create table if not exists public.equipment (
  id      uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade
);

alter table public.equipment add column if not exists type       text;
alter table public.equipment add column if not exists brand      text;
alter table public.equipment add column if not exists model      text;
alter table public.equipment add column if not exists notes      text;
alter table public.equipment add column if not exists created_at timestamptz not null default now();
alter table public.equipment add column if not exists updated_at timestamptz not null default now();

alter table public.equipment enable row level security;

drop policy if exists "Users can view their own equipment"   on public.equipment;
drop policy if exists "Users can insert their own equipment" on public.equipment;
drop policy if exists "Users can update their own equipment" on public.equipment;
drop policy if exists "Users can delete their own equipment" on public.equipment;

create policy "Users can view their own equipment"   on public.equipment for select using (auth.uid() = user_id);
create policy "Users can insert their own equipment" on public.equipment for insert with check (auth.uid() = user_id);
create policy "Users can update their own equipment" on public.equipment for update using (auth.uid() = user_id);
create policy "Users can delete their own equipment" on public.equipment for delete using (auth.uid() = user_id);

create index if not exists equipment_user on public.equipment (user_id);
