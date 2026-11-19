-- Dedicated door roster and attendance. No changes to registration/payment tables.
begin;
create table if not exists public.ball_checkin_staff (
 email text primary key check(email=lower(trim(email))),
 display_name text not null check(length(trim(display_name))>0),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.ball_checkin_staff enable row level security;
revoke all on public.ball_checkin_staff from anon,authenticated;
grant select,insert,update,delete on public.ball_checkin_staff to authenticated;
drop policy if exists ball_checkin_staff_s6 on public.ball_checkin_staff;
create policy ball_checkin_staff_s6 on public.ball_checkin_staff for all to authenticated
 using(public.is_s6()) with check(public.is_s6());

create or replace function public.can_ball_checkin() returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_s6() or exists(select 1 from public.ball_checkin_staff
 where email=lower(auth.jwt()->>'email') and active)
$$;
revoke all on function public.can_ball_checkin() from public,anon;
grant execute on function public.can_ball_checkin() to authenticated;

create table if not exists public.ball_arrivals (
 event_key text not null default '2026',
 person_kind text not null check(person_kind in ('cadet','guest','vip','vip_date')),
 person_id uuid not null,
 checked_in_at timestamptz,
 checked_in_by text,
 revision uuid not null default gen_random_uuid(),
 primary key(event_key,person_kind,person_id)
);
create table if not exists public.ball_arrival_log (
 id uuid primary key default gen_random_uuid(),
 event_key text not null, person_kind text not null, person_id uuid not null,
 action text not null check(action in ('check_in','undo')),
 actor text not null, created_at timestamptz not null default now()
);
alter table public.ball_arrivals enable row level security;
alter table public.ball_arrival_log enable row level security;
revoke all on public.ball_arrivals,public.ball_arrival_log from anon,authenticated;
grant select on public.ball_arrival_log to authenticated;
drop policy if exists ball_arrival_log_s6 on public.ball_arrival_log;
create policy ball_arrival_log_s6 on public.ball_arrival_log for select to authenticated using(public.is_s6());

-- Internal projection deliberately excludes email, phone, medical details and tokens.
create or replace function public.ball_door_people()
returns table(person_kind text,person_id uuid,name text,company text,companion text,group_key text,issues text[])
language sql stable security definer set search_path=public as $$
 select 'cadet'::text,s.id,s.cadet_name,s.cadet_company,g.name,'reservation:'||s.id,
 array_remove(array[
 case when s.status is distinct from 'fully_verified' then 'Reservation verification incomplete' end,
 case when s.field_trip_form_required is distinct from false and s.field_trip_form_received is distinct from true then 'Permission form missing' end,
 case when s.amount_due is null or s.amount_due<0 then 'Ticket price needs review'
 when coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)<s.amount_due then 'Payment outstanding' end,
 case when s.dress_approved is distinct from true and not coalesce((s.cadet_gender='male' and s.standalone_guest is distinct from true),false) then 'Attire approval needed' end
 ],null)::text[]
 from public.ball_signups s left join public.ball_guests g on g.signup_id=s.id
 union all
 select 'guest',g.id,g.name,s.cadet_company,s.cadet_name,'reservation:'||s.id,
 array_remove(array[
 case when g.verified_at is null then 'Guest verification incomplete' end,
 case when g.field_trip_form_required is distinct from false and g.field_trip_form_received is distinct from true then 'Permission form missing' end,
 case when g.dress_approved is distinct from true then 'Attire approval needed' end,
 case when g.guest_type='friend' then
   case when g.friend_amount_due is null or g.friend_amount_due<0 then 'Guest ticket price needs review'
   when g.friend_amount_due>0 and not (g.friend_cash_received or (g.friend_payment_method='host_delivers' and s.cash_received)) then 'Guest payment outstanding' end
 else case when s.amount_due is null or s.amount_due<0 then 'Ticket price needs review'
 when coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)<s.amount_due then 'Couple payment outstanding' end end
 ],null)::text[]
 from public.ball_guests g join public.ball_signups s on s.id=g.signup_id
 union all
 select 'vip',v.id,v.name,'VIP',d.name,'vip:'||v.id,
 array_remove(array[case when v.dress_approved is distinct from true then 'Attire approval needed' end],null)::text[]
 from public.ball_vip_signups v left join public.ball_vip_dates d on d.vip_signup_id=v.id
 union all
 select 'vip_date',d.id,d.name,'VIP guest',v.name,'vip:'||v.id,
 array_remove(array[case when d.dress_approved is distinct from true then 'Attire approval needed' end],null)::text[]
 from public.ball_vip_dates d join public.ball_vip_signups v on v.id=d.vip_signup_id
