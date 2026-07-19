-- ============================================================================
-- PHOTO HUB v2 — generalize raider-only photos into an all-teams model.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni).
--
-- SAFE DROP-AND-RECREATE: verified all raider_* tables are empty (0 rows) before
-- writing this. events / event_photos are NOT touched.
--
-- v1 -> v2 map:
--   raider_photos   -> photos          (+ team, event_id now NULLABLE)
--   raider_polls    -> polls           (+ team)
--   raider_votes    -> votes           (unchanged shape, FK -> photos)
--   raider_gallery  -> gallery         (+ team, per-team "last year")
--   raider_bulletin -> photo_bulletin  (+ team)
--   RPCs cast_raider_vote/open_raider_poll/... -> cast_vote/open_poll/...
--   bucket raider-photos -> team-photos
--
-- Voting stays Raiders-only for now; which teams can vote is a CLIENT constant
-- (src/lib/teams.js). Any team can hold plain gallery photos.
-- ============================================================================

-- ── 1. Tear down v1 ─────────────────────────────────────────────────────────
do $$ begin perform cron.unschedule('close-raider-polls'); exception when others then null; end $$;

drop function if exists public.cast_raider_vote(uuid,uuid,text,text)   cascade;
drop function if exists public.open_raider_poll(uuid,timestamptz)      cascade;
drop function if exists public.finalize_raider_poll(uuid)              cascade;
drop function if exists public.close_due_raider_polls()                cascade;
drop function if exists public.reset_raider_photo_votes(uuid)          cascade;
drop function if exists public.raider_photos_rate_limit()              cascade;

drop table if exists public.raider_votes    cascade;
drop table if exists public.raider_bulletin cascade;
drop table if exists public.raider_polls    cascade;
drop table if exists public.raider_photos   cascade;
drop table if exists public.raider_gallery  cascade;

-- old storage policies. NOTE: Supabase blocks direct DELETE on storage tables
-- (storage.protect_delete). The empty 'raider-photos' bucket is left in place —
-- remove it manually via Dashboard > Storage if you want it gone. Harmless if kept.
drop policy if exists raider_photos_obj_read   on storage.objects;
drop policy if exists raider_photos_obj_insert on storage.objects;
drop policy if exists raider_photos_obj_delete on storage.objects;

-- ── 2. Extensions ───────────────────────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ── 3. Tables ───────────────────────────────────────────────────────────────
create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  team          text not null check (team in ('raiders','rifle','academic','drill')),
  event_id      uuid references public.events(id) on delete set null,  -- nullable: only raider event photos attach
  storage_path  text not null,
  photo_url     text not null,
  thumb_url     text,
  uploader_name text,
  uploader_fp   text,
  status        text not null default 'live' check (status in ('live','hidden')),
  votes_funny   int  not null default 0,
  votes_aura    int  not null default 0,
  votes_team    int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists photos_team_time_idx on public.photos(team, created_at desc);
create index if not exists photos_event_idx     on public.photos(event_id);
create index if not exists photos_fp_time_idx    on public.photos(uploader_fp, created_at);

create table if not exists public.polls (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null unique references public.events(id) on delete cascade,
  team          text not null default 'raiders',
  status        text not null default 'draft' check (status in ('draft','open','closed')),
  opened_at     timestamptz,
  closes_at     timestamptz,
  closed_at     timestamptz,
  winner_funny  uuid references public.photos(id) on delete set null,
  winner_aura   uuid references public.photos(id) on delete set null,
  winner_team   uuid references public.photos(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id)  on delete cascade,
  photo_id    uuid not null references public.photos(id) on delete cascade,
  category    text not null check (category in ('funny','aura','team')),
  device_fp   text not null,
  created_at  timestamptz not null default now(),
  unique (poll_id, category, device_fp)   -- one vote per category per device
);
create index if not exists votes_photo_idx on public.votes(photo_id);

