-- 025_security_hardening.sql
-- Fixes from the YPM security review (7 Nov 2026): H1, H2, M4, M5, L1, L2, L3.
--
-- IMPORTANT FOR EVERY FUTURE MIGRATION
-- After this file, new tables in `public` get NO automatic access for the
-- anon or authenticated roles (default privileges are revoked in section M4).
-- Any new table the app reads or writes as a signed-in user needs, next to its
-- RLS policies:
--     grant select, insert, update, delete on public.<table> to authenticated;
-- service_role keeps full access. Without the grant the app fails with
-- "permission denied for table <table>" even though the policies are right.
--
-- Everything here is safe to run once. It is written so a re-run is harmless.

-- ═══ H1. AI credit: atomic quotas, per-IP and global ceilings ═══════════════
alter table public.ocr_calls add column if not exists ip_hash text;
create index if not exists ocr_calls_ip_hash_idx on public.ocr_calls (ip_hash, created_at);

-- Locks, counts and records in one step, so a burst of parallel requests cannot
-- all pass the check. Returns 'ok' | 'global' | 'ip' | 'user'.
-- Rows marked 'rejected' or 'refunded' never count against anyone.
create or replace function public.claim_ocr_call(
  p_user uuid, p_ip_hash text, p_anonymous boolean,
  p_member_limit int default 10, p_guest_limit int default 3,
  p_ip_limit int default 20, p_global_limit int default 300, p_minutes int default 60)
returns text language plpgsql security definer set search_path = '' as $$
declare
  since timestamptz := now() - make_interval(mins => p_minutes);
  n_user int; n_ip int; n_all int; lim int;
begin
  perform pg_advisory_xact_lock(hashtextextended('ocr', 0));
  select count(*) filter (where user_id = p_user),
         count(*) filter (where ip_hash = p_ip_hash),
         count(*)
    into n_user, n_ip, n_all
    from public.ocr_calls
    where created_at >= since and coalesce(status, '') not in ('rejected', 'refunded');
  if n_all >= p_global_limit then return 'global'; end if;
  if n_ip >= p_ip_limit then return 'ip'; end if;
  lim := case when p_anonymous then p_guest_limit else p_member_limit end;
  if n_user >= lim then return 'user'; end if;
  insert into public.ocr_calls (user_id, ip_hash, status) values (p_user, p_ip_hash, 'pending');
  return 'ok';
end $$;

-- Settles the newest 'pending' claim for a user once the Anthropic call is
-- finished: 'ok', 'error', or 'refunded' (our own billing/key failure, which
-- must not use up one of the member's scans).
create or replace function public.finish_ocr_call(p_user uuid, p_status text)
returns void language sql security definer set search_path = '' as $$
  update public.ocr_calls set status = p_status
  where id = (
    select id from public.ocr_calls
    where user_id = p_user and status = 'pending'
    order by created_at desc limit 1)
$$;

revoke execute on function public.claim_ocr_call(uuid, text, boolean, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.claim_ocr_call(uuid, text, boolean, int, int, int, int, int) to service_role;
revoke execute on function public.finish_ocr_call(uuid, text) from public, anon, authenticated;
grant execute on function public.finish_ocr_call(uuid, text) to service_role;

-- Ask Mate: claims the member's monthly chat slot atomically, before Claude is called.
create or replace function public.claim_chat_session(p_user uuid, p_limit int, p_from timestamptz, p_to timestamptz, p_title text default 'New chat')
returns uuid language plpgsql security definer set search_path = '' as $$
declare used int; sid uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('chat:' || p_user::text, 0));
  select count(*) into used from public.chat_sessions
    where user_id = p_user and created_at >= p_from and created_at < p_to;
  if used >= p_limit then return null; end if;
  insert into public.chat_sessions (user_id, title) values (p_user, left(p_title, 120)) returning id into sid;
  return sid;
end $$;
revoke execute on function public.claim_chat_session(uuid, int, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_chat_session(uuid, int, timestamptz, timestamptz, text) to service_role;

-- ═══ H2. Anonymous inserts ═════════════════════════════════════════════════
-- Close the two anonymous paths the app does not use.
drop policy if exists "Anyone can submit feedback" on public.feedback;
drop policy if exists "Authenticated users can submit feedback" on public.feedback;
drop policy if exists "suggestions: insert by anyone" on public.suggestions;

-- Cap the one live path (the beta feedback overlay): anonymous rows per hour.
create or replace function public.cap_anon_inserts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recent int; cap int;
begin
  cap := coalesce(tg_argv[0]::int, 30);
  if auth.uid() is null then
    execute format('select count(*) from %I.%I where created_at > now() - interval ''1 hour''', tg_table_schema, tg_table_name) into recent;
    if recent >= cap then
      raise exception 'Too many submissions right now. Try again later.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.cap_anon_inserts() from public, anon, authenticated;
drop trigger if exists cap_anon_feedback_rounds on public.feedback_rounds;
create trigger cap_anon_feedback_rounds before insert on public.feedback_rounds
  for each row execute function public.cap_anon_inserts(30);

-- ═══ M4. Grants: least privilege ═══════════════════════════════════════════
-- anon: nothing, then re-grant the one live insert-only path.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant insert on public.feedback_rounds to anon;
-- members: drop rights the app never uses (RLS still limits the rest).
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, delete on public.user_profiles from authenticated;
-- future tables get no automatic access (see the note at the top of this file).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- ═══ M5. Unused test-photos bucket: cap it and close uploads ═══════════════
-- Nothing in the app uses this bucket. One old file may still sit in it, so it
-- is kept readable/deletable by its owner, but nobody can add more.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'test-photos';
drop policy if exists "Users upload own photos" on storage.objects;

-- ═══ L1. Functions: fixed search_path, no API rights on trigger functions ══
alter function public.protect_premium_fields() set search_path = public;
alter function public.throttle_feedback() set search_path = public;
alter function public.water_tests_track_edit() set search_path = public;
revoke execute on function public.handle_new_user(), public.limit_rows_per_user(),
  public.protect_premium_fields(), public.throttle_feedback(), public.water_tests_track_edit()
  from public, anon, authenticated;

-- ═══ L2. Policies: members only, no duplicates ═════════════════════════════
drop policy if exists "Users delete own equipment" on public.equipment;
drop policy if exists "Users insert own equipment" on public.equipment;
drop policy if exists "Users read own equipment" on public.equipment;
drop policy if exists "Users update own equipment" on public.equipment;
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and roles = '{public}' and tablename <> 'feedback_rounds'
  loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end $$;

-- ═══ L3. Leftover tables ═══════════════════════════════════════════════════
-- `notes` is empty and unused: drop it.
-- `profiles` (old pre-migration table with name/address columns) still holds a
-- few legacy rows, so it is NOT dropped here: it is locked away from the API
-- instead. `feedback` is only touched by account deletion, so it stays too.
drop table if exists public.notes;
revoke all on public.profiles from anon, authenticated;
