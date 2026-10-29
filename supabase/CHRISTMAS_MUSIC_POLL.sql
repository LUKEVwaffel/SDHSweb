-- Named votes, one stable device key per poll. Only aggregate/admin RPCs read them.
begin;
create table if not exists public.christmas_music_poll_votes (
 id uuid primary key default gen_random_uuid(),
 choice text not null check(choice in ('november_1','after_thanksgiving')),
 voter_name text not null check(length(trim(voter_name)) between 1 and 100),
 source text not null default 'public' check(source in ('public','seed')),
 device_fp text not null unique check(length(device_fp) between 8 and 256),
 created_at timestamptz not null default now()
);
alter table public.christmas_music_poll_votes add column if not exists source text not null default 'public' check(source in ('public','seed'));
alter table public.christmas_music_poll_votes add column if not exists voter_name text;
update public.christmas_music_poll_votes set voter_name='Name not collected (earlier vote)' where voter_name is null;
alter table public.christmas_music_poll_votes alter column voter_name set not null;
alter table public.christmas_music_poll_votes drop constraint if exists christmas_music_poll_votes_voter_name_check;
alter table public.christmas_music_poll_votes add constraint christmas_music_poll_votes_voter_name_check check(length(trim(voter_name)) between 1 and 100);
alter table public.christmas_music_poll_votes enable row level security;
revoke all on public.christmas_music_poll_votes from public,anon,authenticated;
grant all on public.christmas_music_poll_votes to service_role;
drop policy if exists christmas_music_vote on public.christmas_music_poll_votes;
create or replace function public.christmas_music_poll_results() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if public.is_admin() is distinct from true then raise exception 'DISPATCH admin access required'; end if;
 select jsonb_build_object('total',count(*),'november_1',count(*) filter(where choice='november_1'),
 'after_thanksgiving',count(*) filter(where choice='after_thanksgiving'),
 'seeded_votes',count(*) filter(where source='seed'),'as_of',now()) into result from public.christmas_music_poll_votes;
 return result;
end $$;
create or replace function public.christmas_music_poll_responses() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if public.is_admin() is distinct from true then raise exception 'DISPATCH admin access required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',voter_name,'choice',choice,'source',source,'created_at',created_at) order by created_at desc,id),'[]'::jsonb)
 into result from public.christmas_music_poll_votes;
 return result;
end $$;
revoke all on function public.christmas_music_poll_results() from public,anon;
revoke all on function public.christmas_music_poll_responses() from public,anon;
grant execute on function public.christmas_music_poll_results() to authenticated;
grant execute on function public.christmas_music_poll_responses() to authenticated;
insert into public.christmas_music_poll_votes(choice,voter_name,device_fp,source) values
 ('november_1','Seeded Sunday vote 1','seed_christmas_music_2026_sunday_1','seed'),
 ('november_1','Seeded Sunday vote 2','seed_christmas_music_2026_sunday_2','seed'),
 ('after_thanksgiving','Seeded Thanksgiving vote 1','seed_christmas_music_2026_thanksgiving_1','seed')
 on conflict(device_fp) do update set voter_name=excluded.voter_name where christmas_music_poll_votes.source='seed';
commit;
