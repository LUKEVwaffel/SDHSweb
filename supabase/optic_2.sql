-- ============================================================================
-- OPTIC 2.0 Beta — backend migration. Run in the Supabase SQL editor.
-- Idempotent + additive. Safe to run more than once.
--
-- What this does:
--   1. photos.taken_at            — real capture time read from EXIF client-side
--   2. raider_sub_events windows  — nullable starts_at / ends_at (set on-site)
--   3. optic_config              — camera clock offset + active event pointer
--   4. loosen photos_rate_limit  — kill the parent upload cap, keep a flood stop
--   5. optic_retag_photos(event) — schedule x taken_at -> sub_event + team
--
-- Depends on: rhea_comp_photos.sql (raider_sub_events, photos.raider_team /
-- .sub_event_id / .source), tv_photos.sql (is_luke), and public.is_admin().
-- Nothing here drops or rewrites an existing table.
-- ============================================================================


-- ── 1. capture time ─────────────────────────────────────────────────────────
-- Populated by the upload path from the file's EXIF DateTimeOriginal, read
-- BEFORE resize/HEIC-convert strips it (see src/lib/opticExif.js). NULL when
-- the file carries no EXIF (screenshots, some Android, re-saved images) — those
-- rows fall to created_at for ordering and never get an auto team tag.
alter table public.photos
  add column if not exists taken_at timestamptz;

create index if not exists photos_taken_at_idx on public.photos (taken_at);


-- ── 2. sub-event time windows ───────────────────────────────────────────────
-- One raider_sub_events row = one team's run of one event. starts_at / ends_at
-- are NULL when loaded from the MOI the night before; Luke fills / drags them
-- on-site as the schedule really shakes out. optic_retag_photos ignores any
-- row whose window is still NULL, so a half-filled schedule is safe to re-tag
-- against repeatedly.
alter table public.raider_sub_events
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

create index if not exists raider_sub_events_window_idx
  on public.raider_sub_events (event_id, starts_at, ends_at);


-- ── 3. OPTIC config (single row) ────────────────────────────────────────────
-- camera_offset_seconds: the camera clock error. Positive = camera runs fast,
-- so the retag RPC SUBTRACTS it from taken_at before matching windows.
-- active_event_id: which event the public /optic feed + retag target. Lets the
-- next comp be a one-row update instead of a code change.
create table if not exists public.optic_config (
  id                    text primary key default 'default',
  active_event_id       uuid references public.events(id) on delete set null,
  camera_offset_seconds integer not null default 0,
  updated_at            timestamptz not null default now()
);

insert into public.optic_config (id) values ('default')
  on conflict (id) do nothing;

alter table public.optic_config enable row level security;
drop policy if exists optic_config_read  on public.optic_config;
drop policy if exists optic_config_write on public.optic_config;
-- Public read: the feed needs active_event_id. Non-sensitive.
create policy optic_config_read on public.optic_config
  for select using (true);
create policy optic_config_write on public.optic_config
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ── 4. kill the parent upload cap ──────────────────────────────────────────
-- Was 150/hour per device (rhea_comp_photos.sql SECTION 4). A parent dumping a
-- day of stand photos legitimately blew past it mid-batch and lost their
-- selection. Luke's /lukeupload path sets uploader_fp = null and was never
-- limited. Keep only a loose flood stop so a runaway script still trips.
create or replace function public.photos_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.uploader_fp is not null then
    select count(*) into recent
      from public.photos
     where uploader_fp = new.uploader_fp
       and created_at > now() - interval '10 minutes';
    if recent >= 400 then
      raise exception 'upload flood stop reached (400 per 10 min per device)';
    end if;
  end if;
  return new;
end $$;


-- ── 5. schedule -> photo auto-tag ──────────────────────────────────────────
-- For every one of Luke's photos in the target event that has a taken_at:
-- shift it by the camera offset, find the single sub-event whose [starts_at,
-- ends_at) window contains it, and copy that row's id + team onto the photo.
-- No window match clears both (dead time between events — the photo still
-- posts, just with no chip and no team). Idempotent: only writes rows whose
-- assignment actually changed, so Luke can hit RE-TAG after every schedule
-- edit. Never touches visibility / status — nothing is hidden or published
-- here. Parent photos are left alone in v1 (add a p_include_parent flag later
-- if stand photos prove reliable enough to bucket).
create or replace function public.optic_retag_photos(p_event_id uuid)
returns table (tagged integer, dead integer)
language plpgsql security definer set search_path = public as $$
declare
  v_offset integer;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  select coalesce(camera_offset_seconds, 0) into v_offset
    from public.optic_config where id = 'default';
  v_offset := coalesce(v_offset, 0);

  with cand as (
    select p.id as photo_id,
           (p.taken_at - make_interval(secs => v_offset)) as shot_at
      from public.photos p
     where p.event_id = p_event_id
       and p.source   = 'luke'
       and p.taken_at is not null
  ),
  matched as (
    select c.photo_id, se.id as sub_event_id, se.team as raider_team
      from cand c
      left join lateral (
        select se.id, se.team
          from public.raider_sub_events se
         where se.event_id  = p_event_id
           and se.starts_at is not null
           and se.ends_at   is not null
           and c.shot_at >= se.starts_at
           and c.shot_at <  se.ends_at
         order by se.starts_at desc
         limit 1
      ) se on true
  )
  update public.photos p
     set sub_event_id = m.sub_event_id,
         raider_team  = m.raider_team
    from matched m
   where p.id = m.photo_id
     and (p.sub_event_id is distinct from m.sub_event_id
          or p.raider_team is distinct from m.raider_team);

  select count(*) filter (where sub_event_id is not null),
         count(*) filter (where sub_event_id is null)
    into tagged, dead
    from public.photos
   where event_id = p_event_id and source = 'luke' and taken_at is not null;

  return next;
end $$;

grant execute on function public.optic_retag_photos(uuid) to authenticated;


-- ============================================================================
-- Verify:
--   select column_name from information_schema.columns
--     where table_name = 'photos' and column_name = 'taken_at';           -- 1 row
--   select column_name from information_schema.columns
--     where table_name = 'raider_sub_events'
--       and column_name in ('starts_at','ends_at');                       -- 2 rows
--   select * from public.optic_config;                                    -- 1 row
--   select * from public.optic_retag_photos('<event-uuid>');              -- tagged / dead
--
-- Gate reset (run day-of, separate — the gate lives in rhea_gate.sql):
--   update public.rhea_gate
--      set opens_at = '2026-09-12 07:00:00-04', is_open = false
--    where id = 'default';
--   update public.optic_config set active_event_id = '<this comp''s events.id>' where id = 'default';
-- ============================================================================
