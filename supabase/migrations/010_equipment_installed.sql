-- File: supabase/migrations/010_equipment_installed.sql
-- Equipment install date (beta feedback, July 2026).
-- Owner-entered date the equipment was installed — drives the "new
-- equipment" marker on the chemistry timeline (falls back to created_at)
-- and rounds out the warranty/service record. Nullable.
--
-- equipment already has RLS + owner-scoped policies (006/008); a new
-- column inherits them, no policy changes needed.

alter table public.equipment
  add column if not exists installed_at date;
