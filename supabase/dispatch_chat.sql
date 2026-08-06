-- ============================================================================
-- DISPATCH CHAT — internal real-time messaging for the 5 admin accounts only.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: admin_roles.sql (admin_roles table, is_admin() helper) already run.
--
-- SCOPE: admin-to-admin only. Never touches parents/cadets/reviewers. This
-- project's `authenticated` role is NOT admins-only — email_reviewers also
-- sign in through the same Supabase Auth pool (see getReviewer() in
-- supabase/functions/_shared/supabase.ts). The real gate against reviewer
-- accounts leaking into chat is structural, not a per-policy role check:
-- conversation_participants has NO insert policy for `authenticated` at all —
-- the ONLY way to become a participant is create_conversation() below, which
-- checks is_admin() and validates every email against admin_roles. Every
-- downstream policy (is_conversation_participant()) can then trust that a
-- participant row implies a real admin, without re-checking is_admin()
-- everywhere.
--
-- REALTIME: this is the first feature in the codebase to use Supabase
-- Realtime. SECTION 5 adds `messages` + `conversation_participants` to the
-- supabase_realtime publication — required for postgres_changes to stream
-- anything. After running this file, confirm both tables show enabled under
-- Database → Replication in the dashboard; that toggle can't be verified from
-- SQL alone. postgres_changes is RLS-aware: a subscribed client only receives
-- rows it could SELECT anyway, same as a normal query — so the client can
-- subscribe unfiltered and still only ever see its own conversations. THIS IS
-- THE ONE ASSUMPTION THAT MUST BE PROVEN BEFORE ANY UI IS BUILT ON TOP OF IT
-- (see Phase 1 smoke test).
-- ============================================================================


-- ── SECTION 1 — tables ──────────────────────────────────────────────────────
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  is_group    boolean not null default false,
  title       text,                              -- group name only; null for DMs
  created_by  text not null default (auth.jwt()->>'email'),
  created_at  timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  email           text not null,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, email)
);
create index if not exists conversation_participants_email_idx
  on public.conversation_participants(email);

create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  sender_email        text not null default (auth.jwt()->>'email'),
  body                text,
  attachment_path     text,
  attachment_filename text,
  attachment_size     integer,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz                       -- soft-delete tombstone; sender-only
);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at);

-- Heartbeat for "is this recipient actively in DISPATCH right now" — read by
-- the notify-new-message edge function to decide whether to email (Phase 5).
-- References admin_roles, so a reviewer's row is rejected by the FK alone even
-- before the RLS policy below runs.
create table if not exists public.admin_presence (
  email        text primary key references public.admin_roles(email) on delete cascade,
  last_seen_at timestamptz not null default now()
);


-- ── SECTION 2 — recursion-safe participant-membership helper ───────────────
-- SECURITY DEFINER so it reads conversation_participants around that table's
-- OWN RLS instead of through it — same technique admin_roles.sql's is_s6()
-- uses on admin_roles. Without this, a policy on conversation_participants
-- that queries conversation_participants to check membership is a
-- self-referential policy and Postgres will refuse it (infinite recursion).
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;


