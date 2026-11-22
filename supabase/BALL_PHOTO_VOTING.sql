begin;

create table if not exists public.ball_photo_votes (
  voter_tag text primary key,
  photo_id uuid not null references public.ball_photo_items(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index if not exists ball_photo_votes_photo on public.ball_photo_votes(photo_id);
alter table public.ball_photo_votes enable row level security;
revoke all on public.ball_photo_votes from public,anon,authenticated;
grant all on public.ball_photo_votes to service_role;

create or replace function public.ball_photo_cast_vote(p_voter_tag text,p_photo_id uuid)
returns boolean language plpgsql set search_path=public as $$
begin
  perform 1 from public.ball_photo_items where id=p_photo_id and status='published' for share;
  if not found then return false; end if;
  insert into public.ball_photo_votes(voter_tag,photo_id) values(p_voter_tag,p_photo_id)
    on conflict(voter_tag) do update set photo_id=excluded.photo_id,updated_at=now();
  return true;
end $$;

create or replace function public.ball_photo_vote_results()
returns table(photo_id uuid,votes bigint) language sql stable set search_path=public as $$
  select v.photo_id,count(*) as votes
  from public.ball_photo_votes v join public.ball_photo_items p on p.id=v.photo_id
  where p.status='published'
  group by v.photo_id order by votes desc,v.photo_id limit 50;
$$;

revoke all on function public.ball_photo_cast_vote(text,uuid),public.ball_photo_vote_results() from public,anon,authenticated;
grant execute on function public.ball_photo_cast_vote(text,uuid),public.ball_photo_vote_results() to service_role;

commit;
