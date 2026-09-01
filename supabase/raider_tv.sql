-- ============================================================================
-- RAIDER FILM REVIEW — /raidertv (display) + /raiderremote (phone control) +
-- the DISPATCH "Raider TV" panel (video library). Run in the Supabase SQL
-- editor (idempotent). Depends on admin_roles.sql for public.is_admin().
--
-- MODEL: the TV at /raidertv creates a *session* row on load and shows a
-- 6-character PAIR CODE. The phone at /raiderremote enters that code to bind
-- to the same session row, then drives playback by writing the "intent"
-- columns; the TV writes the "status" columns back. Both sides watch the row
-- over Supabase Realtime (postgres_changes) — the same mechanism
-- useTvDailySettings.js uses for the kiosks.
--
-- Sessions are ephemeral: a pg_cron sweep drops any not seen for 30 minutes.
-- The video library (raider_videos + the raider-videos bucket) is durable and
-- DISPATCH-managed (is_admin() writes only).
--
-- SECURITY NOTE: raider_tv_sessions is anon-writable — the phone remote has no
-- login, same call the no-login TV schedule picker makes. Scope is a single
-- practice-room TV; write access is gated only by knowing a live 6-char code
-- that is shown on that screen and swept within 30 min of the TV going idle.
-- This is an explicit, accepted tradeoff for THIS surface — do not copy the
-- openness to anything carrying PII or durable state.
-- ============================================================================

-- ── Video library ───────────────────────────────────────────────────────────
create table if not exists public.raider_videos (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  storage_path text not null,
  duration_sec numeric,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  created_by   text
);

alter table public.raider_videos enable row level security;

drop policy if exists raider_videos_select on public.raider_videos;
drop policy if exists raider_videos_write  on public.raider_videos;

-- TV + remote are both anon; either may list the library.
create policy raider_videos_select on public.raider_videos
  for select using (true);

-- Only signed-in DISPATCH admins may add / rename / reorder / delete. To let
-- S-5 manage videos too, swap is_admin() for (is_s6() or is_s5()).
create policy raider_videos_write on public.raider_videos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.raider_videos to anon, authenticated;
grant insert, update, delete on public.raider_videos to authenticated;

-- ── Sessions (the TV <-> remote channel) ────────────────────────────────────
create table if not exists public.raider_tv_sessions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  -- intent — written by the phone remote
  video_id      uuid references public.raider_videos(id) on delete set null,
  playing       boolean not null default false,
  rate          numeric not null default 1,
  seek_to_sec   numeric,
  loop          boolean not null default false,
  ab_start_sec  numeric,
  ab_end_sec    numeric,
  command_id    uuid,

  -- status — written by the TV
  tv_position_sec  numeric not null default 0,
  tv_duration_sec  numeric,
  tv_ready         boolean not null default false
);

create index if not exists raider_tv_sessions_code_idx on public.raider_tv_sessions(code);
create index if not exists raider_tv_sessions_seen_idx on public.raider_tv_sessions(last_seen_at);

alter table public.raider_tv_sessions enable row level security;

drop policy if exists raider_tv_sessions_select on public.raider_tv_sessions;
drop policy if exists raider_tv_sessions_insert on public.raider_tv_sessions;
drop policy if exists raider_tv_sessions_update on public.raider_tv_sessions;

create policy raider_tv_sessions_select on public.raider_tv_sessions for select using (true);
create policy raider_tv_sessions_insert on public.raider_tv_sessions for insert with check (true);
create policy raider_tv_sessions_update on public.raider_tv_sessions for update using (true) with check (true);
-- No delete policy — the sweep function below runs security definer.

grant select, insert, update on public.raider_tv_sessions to anon, authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'raider_tv_sessions'
  ) then
    alter publication supabase_realtime add table public.raider_tv_sessions;
  end if;
end $$;

-- ── Idle-session sweep ──────────────────────────────────────────────────────
create or replace function public.sweep_raider_tv_sessions()
returns void language sql security definer set search_path = public as $$
  delete from public.raider_tv_sessions where last_seen_at < now() - interval '30 minutes';
$$;

do $$ begin
  perform cron.unschedule('sweep-raider-tv-sessions');
exception when others then null; end $$;
select cron.schedule('sweep-raider-tv-sessions', '*/10 * * * *', $$select public.sweep_raider_tv_sessions()$$);

-- ── Storage bucket ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('raider-videos', 'raider-videos', true)
  on conflict (id) do nothing;

drop policy if exists raider_videos_obj_read   on storage.objects;
drop policy if exists raider_videos_obj_insert on storage.objects;
drop policy if exists raider_videos_obj_delete on storage.objects;

create policy raider_videos_obj_read on storage.objects
  for select using (bucket_id = 'raider-videos');
create policy raider_videos_obj_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'raider-videos');
create policy raider_videos_obj_delete on storage.objects
  for delete to authenticated using (bucket_id = 'raider-videos');

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select * from public.raider_tv_sessions;
--   select * from pg_publication_tables where pubname='supabase_realtime' and tablename='raider_tv_sessions';
--   select jobname, schedule from cron.job where jobname='sweep-raider-tv-sessions';
--   select id, public from storage.buckets where id='raider-videos';
-- ============================================================================
