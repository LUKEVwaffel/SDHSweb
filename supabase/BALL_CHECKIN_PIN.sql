-- Apply after BALL_CHECKIN_OFFLINE.sql.
begin;

create table if not exists public.ball_checkin_pin_credentials (
 staff_email text primary key references public.ball_checkin_staff(email) on delete cascade,
 auth_email text not null unique check(auth_email ~ '^checkin-[0-9a-f-]{36}@ball-checkin[.]invalid$'),
 pin_tag text not null unique check(pin_tag ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null
);
create table if not exists public.ball_checkin_login_attempts (
 scope text primary key,
 window_start timestamptz not null,
 attempts integer not null
);
alter table public.ball_checkin_pin_credentials enable row level security;
alter table public.ball_checkin_login_attempts enable row level security;
revoke all on public.ball_checkin_pin_credentials,public.ball_checkin_login_attempts from public,anon,authenticated;
grant select on public.ball_checkin_pin_credentials to service_role;

create or replace function public.ball_resolve_checkin_actor(p_auth_email text) returns text
language sql stable security definer set search_path=public as $$
 select case when lower(p_auth_email) like '%@ball-checkin.invalid' then
  (select c.staff_email from public.ball_checkin_pin_credentials c
   join public.ball_checkin_staff s on s.email=c.staff_email
   where c.auth_email=lower(p_auth_email) and c.expires_at>now() and s.active)
 else lower(p_auth_email) end
$$;
revoke all on function public.ball_resolve_checkin_actor(text) from public,anon,authenticated;
grant execute on function public.ball_resolve_checkin_actor(text) to service_role;

create or replace function public.can_ball_checkin() returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(public.is_s6(),false) or exists(
  select 1 from public.ball_checkin_staff where email=public.ball_resolve_checkin_actor(auth.jwt()->>'email') and active)
$$;

create or replace function public.ball_set_arrival(p_kind text,p_person uuid,p_present boolean,p_revision uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.can_ball_checkin() then raise exception 'Check-in access required'; end if;
 return public.ball_write_arrival(public.ball_resolve_checkin_actor(auth.jwt()->>'email'),p_kind,p_person,p_present,p_revision,gen_random_uuid(),null);
end $$;

create or replace function public.ball_prepare_offline_station() returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor_email text:=public.ball_resolve_checkin_actor(auth.jwt()->>'email'); station public.ball_offline_stations; roster jsonb;
begin
 if actor_email is null or not public.can_ball_checkin() or not public.ball_door_actor_allowed(actor_email) then
  raise exception 'Check-in access required';
 end if;
 roster:=public.ball_checkin_roster();
 insert into public.ball_offline_stations(actor) values(actor_email) returning * into station;
 return roster||jsonb_build_object('station_id',station.id,'actor',station.actor,'issued_at',station.issued_at,'expires_at',station.expires_at);
end $$;

create or replace function public.ball_issue_checkin_pin(p_staff text,p_name text,p_auth_email text,p_tag text) returns timestamptz
language plpgsql security definer set search_path=public as $$
declare deadline timestamptz:=clock_timestamp()+interval '72 hours';
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
 insert into public.ball_checkin_staff(email,display_name,active) values(lower(trim(p_staff)),trim(p_name),true)
 on conflict(email) do update set display_name=excluded.display_name,active=true;
 insert into public.ball_checkin_pin_credentials(staff_email,auth_email,pin_tag,expires_at)
 values(lower(trim(p_staff)),p_auth_email,p_tag,deadline)
 on conflict(staff_email) do update set pin_tag=excluded.pin_tag,expires_at=excluded.expires_at
 where ball_checkin_pin_credentials.auth_email=excluded.auth_email;
 if not found then raise exception 'PIN setup changed. Retry'; end if;
 return deadline;
end $$;
revoke all on function public.ball_issue_checkin_pin(text,text,text,text) from public,anon,authenticated;
grant execute on function public.ball_issue_checkin_pin(text,text,text,text) to service_role;

-- Rate limit before matching. A per-network limit also preserves the shared
-- budget when one station has several failed attempts.
create or replace function public.ball_lookup_checkin_pin(p_tag text,p_network text,p_expected_actor text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 now_at timestamptz:=clock_timestamp();
 network public.ball_checkin_login_attempts;
 budget public.ball_checkin_login_attempts;
 match public.ball_checkin_pin_credentials;
begin
 if auth.role() is distinct from 'service_role' or p_network is null or p_network !~ '^[0-9a-f]{64}$' then
  raise exception 'Service role and valid network key required';
 end if;

 insert into public.ball_checkin_login_attempts values (p_network,now_at,0) on conflict do nothing;
 select * into network from public.ball_checkin_login_attempts where scope=p_network for update;
 if now_at>=network.window_start+interval '15 minutes' then
  network.window_start:=now_at;
  network.attempts:=0;
 end if;
 if network.attempts>=5 then return jsonb_build_object('limited',true); end if;

 insert into public.ball_checkin_login_attempts values ('global',now_at,0) on conflict do nothing;
 select * into budget from public.ball_checkin_login_attempts where scope='global' for update;
 if now_at>=budget.window_start+interval '1 hour' then
  budget.window_start:=now_at;
  budget.attempts:=0;
 end if;
 if budget.attempts>=30 then return jsonb_build_object('limited',true); end if;

 select c.* into match from public.ball_checkin_pin_credentials c
 join public.ball_checkin_staff s on s.email=c.staff_email
 where c.pin_tag=p_tag and c.expires_at>now_at and s.active
   and (p_expected_actor is null or c.staff_email=lower(p_expected_actor));
 if found then return jsonb_build_object('auth_email',match.auth_email); end if;

 update public.ball_checkin_login_attempts set window_start=network.window_start,attempts=network.attempts+1 where scope=p_network;
 update public.ball_checkin_login_attempts set window_start=budget.window_start,attempts=budget.attempts+1 where scope='global';
 return '{}'::jsonb;
end $$;
revoke all on function public.ball_lookup_checkin_pin(text,text,text) from public,anon,authenticated;
grant execute on function public.ball_lookup_checkin_pin(text,text,text) to service_role;

commit;