-- ── SECTION 3 — atomic conversation creation ────────────────────────────────
-- The only path that can ever populate conversation_participants (no direct
-- insert policy exists below) — see the file header for why that matters.
-- Wraps conversation + participant rows in one transaction so a dropped
-- connection can never leave a conversation with zero participants.
-- Group membership is fixed at creation (product decision, v1) — there is
-- deliberately no add/remove-member path.
create or replace function public.create_conversation(
  p_participant_emails text[],
  p_is_group boolean,
  p_title text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id         uuid;
  v_caller     text := lower(auth.jwt() ->> 'email');
  v_all        text[];
  v_bad_count  int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  v_all := array(select distinct lower(e) from unnest(p_participant_emails || array[v_caller]) e);

  select count(*) into v_bad_count
    from unnest(v_all) e
    where not exists (select 1 from public.admin_roles a where lower(a.email) = e);
  if v_bad_count > 0 then
    raise exception 'all participants must be DISPATCH admin accounts';
  end if;

  if not p_is_group and array_length(v_all, 1) <> 2 then
    raise exception 'a direct conversation must have exactly 2 participants';
  end if;

  insert into public.conversations (is_group, title) values (p_is_group, p_title) returning id into v_id;
  insert into public.conversation_participants (conversation_id, email)
    select v_id, e from unnest(v_all) e;

  return v_id;
end $$;

revoke execute on function public.create_conversation(text[], boolean, text) from public;
grant  execute on function public.create_conversation(text[], boolean, text) to authenticated;


-- ── SECTION 4 — RLS ──────────────────────────────────────────────────────────
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.admin_presence            enable row level security;

-- conversations: read-only to participants. No insert policy — only
-- create_conversation() (SECURITY DEFINER) can create rows.
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select to authenticated
  using (public.is_conversation_participant(id));

-- conversation_participants: read-only to fellow participants. UPDATE is
-- column-scoped to last_read_at (own row) via the grant below, matching the
-- account_picker.sql display_name/photo_url pattern — a broad USING/WITH
-- CHECK alone would let a caller rewrite any column of any row it can see.
-- DELETE own row only = "leave conversation", and only for groups (a 2-person
-- DM cannot be left, enforced here server-side, not just hidden in the UI).
drop policy if exists conversation_participants_read on public.conversation_participants;
create policy conversation_participants_read on public.conversation_participants
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists conversation_participants_update_own on public.conversation_participants;
create policy conversation_participants_update_own on public.conversation_participants
  for update to authenticated
  using      (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

revoke update on public.conversation_participants from authenticated;
grant  update (last_read_at) on public.conversation_participants to authenticated;

drop policy if exists conversation_participants_leave on public.conversation_participants;
create policy conversation_participants_leave on public.conversation_participants
  for delete to authenticated
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.is_group)
  );

-- messages: read-only to participants. INSERT requires the caller to be a
-- participant AND the sender of record — the WITH CHECK blocks a spoofed
-- sender_email even though the column also defaults from the JWT. UPDATE is
-- column-scoped to deleted_at (own messages only) — a tombstone, not a real
-- delete, so other participants keep seeing "[message deleted]" instead of a
-- silent gap.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    public.is_conversation_participant(conversation_id)
    and lower(sender_email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for update to authenticated
  using      (lower(sender_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(sender_email) = lower(auth.jwt() ->> 'email'));

revoke update on public.messages from authenticated;
grant  update (deleted_at) on public.messages to authenticated;

-- admin_presence: any admin may read the whole roster (needed to show
-- colleagues' online dots); a caller may only write their own heartbeat row.
-- The FK to admin_roles already rejects a reviewer's row at the DB level;
-- is_admin() here is belt-and-suspenders clarity, not the only control.
drop policy if exists admin_presence_read on public.admin_presence;
create policy admin_presence_read on public.admin_presence
  for select to authenticated using (public.is_admin());

drop policy if exists admin_presence_upsert_own on public.admin_presence;
create policy admin_presence_upsert_own on public.admin_presence
  for insert to authenticated
  with check (public.is_admin() and lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists admin_presence_update_own on public.admin_presence;
create policy admin_presence_update_own on public.admin_presence
  for update to authenticated
  using      (public.is_admin() and lower(email) = lower(auth.jwt() ->> 'email'))
  with check (public.is_admin() and lower(email) = lower(auth.jwt() ->> 'email'));


-- ── SECTION 5 — Realtime publication ────────────────────────────────────────
-- Required or postgres_changes streams nothing for these tables, regardless
-- of the project-level Realtime toggle. conversations is deliberately NOT
-- added — its row count per admin is tiny and it only changes on creation,
-- which the client already has (it just called create_conversation()); the
-- list view live-updates by reacting to new `messages` rows instead.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_participants;


-- ── SECTION 6 — private attachment bucket ───────────────────────────────────
-- Private (unlike email-attachments, which is public because Resend fetches
-- by URL) — gated per-conversation via the same is_conversation_participant()
-- helper, keyed off the storage path convention {conversation_id}/{filename}.
-- 8MB / PDF+image+doc(x), same limits as EmailBuilder.jsx's ATTACH_BUCKET.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', false, 8388608,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_attachments_read  on storage.objects;
drop policy if exists chat_attachments_write on storage.objects;
create policy chat_attachments_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  );
create policy chat_attachments_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select * from pg_publication_tables where pubname = 'supabase_realtime';
--     -- expect: messages, conversation_participants (plus any pre-existing rows)
--   select * from storage.buckets where id = 'chat-attachments';
--   -- as a non-admin (or logged out), confirm these all fail/return empty:
--   select * from public.conversations;
--   select * from public.messages;
--   select public.create_conversation(array['someone@x.com'], false, null);
-- ============================================================================
