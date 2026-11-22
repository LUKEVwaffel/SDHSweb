-- Apply after the existing door rules, parity, offline, and desk PIN migrations.
begin;

alter table public.ball_door_approvers
 add column if not exists door_pin_hash text;
alter table public.ball_door_approvers
 drop constraint if exists ball_door_approvers_key_check;
alter table public.ball_door_approvers
 add constraint ball_door_approvers_key_check check(key in ('aubry','kylie','luke','danielle'));

-- Dedicated reviewer codes are door-only. Never make them an Auth or
-- dress-portal credential. The original reviewers keep their current codes.
create or replace function public.ball_door_reviewer_credentials()
returns table(key text,email text,name text,active boolean,pin_hash text,pin_locked_until timestamptz)
language sql stable security definer set search_path=public as $$
 select a.key,a.email,
  case a.key when 'luke' then 'Luke Vetsch' when 'danielle' then 'Danielle' else s.name end,
  case when a.key='danielle' then coalesce(r.role in ('s5','s6'),false) else coalesce(s.active,false) end,
  case when a.key in ('luke','danielle') then a.door_pin_hash else s.pin_hash end,
  case when a.key in ('luke','danielle') then null else s.pin_locked_until end
 from public.ball_door_approvers a
 left join public.ball_dress_staff s on s.email=a.email
 left join public.admin_roles r on a.key='danielle' and r.email=a.email
$$;
revoke all on function public.ball_door_reviewer_credentials() from public,anon,authenticated;
grant execute on function public.ball_door_reviewer_credentials() to service_role;

create or replace function public.ball_door_people()
returns table(person_kind text,person_id uuid,name text,company text,companion text,group_key text,
 issues text[],form_required boolean,form_received boolean,payment_complete boolean,
 attire_status text,verification_complete boolean,attire_by text,student_status_unknown boolean)
language sql stable security definer set search_path=public as $$
 with base as (
 select 'cadet'::text kind,s.id,s.cadet_name name,s.cadet_company company,g.name companion,'reservation:'||s.id group_key,
 (s.standalone_guest is distinct from true or s.field_trip_form_required is distinct from false) needs_form,
 s.field_trip_form_received got_form,
 (s.amount_due is not null and s.amount_due>=0 and s.amount_due::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,0)::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)>=s.amount_due) paid,
 s.dress_approved attire,
 coalesce(s.cadet_gender='male' and s.standalone_guest is distinct from true,false) uniform,
 (s.status='fully_verified') verified,false school_unknown
 from public.ball_signups s left join public.ball_guests g on g.signup_id=s.id
 union all
 select 'guest',g.id,g.name,s.cadet_company,s.cadet_name,'reservation:'||s.id,
 (g.is_sdhs_jrotc is true or g.sdhs_matched_cadet_id is not null or g.field_trip_form_required is distinct from false or coalesce(g.school_attended ~* '(soddy[[:space:]-]*daisy|\msdhs\M)',false)),
 g.field_trip_form_received,
 case when g.guest_type='friend' then (g.friend_amount_due is not null and g.friend_amount_due>=0 and g.friend_amount_due::text not in ('NaN','Infinity','-Infinity') and (g.friend_amount_due=0 or coalesce(g.friend_cash_received,false) or (coalesce(g.friend_payment_method='host_delivers',false) and coalesce(s.cash_received,false))))
 else (s.amount_due is not null and s.amount_due>=0 and s.amount_due::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,0)::text not in ('NaN','Infinity','-Infinity') and coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end)>=s.amount_due) end,
 g.dress_approved,false,(g.verified_at is not null),
 (g.is_sdhs_jrotc is distinct from true and g.sdhs_matched_cadet_id is null and g.field_trip_form_required is false and nullif(trim(g.school_attended),'') is null)
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
 case a.approver_key when 'aubry' then 'Aubry Gillott' when 'kylie' then 'Kylie Gray' when 'luke' then 'Luke Vetsch' when 'danielle' then 'Danielle' end approved_by
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
 select coalesce(jsonb_agg(jsonb_build_object('key',c.key,'name',c.name,'ready',c.active and c.pin_hash is not null) order by c.key),'[]'::jsonb)
 into approvers from public.ball_door_reviewer_credentials() c;
 return jsonb_build_object('people',result,'approvers',approvers,'server_time',now(),'is_admin',public.is_s6());
end $$;

