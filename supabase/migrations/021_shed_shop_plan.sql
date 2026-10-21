-- File: supabase/migrations/021_shed_shop_plan.sql
-- Your Pool Mate — My Shed, shopping list, dose detail and pump settings (Oct 2026)
-- Run AFTER 020_reminders_and_report.sql.
--
-- Applied only when someone runs Deploy Supabase by hand (workflow_dispatch).
-- The app works before this runs: Shed, shopping list and Costs say they are
-- not switched on yet, and doses save as they did before.
--
-- 1. pool_profiles  — pump hours (daily and by season) and chlorinator output
--                     and cell size, for the chlorinator estimate.
-- 2. pool_events    — a dose now records which test and step it was for, the
--                     product, the amount, what it cost from the owner's own
--                     prices, and which shed items it drew from. The plan's
--                     "added" ticks come from these rows, so they follow the
--                     owner to every device.
-- 3. shed_items     — chemicals the owner has bought. Stock left is computed
--                     in the app: bought − what doses drew. No running balance.
-- 4. shop_items     — the shopping list.
-- 5. user_profiles.app_prefs — small per-member settings (pinned shortcuts).
--
-- RLS: every new table is owner-only for select, insert, update and delete.

-- ─── 1. Pump and chlorinator settings ────────────────────────
alter table public.pool_profiles
  add column if not exists pump_hours_per_day        smallint,
  add column if not exists pump_hours_summer         smallint,
  add column if not exists pump_hours_autumn         smallint,
  add column if not exists pump_hours_winter         smallint,
  add column if not exists pump_hours_spring         smallint,
  add column if not exists pump_schedule_note        text,
  add column if not exists chlorinator_output_percent smallint,
  add column if not exists chlorinator_cell_g_per_hour numeric(4,1);

alter table public.pool_profiles drop constraint if exists pool_profiles_pump_settings_check;
alter table public.pool_profiles add constraint pool_profiles_pump_settings_check check (
  (pump_hours_per_day is null or pump_hours_per_day between 0 and 24)
  and (pump_hours_summer is null or pump_hours_summer between 0 and 24)
  and (pump_hours_autumn is null or pump_hours_autumn between 0 and 24)
  and (pump_hours_winter is null or pump_hours_winter between 0 and 24)
  and (pump_hours_spring is null or pump_hours_spring between 0 and 24)
  and char_length(coalesce(pump_schedule_note, '')) <= 200
  and (chlorinator_output_percent is null or chlorinator_output_percent between 0 and 100)
  and (chlorinator_cell_g_per_hour is null or chlorinator_cell_g_per_hour between 1 and 100)
);

-- ─── 2. Dose detail on the history ───────────────────────────
alter table public.pool_events
  add column if not exists test_id     uuid references public.water_tests(id) on delete set null,
  add column if not exists step_key    text,
  add column if not exists product     text,
  add column if not exists grams       numeric(10,1),
  add column if not exists millilitres numeric(10,1),
  add column if not exists cost_aud    numeric(8,2),
  add column if not exists shed_draw   jsonb;

alter table public.pool_events drop constraint if exists pool_events_dose_detail_check;
alter table public.pool_events add constraint pool_events_dose_detail_check check (
  char_length(coalesce(step_key, '')) <= 40
  and char_length(coalesce(product, '')) <= 120
  and (grams is null or grams >= 0)
  and (millilitres is null or millilitres >= 0)
  and (cost_aud is null or cost_aud between 0 and 10000)
  and (shed_draw is null or (jsonb_typeof(shed_draw) = 'array' and length(shed_draw::text) <= 4000))
);

create index if not exists pool_events_user_test
  on public.pool_events (user_id, test_id) where test_id is not null;

-- ─── 3. My Shed ──────────────────────────────────────────────
create table if not exists public.shed_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  product_key  text not null,
  label        text not null,
  pack_amount  numeric(8,2) not null,
  pack_unit    text not null,
  packs        smallint not null default 1,
  price_aud    numeric(8,2),
  bought_at    date not null default current_date,
  store        text,
  source       text not null default 'typed',
  receipt_id   uuid,
  created_at   timestamptz not null default now(),
  constraint shed_items_check check (
    char_length(product_key) <= 40
    and char_length(label) between 1 and 120
    and pack_amount > 0 and pack_amount <= 100000
    and pack_unit in ('g', 'kg', 'mL', 'L')
    and packs between 1 and 100
    and (price_aud is null or price_aud between 0 and 10000)
    and char_length(coalesce(store, '')) <= 80
    and source in ('typed', 'receipt', 'shopping_list')
  )
);

