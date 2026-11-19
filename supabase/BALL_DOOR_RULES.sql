-- After BALL_CHECKIN.sql. Entry decisions and on-site signed-form receipt.
begin;
create table if not exists public.ball_door_approvers (
 key text primary key check(key in ('aubry','kylie')),
 email text not null unique references public.ball_dress_staff(email)
);
insert into public.ball_door_approvers(key,email)
 select 'aubry',email from public.ball_dress_staff where email='agillott1414@gmail.com'
 on conflict(key) do nothing;
insert into public.ball_door_approvers(key,email)
 select 'kylie',email from public.ball_dress_staff where email='kylierocks404@gmail.com'
 on conflict(key) do nothing;
create table if not exists public.ball_door_attire (
 person_kind text not null,person_id uuid not null,
 approved boolean not null,approver_key text not null references public.ball_door_approvers(key),
 decided_at timestamptz not null default now(),primary key(person_kind,person_id)
);
create table if not exists public.ball_door_students (
 person_kind text not null,person_id uuid not null,sdhs_student boolean not null,
 primary key(person_kind,person_id)
);
create table if not exists public.ball_door_forms (
 person_kind text not null,person_id uuid not null,
 parent_name text not null,received_by text not null,received_at timestamptz not null default now(),
 primary key(person_kind,person_id)
);
create table if not exists public.ball_door_decision_log (
 id uuid primary key default gen_random_uuid(),person_kind text not null,person_id uuid not null,
 action text not null check(action in ('attire_approved','attire_denied','parent_form_received','student_status_confirmed')),
 actor text not null,approver_key text,parent_name text,created_at timestamptz not null default now()
);
alter table public.ball_door_approvers enable row level security;
alter table public.ball_door_attire enable row level security;
alter table public.ball_door_students enable row level security;
alter table public.ball_door_forms enable row level security;
alter table public.ball_door_decision_log enable row level security;
revoke all on public.ball_door_approvers,public.ball_door_attire,public.ball_door_forms,public.ball_door_students,public.ball_door_decision_log from public,anon,authenticated;
grant all on public.ball_door_approvers,public.ball_door_attire,public.ball_door_forms,public.ball_door_students,public.ball_door_decision_log to service_role;

create or replace function public.ball_door_actor_allowed(p_actor text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.ball_checkin_staff where email=lower(p_actor) and active)
 or exists(select 1 from public.admin_roles where email=lower(p_actor) and role='s6' and not must_change_password)
$$;
revoke all on function public.ball_door_actor_allowed(text) from public,anon,authenticated;
grant execute on function public.ball_door_actor_allowed(text) to service_role;

-- Return shape gains explicit per-person admission facts.
drop function public.ball_door_people();
create function public.ball_door_people()
returns table(person_kind text,person_id uuid,name text,company text,companion text,group_key text,
 issues text[],form_required boolean,form_received boolean,payment_complete boolean,
 attire_status text,verification_complete boolean,attire_by text,student_status_unknown boolean)
