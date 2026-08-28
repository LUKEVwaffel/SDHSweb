-- ============================================================================
-- RHEA COUNTY RAIDER COMP , photo likes (one-night beta).
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent,
-- additive. Depends on: rhea_comp_photos.sql (photos surface + realtime).
--
-- /rhea has no login, so "one like per device" is keyed on the same
-- FingerprintJS + localStorage-nonce string the upload path already uses
-- (src/lib/fingerprint.js). This is not spoof-proof , it is the same trust
-- level as the anon parent-upload path, which is the agreed bar for this event.
--
-- The live like number rides on a denormalised photos.like_count column kept
-- in sync by a SECURITY DEFINER trigger, so the existing /rhea feed query and
-- its realtime subscription pick up like changes with no extra round-trips.
-- ============================================================================


-- ── SECTION 1 , likes table ──────────────────────────────────────────────
create table if not exists public.rhea_photo_likes (
  photo_id   uuid not null references public.photos(id) on delete cascade,
  device_fp  text not null,
  created_at timestamptz not null default now(),
  primary key (photo_id, device_fp)
);
create index if not exists rhea_photo_likes_photo_idx on public.rhea_photo_likes(photo_id);
create index if not exists rhea_photo_likes_device_idx on public.rhea_photo_likes(device_fp);

alter table public.rhea_photo_likes enable row level security;

drop policy if exists rhea_photo_likes_read   on public.rhea_photo_likes;
drop policy if exists rhea_photo_likes_insert on public.rhea_photo_likes;
drop policy if exists rhea_photo_likes_delete on public.rhea_photo_likes;

-- Counts are public.
create policy rhea_photo_likes_read on public.rhea_photo_likes
  for select using (true);

-- Anyone (anon key) may like, but only photos that belong to the one Rhea
-- event , no writing likes against arbitrary photo ids.
create policy rhea_photo_likes_insert on public.rhea_photo_likes
  for insert with check (
    photo_id in (
      select id from public.photos
      where event_id = 'e8a305fe-86cf-4092-a580-5865423271b9'
    )
  );

-- Unlike. RLS cannot see the caller's device_fp (no auth), so this trusts the
-- anon key the same way the rest of /rhea does; the client always scopes its
-- delete to (photo_id, device_fp).
create policy rhea_photo_likes_delete on public.rhea_photo_likes
  for delete using (true);


-- ── SECTION 2 , denormalised count on photos ─────────────────────────────
alter table public.photos
  add column if not exists like_count int not null default 0;

create or replace function public.rhea_like_count_sync()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.photos set like_count = like_count + 1 where id = new.photo_id;
  elsif tg_op = 'DELETE' then
    update public.photos set like_count = greatest(like_count - 1, 0) where id = old.photo_id;
  end if;
  return null;
end $$;

drop trigger if exists rhea_like_count_sync_trg on public.rhea_photo_likes;
create trigger rhea_like_count_sync_trg
  after insert or delete on public.rhea_photo_likes
  for each row execute function public.rhea_like_count_sync();

-- Backfill any rows that already exist (safe to re-run).
update public.photos p
   set like_count = coalesce((
     select count(*) from public.rhea_photo_likes l where l.photo_id = p.id
   ), 0)
 where p.event_id = 'e8a305fe-86cf-4092-a580-5865423271b9';


-- ── SECTION 3 , realtime publication ─────────────────────────────────────
-- photos is already published (rhea_comp_photos.sql); the trigger's UPDATE to
-- like_count therefore streams to every open /rhea client for free. Add the
-- likes table too so a future per-row view is possible without another migration.
do $$ begin
  alter publication supabase_realtime add table public.rhea_photo_likes;
exception when duplicate_object then null; end $$;


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select column_name from information_schema.columns
--     where table_name = 'photos' and column_name = 'like_count';        -- 1 row
--   insert into public.rhea_photo_likes (photo_id, device_fp)
--     values ((select id from public.photos
--               where event_id = 'e8a305fe-86cf-4092-a580-5865423271b9' limit 1),
--             'verify_dev');
--   select id, like_count from public.photos
--     where event_id = 'e8a305fe-86cf-4092-a580-5865423271b9' order by like_count desc limit 3;
--   delete from public.rhea_photo_likes where device_fp = 'verify_dev';
-- ============================================================================