$$;
revoke all on function public.ball_door_people() from public,anon,authenticated;

create or replace function public.ball_checkin_roster() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.can_ball_checkin() then raise exception 'Check-in access required'; end if;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('checked_in_at',a.checked_in_at,'revision',a.revision) order by p.name,p.person_kind,p.person_id),'[]'::jsonb)
 into result from public.ball_door_people() p left join public.ball_arrivals a
 on a.event_key='2026' and a.person_kind=p.person_kind and a.person_id=p.person_id;
 return jsonb_build_object('people',result,'server_time',now(),'is_admin',public.is_s6());
end $$;
revoke all on function public.ball_checkin_roster() from public,anon;
grant execute on function public.ball_checkin_roster() to authenticated;

create or replace function public.ball_set_arrival(p_kind text,p_person uuid,p_present boolean,p_revision uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare person record; arrival public.ball_arrivals; actor text;
begin
 if not public.can_ball_checkin() then raise exception 'Check-in access required'; end if;
 if p_present is null then raise exception 'Choose check in or undo'; end if;
 actor:=lower(auth.jwt()->>'email');
 if actor is null then raise exception 'Sign in again'; end if;
 -- Serializes first arrival, undo and concurrent stations for this individual.
 perform pg_advisory_xact_lock(hashtextextended('ball-2026:'||p_kind||':'||p_person::text,0));
 select * into person from public.ball_door_people() where person_kind=p_kind and person_id=p_person;
 if not found then raise exception 'Attendee no longer exists. Refresh the roster'; end if;
 select * into arrival from public.ball_arrivals where event_key='2026' and person_kind=p_kind and person_id=p_person for update;
 if arrival.revision is distinct from p_revision then raise exception 'Attendance changed at another station. Refresh before trying again'; end if;
 if p_present and cardinality(person.issues)>0 then raise exception 'Please send this attendee to Chief: %',array_to_string(person.issues,', '); end if;
 if p_present and arrival.checked_in_at is not null then raise exception 'Already checked in. Refresh the roster'; end if;
 if not p_present and arrival.checked_in_at is null then raise exception 'This attendee is not checked in'; end if;
 insert into public.ball_arrivals(event_key,person_kind,person_id,checked_in_at,checked_in_by)
 values('2026',p_kind,p_person,case when p_present then clock_timestamp() else null end,case when p_present then actor else null end)
 on conflict(event_key,person_kind,person_id) do update set
 checked_in_at=excluded.checked_in_at,checked_in_by=excluded.checked_in_by,revision=gen_random_uuid()
 returning * into arrival;
 insert into public.ball_arrival_log(event_key,person_kind,person_id,action,actor)
 values('2026',p_kind,p_person,case when p_present then 'check_in' else 'undo' end,actor);
 return jsonb_build_object('person_kind',p_kind,'person_id',p_person,'checked_in_at',arrival.checked_in_at,'revision',arrival.revision);
end $$;
revoke all on function public.ball_set_arrival(text,uuid,boolean,uuid) from public,anon;
grant execute on function public.ball_set_arrival(text,uuid,boolean,uuid) to authenticated;
commit;