alter table public.shed_items enable row level security;

drop policy if exists "Users can view their own shed"   on public.shed_items;
drop policy if exists "Users can insert their own shed" on public.shed_items;
drop policy if exists "Users can update their own shed" on public.shed_items;
drop policy if exists "Users can delete their own shed" on public.shed_items;
create policy "Users can view their own shed"   on public.shed_items for select using (auth.uid() = user_id);
create policy "Users can insert their own shed" on public.shed_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own shed" on public.shed_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own shed" on public.shed_items for delete using (auth.uid() = user_id);

create index if not exists shed_items_user on public.shed_items (user_id, bought_at);

-- ─── 4. Shopping list ────────────────────────────────────────
create table if not exists public.shop_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  product         text not null,
  product_key     text,
  quantity        numeric(10,1) not null default 0,
  quantity_label  text,
  form            text not null default 'other',
  status          text not null default 'needed',
  source          text not null default 'manual',
  test_id         uuid references public.water_tests(id) on delete set null,
  step_key        text,
  step_title      text,
  bought_at       timestamptz,
  created_at      timestamptz not null default now(),
  constraint shop_items_check check (
    char_length(product) between 1 and 120
    and char_length(coalesce(product_key, '')) <= 40
    and quantity >= 0 and quantity <= 1000000
    and char_length(coalesce(quantity_label, '')) <= 60
    and form in ('mass', 'volume', 'other')
    and status in ('needed', 'bought')
    and source in ('manual', 'skip', 'plan')
    and char_length(coalesce(step_key, '')) <= 40
    and char_length(coalesce(step_title, '')) <= 80
  )
);

alter table public.shop_items enable row level security;

drop policy if exists "Users can view their own shopping list"   on public.shop_items;
drop policy if exists "Users can insert their own shopping list" on public.shop_items;
drop policy if exists "Users can update their own shopping list" on public.shop_items;
drop policy if exists "Users can delete their own shopping list" on public.shop_items;
create policy "Users can view their own shopping list"   on public.shop_items for select using (auth.uid() = user_id);
create policy "Users can insert their own shopping list" on public.shop_items for insert with check (auth.uid() = user_id);
create policy "Users can update their own shopping list" on public.shop_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own shopping list" on public.shop_items for delete using (auth.uid() = user_id);

create index if not exists shop_items_user on public.shop_items (user_id, created_at desc);

-- Abuse guard: a shopping list or shed does not need thousands of rows.
-- Runs as the member, so RLS limits the count to their own rows anyway.
create or replace function public.limit_rows_per_user()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= 500 then
    raise exception 'Too many items. Remove some old ones first.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists shed_items_limit on public.shed_items;
create trigger shed_items_limit before insert on public.shed_items
  for each row execute function public.limit_rows_per_user();
drop trigger if exists shop_items_limit on public.shop_items;
create trigger shop_items_limit before insert on public.shop_items
  for each row execute function public.limit_rows_per_user();

-- ─── 5. Member app settings ──────────────────────────────────
alter table public.user_profiles
  add column if not exists app_prefs jsonb not null default '{}'::jsonb;

alter table public.user_profiles drop constraint if exists user_profiles_app_prefs_check;
alter table public.user_profiles add constraint user_profiles_app_prefs_check
  check (jsonb_typeof(app_prefs) = 'object' and length(app_prefs::text) <= 2000);

-- Table-level UPDATE stays revoked (migration 017). Members may write only
-- this column alongside the location and reminder columns.
grant update (app_prefs) on public.user_profiles to authenticated;

-- ─── Verify ──────────────────────────────────────────────────
-- select relname, relrowsecurity from pg_class where relname in ('shed_items', 'shop_items');
-- select column_name from information_schema.columns where table_name = 'pool_events' and column_name in ('test_id', 'shed_draw');
