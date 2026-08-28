-- ============================================================================
-- RHEA COUNTY RAIDER COMP — photo system (one-night beta).
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: photo_hub_v2.sql (photos table + triggers + RLS),
--             photos_event_required.sql (photos_require_posted_event_trg),
--             admin_roles.sql (is_admin()), events_calendar.sql (events).
--
-- SCOPE: three new surfaces — /lukeupload (SD-card dump), /rhea (public parent
-- upload + live feed), /lukepwa (admin curation PWA). All photos for these
-- surfaces are the SINGLE real event "Rhea County Raider Competition"
-- (events.id = e8a305fe-86cf-4092-a580-5865423271b9, team = 'raiders').
--
-- KEY CONSTRAINT: photos_require_posted_event_trg rejects any photos insert
-- whose team does not match the event's team. The Rhea event is team='raiders',
-- so EVERY row these surfaces write keeps photos.team = 'raiders'. The Raider
-- sub-team (Male / Coed) lives in the NEW photos.raider_team column, never in
-- photos.team.
-- ============================================================================


-- ── SECTION 1 — sub-events (lightweight, event-scoped) ─────────────────────
-- Created on the fly by Luke in /lukepwa. Generic (event_id FK) so a future
-- comp reuses the same table.
create table if not exists public.raider_sub_events (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,
  team        text not null default 'both' check (team in ('male','coed','both')),
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists raider_sub_events_event_idx on public.raider_sub_events(event_id);

alter table public.raider_sub_events enable row level security;

drop policy if exists raider_sub_events_read  on public.raider_sub_events;
drop policy if exists raider_sub_events_write on public.raider_sub_events;
-- Public read: the /rhea feed (anon) resolves sub-event names for the tag chip.
-- Non-sensitive (free-text labels like "Rope Bridge").
create policy raider_sub_events_read on public.raider_sub_events
  for select using (true);
-- Write: DISPATCH admins only (the same authenticated pool also holds email
-- reviewers, hence is_admin() not a bare `authenticated` check).
create policy raider_sub_events_write on public.raider_sub_events
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ── SECTION 2 — photos: new columns ───────────────────────────────────────
-- source       : which surface wrote the row. 'public' = pre-existing/other
--                PhotoUploader paths (default keeps 5 historical rows honest).
-- visibility   : 'staged' = Luke's unpublished dump, hidden everywhere public
--                until he publishes. Defaults to 'public' so every historical
--                row and every parent upload is live immediately.
-- upload_status: /lukeupload per-file progress marker. Rows are only inserted
--                on storage success, so in practice this is 'done'; kept for
--                the realtime progress contract and future use.
-- raider_team  : Raider sub-team. NULL until Luke tags it (or never).
-- sub_event_id : which sub-event a Luke photo belongs to. NULL = untagged.
alter table public.photos
  add column if not exists source        text not null default 'public'
    check (source in ('public','parent','luke')),
  add column if not exists visibility    text not null default 'public'
    check (visibility in ('public','staged')),
  add column if not exists upload_status text not null default 'done'
    check (upload_status in ('uploading','done','failed')),
  add column if not exists raider_team   text
    check (raider_team in ('male','coed','both')),
  add column if not exists sub_event_id  uuid
    references public.raider_sub_events(id) on delete set null;

create index if not exists photos_event_visibility_idx
  on public.photos(event_id, visibility, created_at desc);
create index if not exists photos_sub_event_idx on public.photos(sub_event_id);


-- ── SECTION 3 — photos: curation UPDATE policy ────────────────────────────
-- photo_hub_v2.sql deliberately gave photos NO update policy (vote tallies
-- mutate only through SECURITY DEFINER RPCs). /lukepwa needs to flip
-- visibility / status and write tags. This adds a column-SCOPED update grant
-- so votes_funny/aura/team stay untouchable from the anon+authenticated keys.
drop policy if exists photos_update_curate on public.photos;
create policy photos_update_curate on public.photos
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke update on public.photos from authenticated;
grant  update (visibility, status, raider_team, sub_event_id, upload_status, uploader_name)
  on public.photos to authenticated;


-- ── SECTION 4 — raise per-device upload rate limit 40 -> 150 / hour ───────
-- Same body as photo_hub_v2.sql SECTION 4, higher ceiling. A parent dumping a
-- day's worth of stand photos from one phone legitimately blows past 40/hr;
-- 150 still stops a runaway script. Luke's /lukeupload path sets uploader_fp
-- = NULL, so it is never rate-limited regardless.
create or replace function public.photos_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.uploader_fp is not null then
    select count(*) into recent from public.photos
     where uploader_fp = new.uploader_fp and created_at > now() - interval '1 hour';
    if recent >= 150 then
      raise exception 'upload rate limit reached (150/hour per device)';
    end if;
  end if;
  return new;
end $$;


-- ── SECTION 5 — realtime publication ─────────────────────────────────────
-- Required or postgres_changes streams nothing for these tables. dispatch_chat
-- .sql was the first feature to touch this publication; same mechanics here.
-- After running, confirm both show enabled under Database -> Replication.
do $$ begin
  alter publication supabase_realtime add table public.photos;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.raider_sub_events;
exception when duplicate_object then null; end $$;


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select column_name from information_schema.columns
--     where table_name = 'photos'
--       and column_name in ('source','visibility','upload_status','raider_team','sub_event_id');
--     -- expect 5 rows
--   select * from pg_publication_tables where pubname = 'supabase_realtime'
--     and tablename in ('photos','raider_sub_events');   -- expect 2 rows
--   -- staged insert should be invisible to the anon feed query:
--   --   select id from public.photos
--   --     where event_id = 'e8a305fe-86cf-4092-a580-5865423271b9'
--   --       and visibility = 'public' and status = 'live';
-- ============================================================================
