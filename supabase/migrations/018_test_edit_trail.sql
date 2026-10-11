-- File: supabase/migrations/018_test_edit_trail.sql
-- Your Pool Mate — editing a water test keeps an honest trail (Oct 2026)
-- Run AFTER 017_member_location.sql.
--
-- Owners can now fix or delete a wrong reading. A water test is also the
-- warranty record, so an edit must show. The database stamps the edit and
-- keeps the readings as first saved. The app cannot set or clear either
-- column: the trigger overwrites whatever the client sends.
--
-- Changing only the stored score (the app recalculates it) is not an edit.
-- Deleting a test removes it. RLS already limits update and delete to the
-- owner (001_initial_schema.sql).

alter table public.water_tests
  add column if not exists edited_at         timestamptz,
  add column if not exists original_readings jsonb;

comment on column public.water_tests.edited_at is
  'Set by trigger when a reading or the test date was changed after the first save. Null = never edited.';
comment on column public.water_tests.original_readings is
  'Readings and test date as first saved, captured by trigger on the first edit. Null = never edited.';

create or replace function public.water_tests_track_edit()
returns trigger
language plpgsql
as $$
begin
  -- Client values for the audit columns are ignored.
  new.edited_at := old.edited_at;
  new.original_readings := old.original_readings;

  if (new.ph, new.free_chlorine, new.total_chlorine, new.alkalinity, new.cyanuric_acid,
      new.calcium, new.salt, new.phosphates, new.tds, new.tested_at)
     is distinct from
     (old.ph, old.free_chlorine, old.total_chlorine, old.alkalinity, old.cyanuric_acid,
      old.calcium, old.salt, old.phosphates, old.tds, old.tested_at)
  then
    new.edited_at := now();
    if old.original_readings is null then
      new.original_readings := jsonb_build_object(
        'ph', old.ph,
        'free_chlorine', old.free_chlorine,
        'total_chlorine', old.total_chlorine,
        'alkalinity', old.alkalinity,
        'cyanuric_acid', old.cyanuric_acid,
        'calcium', old.calcium,
        'salt', old.salt,
        'phosphates', old.phosphates,
        'tds', old.tds,
        'tested_at', old.tested_at,
        'health_score', old.health_score
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists water_tests_track_edit on public.water_tests;
create trigger water_tests_track_edit
  before update on public.water_tests
  for each row execute function public.water_tests_track_edit();

-- ─── Verify ──────────────────────────────────────────────────
-- update public.water_tests set ph = 7.0 where id = '<a test id>';
-- select edited_at, original_readings from public.water_tests where id = '<a test id>';
