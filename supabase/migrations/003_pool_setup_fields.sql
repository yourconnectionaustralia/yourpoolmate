-- File: supabase/migrations/003_pool_setup_fields.sql
-- Your Pool Mate — Expanded Pool Setup fields
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- Adds the columns introduced by the expanded Pool Setup tab so a pool profile
-- can be persisted in full. All additions are nullable / defaulted, so existing
-- rows and the auto-create trigger keep working untouched.
--
-- Frontend field  →  column mapping (SetupPage in src/App.jsx):
--   name            → name
--   type            → pool_type
--   shape           → pool_shape        (already exists, 001)
--   surface         → pool_surface
--   volumeL         → volume_litres     (already exists, 001 — app now stores litres)
--   sanitiser       → sanitiser_type    (already exists, 001)
--   filter          → filter_type       (already exists, 001)
--   yearBuilt       → year_built
--   yearBuiltApprox → year_built_approx
--   hasCover        → has_cover

alter table public.pool_profiles
  add column if not exists name             text,
  add column if not exists pool_type        text,    -- 'In-ground', 'Above-ground', 'Plunge pool', 'Container pool', 'Lap pool', 'Indoor pool', 'Spa / spool', 'Swim spa'
  add column if not exists pool_surface     text,    -- 'Pebble / pebblecrete', 'Concrete / rendered', 'Fibreglass', 'Vinyl liner', 'Fully tiled', 'Painted concrete', 'Other'
  add column if not exists year_built       integer, -- null when unknown ("Not sure")
  add column if not exists year_built_approx boolean not null default false, -- true = approximate / best guess
  add column if not exists has_cover        boolean not null default false;  -- pool cover yes/no

-- Optional sanity constraint: keep year_built within a sensible window when set.
-- NOTE: CHECK constraints must be IMMUTABLE, so we use a fixed upper bound
-- (not now()/extract, which Postgres rejects here).
alter table public.pool_profiles
  drop constraint if exists pool_profiles_year_built_range;
alter table public.pool_profiles
  add constraint pool_profiles_year_built_range
  check (year_built is null or (year_built >= 1900 and year_built <= 2100));

-- Note on existing columns (no change required, documented for clarity):
--   pool_shape      now receives values like 'Rectangular', 'Oval', 'Kidney / freeform', 'Round', 'L-shaped', 'Square', 'Figure-8', 'Other'
--   sanitiser_type  now receives readable labels: 'Chlorine (granular/liquid)', 'Saltwater chlorinator',
--                   'Mineral / magnesium', 'Ozone', 'Freshwater system', 'UV', 'Bromine', 'Other'
--   filter_type     now receives 'Sand', 'Glass media', 'Cartridge', 'Diatomaceous earth (DE)', 'Zeolite', 'Other'
--   These columns are free text, so the broader label set stores without further migration.

-- ─── Verify ──────────────────────────────────────────────────
-- After running, confirm the new columns exist:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'pool_profiles'
-- order by ordinal_position;
