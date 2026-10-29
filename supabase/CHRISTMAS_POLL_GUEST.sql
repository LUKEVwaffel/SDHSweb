begin;
create table if not exists public.christmas_poll_guest_access (
 id boolean primary key default true check(id),
 passcode_hash text,
 pin_hash text,
 fail_count integer not null default 0,
 locked_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.christmas_poll_guest_access add column if not exists pin_hash text;
insert into public.christmas_poll_guest_access(id) values(true) on conflict do nothing;
alter table public.christmas_poll_guest_access enable row level security;
revoke all on public.christmas_poll_guest_access from public,anon,authenticated;
grant all on public.christmas_poll_guest_access to service_role;
create or replace function public.reserve_christmas_guest_attempt() returns boolean
language plpgsql security definer set search_path=public as $$
declare current public.christmas_poll_guest_access;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only'; end if;
 select * into current from public.christmas_poll_guest_access where id=true for update;
 if current.locked_until>now() then return false; end if;
 if current.locked_until is not null then current.fail_count:=0; end if;
 update public.christmas_poll_guest_access set fail_count=current.fail_count+1,
 locked_until=case when current.fail_count+1>=10 then now()+interval '15 minutes' else null end where id=true;
 return true;
end $$;
revoke all on function public.reserve_christmas_guest_attempt() from public,anon,authenticated;
grant execute on function public.reserve_christmas_guest_attempt() to service_role;
create or replace function public.christmas_poll_guest_totals() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare totals jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only'; end if;
 select jsonb_build_object('total',count(*),'november_1',count(*) filter(where choice='november_1'),
 'after_thanksgiving',count(*) filter(where choice='after_thanksgiving'),'seeded_votes',count(*) filter(where source='seed'),'as_of',now()) into totals from public.christmas_music_poll_votes;
 return totals;
end $$;
revoke all on function public.christmas_poll_guest_totals() from public,anon,authenticated;
grant execute on function public.christmas_poll_guest_totals() to service_role;
commit;
