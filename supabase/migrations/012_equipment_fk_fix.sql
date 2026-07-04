-- File: supabase/migrations/012_equipment_fk_fix.sql
-- Fix: equipment inserts failed with FK violation 23503
--   "Key is not present in table \"profiles\"".
--
-- The production equipment table (dashboard-created) had its user_id foreign
-- key pointing at a legacy `profiles` table instead of auth.users, which is
-- what migration 006 defines. Real users live in auth.users / user_profiles,
-- not that legacy table, so every insert was rejected by the FK — even after
-- 011 cleared the NOT NULL blocker on `name`.
--
-- Repoint the constraint at auth.users(id). Added NOT VALID so it enforces on
-- all new inserts/updates immediately without scanning (or failing on) any
-- pre-existing orphan rows — no data is read or deleted.

alter table public.equipment
  drop constraint if exists equipment_user_id_fkey;

alter table public.equipment
  add constraint equipment_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade
  not valid;
