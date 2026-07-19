-- ============================================================================
-- RAIDER PHOTO HUB — data layer
-- Run this in the Supabase SQL editor (project bjgyvmdzcymruunzavni).
-- Idempotent: safe to re-run.
--
-- Model:
--   raider_polls   : one voting poll per competition event
--   raider_photos  : public-uploaded competition photos (per event) + denormalized tallies
--   raider_votes   : one vote per category per device (fingerprint) — RPC-only writes
--   raider_gallery : curated "last year" showcase (admin, no voting)
--   raider_bulletin: frozen winners feed rendered on the Raiders page
--
-- Integrity:
--   * Vote counts (votes_funny/aura/team) are ONLY mutated by SECURITY DEFINER
--     RPCs. anon has no direct UPDATE on raider_photos and no DML on raider_votes.
--   * Poll open/close + gallery writes go through the anon key to stay consistent
--     with the existing client-passcode admin (flagged: real fix = Supabase Auth).
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_cron;     -- scheduled auto-close

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.raider_polls (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null unique references public.events(id) on delete cascade,
  status        text not null default 'draft' check (status in ('draft','open','closed')),
  opened_at     timestamptz,
  closes_at     timestamptz,
  closed_at     timestamptz,
  winner_funny  uuid,
  winner_aura   uuid,
  winner_team   uuid,
  created_at    timestamptz not null default now()
);

create table if not exists public.raider_photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
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
create index if not exists raider_photos_event_idx on public.raider_photos(event_id);
create index if not exists raider_photos_fp_time_idx on public.raider_photos(uploader_fp, created_at);

