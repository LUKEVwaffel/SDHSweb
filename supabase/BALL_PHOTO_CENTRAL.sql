begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ball-photo-central','ball-photo-central',false,104857600,array['image/jpeg','application/octet-stream'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists ball_photo_private_objects on storage.objects;
create policy ball_photo_private_objects on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'ball-photo-central')
  with check (bucket_id <> 'ball-photo-central');

create table if not exists public.ball_photo_invites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  phone_tag text not null,
  active boolean not null default true,
  failures integer not null default 0,
  lock_until timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.ball_photo_sessions (
  token_tag text primary key,
  invite_id uuid not null references public.ball_photo_invites(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.ball_photo_items (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  credit text not null,
  digest text not null,
  filename text not null,
  extension text not null,
  original_bytes bigint not null check (original_bytes between 1 and 104857600),
  captured_at timestamptz,
  photo_bytes bigint check (photo_bytes between 1 and 6000000),
  width integer,
  height integer,
  status text not null default 'uploading' check (status in ('uploading','review','published')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  published_at timestamptz,
  published_by text,
  unique (owner_key, digest)
);
create index if not exists ball_photo_gallery_order
  on public.ball_photo_items(captured_at asc nulls last, id) where status='published';
create index if not exists ball_photo_inbox_order on public.ball_photo_items(status, created_at desc, id);

alter table public.ball_photo_invites enable row level security;
alter table public.ball_photo_sessions enable row level security;
alter table public.ball_photo_items enable row level security;
revoke all on public.ball_photo_invites, public.ball_photo_sessions, public.ball_photo_items from public, anon, authenticated;
grant all on public.ball_photo_invites, public.ball_photo_sessions, public.ball_photo_items to service_role;

create or replace function public.ball_photo_unlock(p_invite uuid, p_phone_tag text, p_session_tag text)
returns text
language plpgsql security definer set search_path=public as $$
declare invite public.ball_photo_invites; checked_at timestamptz:=clock_timestamp();
begin
  select * into invite from public.ball_photo_invites where id=p_invite for update;
  if not found or not invite.active or invite.lock_until>checked_at then return null; end if;
  if p_phone_tag is distinct from invite.phone_tag then
    update public.ball_photo_invites
      set failures=case when invite.failures>=4 then 0 else invite.failures+1 end,
          lock_until=case when invite.failures>=4 then checked_at+interval '15 minutes' else null end
      where id=p_invite;
    return null;
  end if;
  update public.ball_photo_invites set failures=0,lock_until=null where id=p_invite;
  delete from public.ball_photo_sessions where expires_at<=checked_at;
  insert into public.ball_photo_sessions(token_tag,invite_id,expires_at)
    values(p_session_tag,p_invite,checked_at+interval '2 days');
  return invite.name;
end $$;
revoke all on function public.ball_photo_unlock(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ball_photo_unlock(uuid,text,text) to service_role;

create or replace function public.ball_photo_route_legacy_upload()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.event_id='e879b7f6-1789-4f72-ab92-21573da9c42a'::uuid then
    if tg_op='UPDATE' and new.event_id is not distinct from old.event_id then return new; end if;
    raise exception 'Military Ball photos are uploaded at /ballphotos/upload.';
  end if;
  return new;
end $$;
drop trigger if exists ball_photo_route_legacy_upload on public.photos;
create trigger ball_photo_route_legacy_upload before insert or update of event_id on public.photos
  for each row execute function public.ball_photo_route_legacy_upload();

commit;