create table if not exists public.gallery (
  id           uuid primary key default gen_random_uuid(),
  team         text not null default 'raiders',
  photo_url    text not null,
  storage_path text,
  caption      text,
  year         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists gallery_team_idx on public.gallery(team, sort_order);

create table if not exists public.photo_bulletin (
  id                   uuid primary key default gen_random_uuid(),
  poll_id              uuid references public.polls(id) on delete cascade,
  event_id             uuid references public.events(id) on delete set null,
  team                 text not null default 'raiders',
  event_title          text,
  published_at         timestamptz not null default now(),
  winner_funny_url     text, winner_funny_caption text, winner_funny_votes int,
  winner_aura_url      text, winner_aura_caption  text, winner_aura_votes  int,
  winner_team_url      text, winner_team_caption  text, winner_team_votes  int
);
create index if not exists photo_bulletin_team_idx on public.photo_bulletin(team, published_at desc);

-- ── 4. Per-device upload rate limit ─────────────────────────────────────────
create or replace function public.photos_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.uploader_fp is not null then
    select count(*) into recent from public.photos
     where uploader_fp = new.uploader_fp and created_at > now() - interval '1 hour';
    if recent >= 40 then
      raise exception 'upload rate limit reached (40/hour per device)';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists photos_rate_limit_trg on public.photos;
create trigger photos_rate_limit_trg before insert on public.photos
  for each row execute function public.photos_rate_limit();

-- ── 5. RPC: cast a vote (one per category per device, switchable) ────────────
create or replace function public.cast_vote(
  p_poll uuid, p_photo uuid, p_category text, p_fp text
) returns public.photos
language plpgsql security definer set search_path = public as $$
declare v_poll public.polls; v_old uuid; v_result public.photos;
begin
  if p_category not in ('funny','aura','team') then raise exception 'invalid category %', p_category; end if;
  select * into v_poll from public.polls where id = p_poll;
  if v_poll is null then raise exception 'poll not found'; end if;
  if v_poll.status <> 'open' then raise exception 'poll is not open'; end if;
  if v_poll.closes_at is not null and now() >= v_poll.closes_at then raise exception 'poll has closed'; end if;

  select photo_id into v_old from public.votes
   where poll_id = p_poll and category = p_category and device_fp = p_fp;

  if v_old = p_photo then
    select * into v_result from public.photos where id = p_photo;
    return v_result;
  end if;

  if v_old is not null then
    update public.photos
       set votes_funny = votes_funny - (p_category='funny')::int,
           votes_aura  = votes_aura  - (p_category='aura')::int,
           votes_team  = votes_team  - (p_category='team')::int
     where id = v_old;
    update public.votes set photo_id = p_photo, created_at = now()
     where poll_id = p_poll and category = p_category and device_fp = p_fp;
  else
    insert into public.votes (poll_id, photo_id, category, device_fp)
      values (p_poll, p_photo, p_category, p_fp);
  end if;

  update public.photos
     set votes_funny = votes_funny + (p_category='funny')::int,
         votes_aura  = votes_aura  + (p_category='aura')::int,
         votes_team  = votes_team  + (p_category='team')::int
   where id = p_photo
   returning * into v_result;
  return v_result;
end $$;

-- ── 6. RPC: open a poll (admin) ─────────────────────────────────────────────
create or replace function public.open_poll(
  p_event uuid, p_team text default 'raiders', p_closes timestamptz default null
) returns public.polls
language plpgsql security definer set search_path = public as $$
declare v_event_date date; v_closes timestamptz; v_poll public.polls;
begin
  select date into v_event_date from public.events where id = p_event;
  v_closes := coalesce(p_closes,
    greatest((v_event_date::timestamptz + interval '24 hours'), now() + interval '1 hour'));
  insert into public.polls (event_id, team, status, opened_at, closes_at)
    values (p_event, p_team, 'open', now(), v_closes)
  on conflict (event_id) do update
    set status='open', team=p_team, opened_at=now(), closes_at=v_closes,
        closed_at=null, winner_funny=null, winner_aura=null, winner_team=null
  returning * into v_poll;
  return v_poll;
end $$;

-- ── 7. RPC: finalize one poll (freeze winners + publish bulletin) ────────────
create or replace function public.finalize_poll(p_poll uuid)
returns public.polls
language plpgsql security definer set search_path = public as $$
declare v_poll public.polls; w_funny public.photos; w_aura public.photos; w_team public.photos; v_title text;
begin
  select * into v_poll from public.polls where id = p_poll;
  if v_poll is null then raise exception 'poll not found'; end if;

  select * into w_funny from public.photos
    where event_id=v_poll.event_id and team=v_poll.team and status='live' and votes_funny>0
    order by votes_funny desc, created_at asc limit 1;
  select * into w_aura from public.photos
    where event_id=v_poll.event_id and team=v_poll.team and status='live' and votes_aura>0
    order by votes_aura desc, created_at asc limit 1;
  select * into w_team from public.photos
    where event_id=v_poll.event_id and team=v_poll.team and status='live' and votes_team>0
    order by votes_team desc, created_at asc limit 1;

  update public.polls set status='closed', closed_at=now(),
      winner_funny=w_funny.id, winner_aura=w_aura.id, winner_team=w_team.id
   where id=p_poll returning * into v_poll;

  select title into v_title from public.events where id=v_poll.event_id;

  delete from public.photo_bulletin where poll_id=p_poll;
  insert into public.photo_bulletin (
    poll_id, event_id, team, event_title, published_at,
    winner_funny_url, winner_funny_caption, winner_funny_votes,
    winner_aura_url,  winner_aura_caption,  winner_aura_votes,
    winner_team_url,  winner_team_caption,  winner_team_votes
  ) values (
    p_poll, v_poll.event_id, v_poll.team, v_title, now(),
    w_funny.photo_url, w_funny.uploader_name, w_funny.votes_funny,
    w_aura.photo_url,  w_aura.uploader_name,  w_aura.votes_aura,
    w_team.photo_url,  w_team.uploader_name,  w_team.votes_team
  );
  return v_poll;
end $$;

-- ── 8. Sweep: close every poll past deadline (cron) ─────────────────────────
create or replace function public.close_due_polls()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.polls where status='open' and closes_at is not null and now() >= closes_at loop
    perform public.finalize_poll(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── 9. RPC: admin reset a photo's tallies ───────────────────────────────────
create or replace function public.reset_photo_votes(p_photo uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.votes where photo_id = p_photo;
  update public.photos set votes_funny=0, votes_aura=0, votes_team=0 where id = p_photo;
end $$;

-- ── 10. Row Level Security ──────────────────────────────────────────────────
alter table public.photos         enable row level security;
alter table public.polls          enable row level security;
alter table public.votes          enable row level security;
alter table public.gallery        enable row level security;
alter table public.photo_bulletin enable row level security;

drop policy if exists photos_read   on public.photos;
drop policy if exists photos_insert on public.photos;
drop policy if exists photos_delete on public.photos;
create policy photos_read   on public.photos for select using (true);
create policy photos_insert on public.photos for insert with check (true);
create policy photos_delete on public.photos for delete using (true);
-- NOTE: no UPDATE policy => tallies only mutate via SECURITY DEFINER RPCs.

drop policy if exists polls_read  on public.polls;
drop policy if exists polls_write on public.polls;
create policy polls_read  on public.polls for select using (true);
create policy polls_write on public.polls for all    using (true) with check (true);

drop policy if exists votes_read on public.votes;
create policy votes_read on public.votes for select using (true);
-- no write policy => RPC-only.

drop policy if exists gallery_read  on public.gallery;
drop policy if exists gallery_write on public.gallery;
create policy gallery_read  on public.gallery for select using (true);
create policy gallery_write on public.gallery for all    using (true) with check (true);

drop policy if exists photo_bulletin_read  on public.photo_bulletin;
drop policy if exists photo_bulletin_write on public.photo_bulletin;
create policy photo_bulletin_read  on public.photo_bulletin for select using (true);
create policy photo_bulletin_write on public.photo_bulletin for all    using (true) with check (true);

-- ── 11. Grants ──────────────────────────────────────────────────────────────
grant execute on function public.cast_vote(uuid,uuid,text,text)      to anon, authenticated;
grant execute on function public.open_poll(uuid,text,timestamptz)    to anon, authenticated;
grant execute on function public.finalize_poll(uuid)                 to anon, authenticated;
grant execute on function public.reset_photo_votes(uuid)             to anon, authenticated;

-- ── 12. Storage bucket (all teams) ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('team-photos', 'team-photos', true) on conflict (id) do nothing;

drop policy if exists team_photos_obj_read   on storage.objects;
drop policy if exists team_photos_obj_insert on storage.objects;
drop policy if exists team_photos_obj_delete on storage.objects;
create policy team_photos_obj_read   on storage.objects for select using (bucket_id = 'team-photos');
create policy team_photos_obj_insert on storage.objects for insert with check (bucket_id = 'team-photos');
create policy team_photos_obj_delete on storage.objects for delete using (bucket_id = 'team-photos');

-- ── 13. Cron: sweep due polls every 10 minutes ──────────────────────────────
do $$ begin perform cron.unschedule('close-due-polls'); exception when others then null; end $$;
select cron.schedule('close-due-polls', '*/10 * * * *', $$select public.close_due_polls()$$);

-- ============================================================================
-- Done. Verify: select * from cron.job where jobname='close-due-polls';
-- ============================================================================
