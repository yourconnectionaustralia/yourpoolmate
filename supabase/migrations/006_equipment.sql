-- File: supabase/migrations/006_equipment.sql
-- Your Pool Mate — Equipment register
-- Applied automatically by CI. Backs the Equipment page (was local-state only).

create table if not exists public.equipment (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,   -- 'Pump', 'Filter', 'Salt Chlorinator', ...
  brand       text,
  model       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.equipment enable row level security;

create policy "Users can view their own equipment"
  on public.equipment for select using (auth.uid() = user_id);
create policy "Users can insert their own equipment"
  on public.equipment for insert with check (auth.uid() = user_id);
create policy "Users can update their own equipment"
  on public.equipment for update using (auth.uid() = user_id);
create policy "Users can delete their own equipment"
  on public.equipment for delete using (auth.uid() = user_id);

create index if not exists equipment_user on public.equipment (user_id);
