-- File: supabase/migrations/011_equipment_legacy_nullable.sql
-- Fix: equipment inserts failed with a NOT NULL violation on a legacy column.
--
-- The production `equipment` table was originally created via the dashboard
-- and carries vestigial columns the app never writes (name, installed,
-- life_years, status, last_service, note). `name` was NOT NULL with no
-- default, so every insert from the app — which supplies `type`, not `name` —
-- was rejected before RLS even applied ("Couldn't save that…").
--
-- We don't use these columns, so relax NOT NULL on them. Guarded by column
-- existence so this is safe on clean environments (migration 006) that never
-- had the legacy columns. No data is touched or dropped.

do $$
declare
  col text;
begin
  foreach col in array array['name','installed','life_years','status','last_service','note']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'equipment' and column_name = col
    ) then
      execute format('alter table public.equipment alter column %I drop not null;', col);
    end if;
  end loop;
end $$;
