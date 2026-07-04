-- File: supabase/migrations/009_fence_cert.sql
-- Pool fencing certificate date on the pool profile (beta feedback, July 2026).
-- Extends the compliance/warranty record: AU pool fencing compliance
-- certificates matter at sale and inspection time. Nullable — most owners
-- won't have the date to hand.
--
-- pool_profiles already has RLS + owner-scoped policies (001/004); a new
-- column inherits them, no policy changes needed.

alter table public.pool_profiles
  add column if not exists fence_cert_date date;
