-- File: supabase/migrations/019_printout_photos.sql
-- Your Pool Mate — keep the printout photo with the test (Oct 2026)
-- Run AFTER 018_test_edit_trail.sql.
--
-- A photo of the pool shop's dated printout is the evidence a warranty
-- assessor trusts. Each photo lives in a PRIVATE storage bucket, in a folder
-- named after the owner's user id: printouts/<user_id>/<test_id>.jpg.
-- Only that user can read, add, replace or delete files in their own folder.
-- Nothing is public. The app opens a photo with a short-lived signed link.

alter table public.water_tests
  add column if not exists printout_path text;

comment on column public.water_tests.printout_path is
  'Path of the printout photo in the private printouts bucket, <user_id>/<test_id>.jpg. Null = no photo kept.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('printouts', 'printouts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Printouts: owner can read"   on storage.objects;
drop policy if exists "Printouts: owner can add"    on storage.objects;
drop policy if exists "Printouts: owner can change" on storage.objects;
drop policy if exists "Printouts: owner can delete" on storage.objects;

create policy "Printouts: owner can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'printouts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Printouts: owner can add"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'printouts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Printouts: owner can change"
  on storage.objects for update to authenticated
  using (bucket_id = 'printouts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Printouts: owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'printouts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Verify ──────────────────────────────────────────────────
-- select id, public, file_size_limit from storage.buckets where id = 'printouts';
-- select policyname from pg_policies where schemaname = 'storage' and policyname like 'Printouts:%';