language sql stable security definer set search_path=public as $$
 with base as (
 select 'cadet'::text kind,s.id,s.cadet_name name,s.cadet_company company,g.name companion,'reservation:'||s.id group_key,
 (not s.standalone_guest or s.field_trip_form_required is distinct from false) needs_form,
 s.field_trip_form_received got_form,
 (s.amount_due is not null and s.amount_due>=0 and coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)>=s.amount_due) paid,
 s.dress_approved attire,
 coalesce(s.cadet_gender='male' and s.standalone_guest is distinct from true,false) uniform,
 (s.status='fully_verified') verified,false school_unknown
 from public.ball_signups s left join public.ball_guests g on g.signup_id=s.id
 union all
 select 'guest',g.id,g.name,s.cadet_company,s.cadet_name,'reservation:'||s.id,
 (g.is_sdhs_jrotc is true or g.field_trip_form_required is distinct from false or coalesce(g.school_attended ~* '(soddy[[:space:]-]*daisy|\msdhs\M)',false)),
 g.field_trip_form_received,
 case when g.guest_type='friend' then (g.friend_amount_due is not null and g.friend_amount_due>=0 and (g.friend_amount_due=0 or g.friend_cash_received or (g.friend_payment_method='host_delivers' and s.cash_received)))
 else (s.amount_due is not null and s.amount_due>=0 and coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)>=s.amount_due) end,
 g.dress_approved,false,(g.verified_at is not null),
 (g.is_sdhs_jrotc is false and g.field_trip_form_required is false and nullif(trim(g.school_attended),'') is null)
 from public.ball_guests g join public.ball_signups s on s.id=g.signup_id
 union all
 -- Invited VIP tickets are complimentary; SDHS attendees still need forms.
 select 'vip',v.id,v.name,'VIP',d.name,'vip:'||v.id,
 vs.sdhs_student is true,false,true,v.dress_approved,false,true,vs.sdhs_student is null
 from public.ball_vip_signups v left join public.ball_vip_dates d on d.vip_signup_id=v.id
 left join public.ball_door_students vs on vs.person_kind='vip' and vs.person_id=v.id
 union all
 select 'vip_date',d.id,d.name,'VIP guest',v.name,'vip:'||v.id,
 ds.sdhs_student is true,false,true,d.dress_approved,false,true,ds.sdhs_student is null
 from public.ball_vip_dates d join public.ball_vip_signups v on v.id=d.vip_signup_id
 left join public.ball_door_students ds on ds.person_kind='vip_date' and ds.person_id=d.id
 ), facts as (
 select b.*, (coalesce(b.got_form,false) or f.person_id is not null) form_in,
 case when a.approved=true then 'approved' when a.approved=false then 'denied'
 when b.uniform then 'uniform'
 when b.attire=true then 'approved' when b.attire=false then 'denied'
 else 'pending' end attire_state,
 case a.approver_key when 'aubry' then 'Aubry Gillott' when 'kylie' then 'Kylie Gray' end approved_by
 from base b left join public.ball_door_attire a on a.person_kind=b.kind and a.person_id=b.id
 left join public.ball_door_forms f on f.person_kind=b.kind and f.person_id=b.id
 )
 select kind,id,name,company,companion,group_key,array_remove(array[
 case when school_unknown then 'Confirm whether this person currently attends SDHS before entry.' end,
 case when not coalesce(verified,false) then 'Registration verification incomplete' end,
 case when needs_form and not form_in then 'Signed permission form missing. Parent must attend and sign before entry.' end,
 case when not coalesce(paid,false) then 'Unpaid ticket. Do not admit. Cash is not accepted at the door.' end,
 case when attire_state='denied' then 'Attire denied. Do not admit.' when attire_state='pending' then 'Attire approval needed' end
 ],null)::text[],needs_form,form_in,coalesce(paid,false),attire_state,coalesce(verified,false),approved_by,school_unknown
 from facts
$$;
revoke all on function public.ball_door_people() from public,anon,authenticated;

create or replace function public.ball_checkin_roster() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb; approvers jsonb;
begin
 if not public.can_ball_checkin() then raise exception 'Check-in access required'; end if;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('checked_in_at',a.checked_in_at,'revision',a.revision) order by p.name,p.person_kind,p.person_id),'[]'::jsonb)
 into result from public.ball_door_people() p left join public.ball_arrivals a
 on a.event_key='2026' and a.person_kind=p.person_kind and a.person_id=p.person_id;
 select coalesce(jsonb_agg(jsonb_build_object('key',a.key,'name',s.name,'ready',s.active and s.pin_hash is not null) order by a.key),'[]'::jsonb)
 into approvers from public.ball_door_approvers a join public.ball_dress_staff s on s.email=a.email;
 return jsonb_build_object('people',result,'approvers',approvers,'server_time',now(),'is_admin',public.is_s6());
end $$;