create or replace function public.ball_decide_door_attire(p_actor text,p_kind text,p_person uuid,p_approver text,p_hash text,p_approved boolean,p_expected text,p_sandbox boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare staff record; person record;
begin
 if auth.role() is distinct from 'service_role' or not public.ball_door_actor_allowed(p_actor) then raise exception 'Check-in access required'; end if;
 if p_approved is null or p_sandbox is null then raise exception 'Decision and mode required'; end if;
 perform 1 from public.ball_door_approvers where key=p_approver for share;
 if p_approver='danielle' then
   perform 1 from public.ball_door_approvers a join public.admin_roles r on r.email=a.email where a.key=p_approver for share of r;
 else
   perform 1 from public.ball_door_approvers a join public.ball_dress_staff s on s.email=a.email where a.key=p_approver for share of s;
 end if;
 select * into staff from public.ball_door_reviewer_credentials() where key=p_approver;
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

create or replace function public.ball_apply_offline_operation(p_actor text,p_station uuid,p_operation jsonb,p_verified_reviewer uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare
 station public.ball_offline_stations;
 receipt public.ball_offline_receipts;
 reviewer public.ball_offline_reviewers;
 current_pin_hash text;
 expected_revision uuid;
 prior_revision uuid;
 next_revision uuid;
 op_id uuid:=(p_operation->>'id')::uuid;
 kind text:=p_operation->>'kind';
 person_id uuid:=(p_operation->>'person_id')::uuid;
 action text:=p_operation->>'action';
 happened timestamptz:=(p_operation->>'occurred_at')::timestamptz;
 payload jsonb:=p_operation->'payload';
begin
 if auth.role() is distinct from 'service_role' or not public.ball_door_actor_allowed(p_actor) then raise exception 'Check-in access required'; end if;
 select * into station from public.ball_offline_stations where id=p_station and actor=lower(p_actor);
 if not found then raise exception 'This offline station belongs to another account'; end if;
 if op_id is null or person_id is null or kind is null or kind not in ('cadet','guest','vip','vip_date')
   or happened is null or not isfinite(happened) or happened<station.issued_at or happened>station.expires_at
   or happened>clock_timestamp()+interval '1 minute' then raise exception 'Invalid offline action or station time'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ball-offline:'||op_id::text,0));
 select * into receipt from public.ball_offline_receipts where id=op_id;
 if found then
   if receipt.station_id=p_station and receipt.operation=p_operation then return; end if;
   raise exception 'Offline action ID already used';
 end if;

 case action
 when 'arrival' then
   expected_revision:=(payload->>'revision')::uuid;
   -- The device refers to its preceding local arrival operation by ID.
   -- Keep actual attendance revisions server-generated, as in live mode.
   select r.arrival_revision into prior_revision from public.ball_offline_receipts r
   where r.id=expected_revision and r.station_id=p_station and r.person_kind=kind
     and r.person_id=(p_operation->>'person_id')::uuid and r.action='arrival';
   next_revision:=gen_random_uuid();
   perform public.ball_write_arrival(station.actor,kind,person_id,(payload->>'present')::boolean,
     coalesce(prior_revision,expected_revision),next_revision,happened);
 when 'school' then
   perform public.ball_confirm_door_student(station.actor,kind,person_id,(payload->>'sdhs')::boolean);
 when 'form' then
   perform public.ball_receive_door_form(station.actor,kind,person_id,payload->>'parent',(payload->>'signed')::boolean);
 when 'attire' then
   select * into reviewer from public.ball_offline_reviewers where id=p_verified_reviewer and station_id=p_station;
   if not found or reviewer.id::text is distinct from payload->>'reviewer_id' then raise exception 'Offline reviewer proof required'; end if;
   select c.pin_hash into current_pin_hash from public.ball_door_reviewer_credentials() c
   where c.key=reviewer.approver_key and c.active
     and encode(sha256(convert_to(c.pin_hash,'UTF8')),'hex')=reviewer.pin_fingerprint;
   if not found then raise exception 'Offline reviewer access changed. Ask the organizer to review this action'; end if;
   perform public.ball_decide_door_attire(station.actor,kind,person_id,reviewer.approver_key,current_pin_hash,(payload->>'approved')::boolean,payload->>'expected',false);
 else raise exception 'Unknown offline action';
 end case;
 insert into public.ball_offline_receipts(id,station_id,actor,person_kind,person_id,action,occurred_at,arrival_revision,operation)
 values(op_id,p_station,station.actor,kind,person_id,action,happened,next_revision,p_operation);
end $$;
revoke all on function public.ball_apply_offline_operation(text,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ball_apply_offline_operation(text,uuid,jsonb,uuid) to service_role;

commit;
