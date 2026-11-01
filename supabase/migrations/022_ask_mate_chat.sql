-- File: supabase/migrations/022_ask_mate_chat.sql
-- Your Pool Mate — Ask Mate (in-app AI chat)
--
-- One row per chat in chat_sessions, one row per question or answer in
-- chat_messages. Owners can read their own chats. Only the pool-chat Edge
-- Function (service role) writes, so nobody can add answers of their own or
-- delete chats to get their monthly allowance back.

create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Chat' check (char_length(title) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) <= 8000),
  created_at  timestamptz not null default now()
);

create index if not exists chat_sessions_user_recent
  on public.chat_sessions (user_id, created_at desc);
create index if not exists chat_messages_session_order
  on public.chat_messages (session_id, created_at);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Owners read their chats" on public.chat_sessions;
create policy "Owners read their chats"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Owners read their chat messages" on public.chat_messages;
create policy "Owners read their chat messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

-- Read only for signed-in owners. No insert/update/delete policies: writes
-- come from the Edge Function with the service role.
revoke insert, update, delete on public.chat_sessions from anon, authenticated;
revoke insert, update, delete on public.chat_messages from anon, authenticated;
revoke all on public.chat_sessions from anon;
revoke all on public.chat_messages from anon;
grant select on public.chat_sessions to authenticated;
grant select on public.chat_messages to authenticated;

-- ─── Verify ──────────────────────────────────────────────────
-- As a signed-in user: select works on your own rows; insert is denied.
--   insert into public.chat_sessions (user_id) values (auth.uid());  -- permission denied