create or replace function public.ball_decide_door_attire(p_actor text,p_kind text,p_person uuid,p_approver text,p_hash text,p_approved boolean,p_expected text,p_sandbox boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare staff public.ball_dress_staff; person record;
begin
 if auth.role() is distinct from 'service_role' or not public.ball_door_actor_allowed(p_actor) then raise exception 'Check-in access required'; end if;
 if p_approved is null or p_sandbox is null then raise exception 'Decision and mode required'; end if;
 select s.* into staff from public.ball_door_approvers a join public.ball_dress_staff s on s.email=a.email where a.key=p_approver for share of s;
 if not found or not staff.active or staff.pin_hash is null or staff.pin_hash is distinct from p_hash then raise exception 'Authorized approver required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ball-2026:'||p_kind||':'||p_person::text,0));
 select * into person from public.ball_door_people() where person_kind=p_kind and person_id=p_person;
 if not found then raise exception 'Attendee no longer exists'; end if;
 if not p_sandbox and person.attire_status is distinct from p_expected then raise exception 'Attire status changed. Refresh and review again'; end if;
 if not p_sandbox and exists(select 1 from public.ball_arrivals where event_key='2026' and person_kind=p_kind and person_id=p_person and checked_in_at is not null) then raise exception 'Undo check-in before recording a new attire decision'; end if;
 if not p_sandbox then
 insert into public.ball_door_attire(person_kind,person_id,approved,approver_key) values(p_kind,p_person,p_approved,p_approver)
 on conflict(person_kind,person_id) do update set approved=excluded.approved,approver_key=excluded.approver_key,decided_at=now();
 insert into public.ball_door_decision_log(person_kind,person_id,action,actor,approver_key)
 values(p_kind,p_person,case when p_approved then 'attire_approved' else 'attire_denied' end,lower(p_actor),p_approver);
 end if;
 return jsonb_build_object('attire_status',case when p_approved then 'approved' else 'denied' end,'attire_by',staff.name,'sandbox',p_sandbox);
end $$;
revoke all on function public.ball_decide_door_attire(text,text,uuid,text,text,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.ball_decide_door_attire(text,text,uuid,text,text,boolean,text,boolean) to service_role;

create or replace function public.ball_receive_door_form(p_actor text,p_kind text,p_person uuid,p_parent text,p_signed boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare person record;
begin
 if auth.role() is distinct from 'service_role' or not public.ball_door_actor_allowed(p_actor) then raise exception 'Check-in access required'; end if;
 if p_signed is distinct from true or length(trim(coalesce(p_parent,'')))<2 or length(p_parent)>120 then raise exception 'Parent must be present and sign the paper form. Record their name'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ball-2026:'||p_kind||':'||p_person::text,0));
 select * into person from public.ball_door_people() where person_kind=p_kind and person_id=p_person;
 if not found or not person.form_required then raise exception 'Attendee or required form not found'; end if;
 if person.form_received then raise exception 'Form already recorded. Refresh the roster'; end if;
 insert into public.ball_door_forms(person_kind,person_id,parent_name,received_by) values(p_kind,p_person,trim(p_parent),lower(p_actor));
 if p_kind='cadet' then update public.ball_signups set field_trip_form_received=true where id=p_person;
 elsif p_kind='guest' then update public.ball_guests set field_trip_form_received=true where id=p_person;
 end if;
 insert into public.ball_door_decision_log(person_kind,person_id,action,actor,parent_name) values(p_kind,p_person,'parent_form_received',lower(p_actor),trim(p_parent));
 return jsonb_build_object('form_received',true);
end $$;
revoke all on function public.ball_receive_door_form(text,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.ball_receive_door_form(text,text,uuid,text,boolean) to service_role;
create or replace function public.ball_confirm_door_student(p_actor text,p_kind text,p_person uuid,p_sdhs boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare person record;
begin
 if auth.role() is distinct from 'service_role' or not public.ball_door_actor_allowed(p_actor) then raise exception 'Check-in access required'; end if;
 if p_sdhs is null then raise exception 'Confirm current SDHS enrollment'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ball-2026:'||p_kind||':'||p_person::text,0));
 select * into person from public.ball_door_people() where person_kind=p_kind and person_id=p_person;
 if not found or not person.student_status_unknown then raise exception 'School status already recorded. Refresh'; end if;
 if p_kind in ('vip','vip_date') then insert into public.ball_door_students(person_kind,person_id,sdhs_student) values(p_kind,p_person,p_sdhs);
 elsif p_kind='guest' then update public.ball_guests set field_trip_form_required=p_sdhs,school_attended=case when p_sdhs then 'Soddy Daisy High School' else 'Not currently an SDHS student (confirmed at door)' end where id=p_person;
 else raise exception 'School status cannot be changed for this attendee'; end if;
 insert into public.ball_door_decision_log(person_kind,person_id,action,actor) values(p_kind,p_person,'student_status_confirmed',lower(p_actor));
 return jsonb_build_object('student_status_unknown',false,'form_required',p_sdhs);
end $$;
revoke all on function public.ball_confirm_door_student(text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ball_confirm_door_student(text,text,uuid,boolean) to service_role;
commit;