-- winner FKs (added after raider_photos exists)
do $$ begin
  alter table public.raider_polls
    add constraint raider_polls_winner_funny_fk foreign key (winner_funny) references public.raider_photos(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.raider_polls
    add constraint raider_polls_winner_aura_fk foreign key (winner_aura) references public.raider_photos(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.raider_polls
    add constraint raider_polls_winner_team_fk foreign key (winner_team) references public.raider_photos(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.raider_votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.raider_polls(id) on delete cascade,
  photo_id    uuid not null references public.raider_photos(id) on delete cascade,
  category    text not null check (category in ('funny','aura','team')),
  device_fp   text not null,
  created_at  timestamptz not null default now(),
  unique (poll_id, category, device_fp)   -- one vote per category per device
);
create index if not exists raider_votes_photo_idx on public.raider_votes(photo_id);

create table if not exists public.raider_gallery (
  id           uuid primary key default gen_random_uuid(),
  photo_url    text not null,
  storage_path text,
  caption      text,
  year         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.raider_bulletin (
  id                   uuid primary key default gen_random_uuid(),
  poll_id              uuid references public.raider_polls(id) on delete cascade,
  event_id             uuid references public.events(id) on delete set null,
  event_title          text,
  published_at         timestamptz not null default now(),
  winner_funny_url     text, winner_funny_caption text, winner_funny_votes int,
  winner_aura_url      text, winner_aura_caption  text, winner_aura_votes  int,
  winner_team_url      text, winner_team_caption  text, winner_team_votes  int
);

-- ── Per-device upload rate limit (defense vs. spam) ─────────────────────────
create or replace function public.raider_photos_rate_limit()
returns trigger language plpgsql as $$
declare recent int;
begin
  if new.uploader_fp is not null then
    select count(*) into recent
      from public.raider_photos
     where uploader_fp = new.uploader_fp
       and created_at > now() - interval '1 hour';
    if recent >= 40 then
      raise exception 'upload rate limit reached (40/hour per device)';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists raider_photos_rate_limit_trg on public.raider_photos;
create trigger raider_photos_rate_limit_trg
  before insert on public.raider_photos
  for each row execute function public.raider_photos_rate_limit();

-- ── RPC: cast a vote (one per category per device, switchable) ───────────────
create or replace function public.cast_raider_vote(
  p_poll uuid, p_photo uuid, p_category text, p_fp text
) returns public.raider_photos
language plpgsql security definer set search_path = public as $$
declare
  v_poll   public.raider_polls;
  v_old    uuid;
  v_result public.raider_photos;
begin
  if p_category not in ('funny','aura','team') then
    raise exception 'invalid category %', p_category;
  end if;

  select * into v_poll from public.raider_polls where id = p_poll;
  if v_poll is null then raise exception 'poll not found'; end if;
  if v_poll.status <> 'open' then raise exception 'poll is not open'; end if;
  if v_poll.closes_at is not null and now() >= v_poll.closes_at then
    raise exception 'poll has closed';
  end if;

  -- existing vote for this (poll, category, device)?
  select photo_id into v_old
    from public.raider_votes
   where poll_id = p_poll and category = p_category and device_fp = p_fp;

  if v_old = p_photo then
    -- same choice — no change
    select * into v_result from public.raider_photos where id = p_photo;
    return v_result;
  end if;

  if v_old is not null then
    -- switch: decrement previous photo's tally
    update public.raider_photos
       set votes_funny = votes_funny - (p_category='funny')::int,
           votes_aura  = votes_aura  - (p_category='aura')::int,
           votes_team  = votes_team  - (p_category='team')::int
     where id = v_old;
    update public.raider_votes
       set photo_id = p_photo, created_at = now()
     where poll_id = p_poll and category = p_category and device_fp = p_fp;
  else
    insert into public.raider_votes (poll_id, photo_id, category, device_fp)
      values (p_poll, p_photo, p_category, p_fp);
  end if;

  -- increment chosen photo's tally
  update public.raider_photos
     set votes_funny = votes_funny + (p_category='funny')::int,
         votes_aura  = votes_aura  + (p_category='aura')::int,
         votes_team  = votes_team  + (p_category='team')::int
   where id = p_photo
   returning * into v_result;

  return v_result;
end $$;

-- ── RPC: open a poll (admin) ────────────────────────────────────────────────
create or replace function public.open_raider_poll(
  p_event uuid, p_closes timestamptz default null
) returns public.raider_polls
language plpgsql security definer set search_path = public as $$
declare
  v_event_date date;
  v_closes timestamptz;
  v_poll public.raider_polls;
begin
  select date into v_event_date from public.events where id = p_event;
  -- default: 24h after the event date, but always at least 1h from now
  v_closes := coalesce(
    p_closes,
    greatest((v_event_date::timestamptz + interval '24 hours'), now() + interval '1 hour')
  );

  insert into public.raider_polls (event_id, status, opened_at, closes_at)
    values (p_event, 'open', now(), v_closes)
  on conflict (event_id) do update
    set status = 'open', opened_at = now(), closes_at = v_closes,
        closed_at = null, winner_funny = null, winner_aura = null, winner_team = null
  returning * into v_poll;

  return v_poll;
end $$;

-- ── RPC: close one poll now + freeze winners + publish bulletin ─────────────
create or replace function public.finalize_raider_poll(p_poll uuid)
returns public.raider_polls
language plpgsql security definer set search_path = public as $$
declare
  v_poll  public.raider_polls;
  w_funny public.raider_photos;
  w_aura  public.raider_photos;
  w_team  public.raider_photos;
  v_title text;
begin
  select * into v_poll from public.raider_polls where id = p_poll;
  if v_poll is null then raise exception 'poll not found'; end if;

  select * into w_funny from public.raider_photos
    where event_id = v_poll.event_id and status='live' and votes_funny > 0
    order by votes_funny desc, created_at asc limit 1;
  select * into w_aura from public.raider_photos
    where event_id = v_poll.event_id and status='live' and votes_aura > 0
    order by votes_aura desc, created_at asc limit 1;
  select * into w_team from public.raider_photos
    where event_id = v_poll.event_id and status='live' and votes_team > 0
    order by votes_team desc, created_at asc limit 1;

  update public.raider_polls
     set status='closed', closed_at=now(),
         winner_funny = w_funny.id, winner_aura = w_aura.id, winner_team = w_team.id
   where id = p_poll
   returning * into v_poll;

  select title into v_title from public.events where id = v_poll.event_id;

  -- publish (one bulletin row per poll)
  delete from public.raider_bulletin where poll_id = p_poll;
  insert into public.raider_bulletin (
    poll_id, event_id, event_title, published_at,
    winner_funny_url, winner_funny_caption, winner_funny_votes,
    winner_aura_url,  winner_aura_caption,  winner_aura_votes,
    winner_team_url,  winner_team_caption,  winner_team_votes
  ) values (
    p_poll, v_poll.event_id, v_title, now(),
    w_funny.photo_url, w_funny.uploader_name, w_funny.votes_funny,
    w_aura.photo_url,  w_aura.uploader_name,  w_aura.votes_aura,
    w_team.photo_url,  w_team.uploader_name,  w_team.votes_team
  );

  return v_poll;
end $$;

-- ── Sweep: close every poll past its deadline (called by cron) ──────────────
create or replace function public.close_due_raider_polls()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.raider_polls
     where status = 'open' and closes_at is not null and now() >= closes_at
  loop
    perform public.finalize_raider_poll(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── RPC: admin reset a photo's tallies (clears its votes) ───────────────────
create or replace function public.reset_raider_photo_votes(p_photo uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.raider_votes where photo_id = p_photo;
  update public.raider_photos
     set votes_funny=0, votes_aura=0, votes_team=0
   where id = p_photo;
end $$;

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.raider_polls    enable row level security;
alter table public.raider_photos   enable row level security;
alter table public.raider_votes    enable row level security;
alter table public.raider_gallery  enable row level security;
alter table public.raider_bulletin enable row level security;

-- polls: public read; anon may open/close via the admin UI (client-passcode parity)
drop policy if exists raider_polls_read  on public.raider_polls;
drop policy if exists raider_polls_write on public.raider_polls;
create policy raider_polls_read  on public.raider_polls for select using (true);
create policy raider_polls_write on public.raider_polls for all    using (true) with check (true);

-- photos: public read + public upload (insert) + admin delete. NO direct update
-- (tallies are mutated only by SECURITY DEFINER RPCs, which bypass RLS).
drop policy if exists raider_photos_read   on public.raider_photos;
drop policy if exists raider_photos_insert on public.raider_photos;
drop policy if exists raider_photos_delete on public.raider_photos;
create policy raider_photos_read   on public.raider_photos for select using (true);
create policy raider_photos_insert on public.raider_photos for insert with check (true);
create policy raider_photos_delete on public.raider_photos for delete using (true);

-- votes: public read (for transparency); NO direct writes — RPC only.
drop policy if exists raider_votes_read on public.raider_votes;
create policy raider_votes_read on public.raider_votes for select using (true);
-- (no insert/update/delete policy => anon cannot write directly)

-- gallery + bulletin: public read; anon manage (admin parity)
drop policy if exists raider_gallery_read  on public.raider_gallery;
drop policy if exists raider_gallery_write on public.raider_gallery;
create policy raider_gallery_read  on public.raider_gallery for select using (true);
create policy raider_gallery_write on public.raider_gallery for all    using (true) with check (true);

drop policy if exists raider_bulletin_read  on public.raider_bulletin;
drop policy if exists raider_bulletin_write on public.raider_bulletin;
create policy raider_bulletin_read  on public.raider_bulletin for select using (true);
create policy raider_bulletin_write on public.raider_bulletin for all    using (true) with check (true);

-- ── Grants (anon/authenticated need EXECUTE on the RPCs) ─────────────────────
grant execute on function public.cast_raider_vote(uuid,uuid,text,text) to anon, authenticated;
grant execute on function public.open_raider_poll(uuid,timestamptz)     to anon, authenticated;
grant execute on function public.finalize_raider_poll(uuid)             to anon, authenticated;
grant execute on function public.reset_raider_photo_votes(uuid)         to anon, authenticated;
-- close_due_raider_polls is called by cron (postgres); no anon grant needed.

-- ── Storage bucket for public uploads ───────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('raider-photos', 'raider-photos', true)
  on conflict (id) do nothing;

-- storage policies: public read + public upload + delete on the raider-photos bucket
drop policy if exists raider_photos_obj_read   on storage.objects;
drop policy if exists raider_photos_obj_insert on storage.objects;
drop policy if exists raider_photos_obj_delete on storage.objects;
create policy raider_photos_obj_read on storage.objects
  for select using (bucket_id = 'raider-photos');
create policy raider_photos_obj_insert on storage.objects
  for insert with check (bucket_id = 'raider-photos');
create policy raider_photos_obj_delete on storage.objects
  for delete using (bucket_id = 'raider-photos');

-- ── Cron: sweep due polls every 10 minutes ──────────────────────────────────
-- (client also locks voting on load; cron is the authoritative close.)
do $$ begin
  perform cron.unschedule('close-raider-polls');
exception when others then null; end $$;
select cron.schedule('close-raider-polls', '*/10 * * * *', $$select public.close_due_raider_polls()$$);

-- ============================================================================
-- Done. Verify: select * from cron.job where jobname='close-raider-polls';
-- ============================================================================
