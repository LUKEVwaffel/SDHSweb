-- Apply after BALL_CHECKIN, BALL_DOOR_RULES, BALL_DOOR_STATUS_PARITY and BALL_DOOR_AUTO_PIN.
begin;

create table if not exists public.ball_offline_stations (
 id uuid primary key default gen_random_uuid(),
 actor text not null,
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '24 hours')
);
create table if not exists public.ball_offline_reviewers (
 id uuid primary key default gen_random_uuid(),
 station_id uuid not null references public.ball_offline_stations(id),
 approver_key text not null references public.ball_door_approvers(key),
 pin_fingerprint text not null,
 public_key jsonb not null
);
-- Receipts are committed with the existing audit writes. They make retries
-- safe after lost responses and retain both occurrence and server receipt time.
create table if not exists public.ball_offline_receipts (
 id uuid primary key,
 station_id uuid not null references public.ball_offline_stations(id),
 actor text not null,
 person_kind text not null,
 person_id uuid not null,
 action text not null,
 occurred_at timestamptz not null,
 synced_at timestamptz not null default clock_timestamp(),
 arrival_revision uuid,
 operation jsonb not null
);
alter table public.ball_offline_stations enable row level security;
alter table public.ball_offline_reviewers enable row level security;
alter table public.ball_offline_receipts enable row level security;
revoke all on public.ball_offline_stations,public.ball_offline_reviewers,public.ball_offline_receipts from public,anon,authenticated;
grant select,insert on public.ball_offline_reviewers to service_role;
grant select on public.ball_offline_stations,public.ball_offline_receipts to service_role;
grant select on public.ball_offline_receipts to authenticated;
drop policy if exists ball_offline_receipts_s6 on public.ball_offline_receipts;
create policy ball_offline_receipts_s6 on public.ball_offline_receipts for select to authenticated using(public.is_s6());

create or replace function public.ball_prepare_offline_station() returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor_email text:=lower(auth.jwt()->>'email'); station public.ball_offline_stations; roster jsonb;
begin
 if actor_email is null or not public.can_ball_checkin() or not public.ball_door_actor_allowed(actor_email) then
   raise exception 'Check-in access required';
 end if;
 roster:=public.ball_checkin_roster();
 insert into public.ball_offline_stations(actor) values(actor_email) returning * into station;
 return roster||jsonb_build_object('station_id',station.id,'actor',station.actor,'issued_at',station.issued_at,'expires_at',station.expires_at);
end $$;
revoke all on function public.ball_prepare_offline_station() from public,anon;
grant execute on function public.ball_prepare_offline_station() to authenticated;

create or replace function public.ball_write_arrival(p_actor text,p_kind text,p_person uuid,p_present boolean,p_revision uuid,p_next uuid,p_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare person record; arrival public.ball_arrivals;
begin
 if p_present is null then raise exception 'Choose check in or undo'; end if;
 if p_actor is null then raise exception 'Sign in again'; end if;
 -- Serializes first arrival, undo and concurrent stations for this individual.
 perform pg_advisory_xact_lock(hashtextextended('ball-2026:'||p_kind||':'||p_person::text,0));
 select * into person from public.ball_door_people() where person_kind=p_kind and person_id=p_person;
 if not found then raise exception 'Attendee no longer exists. Refresh the roster'; end if;
 select * into arrival from public.ball_arrivals where event_key='2026' and person_kind=p_kind and person_id=p_person for update;
 if arrival.revision is distinct from p_revision then raise exception 'Attendance changed at another station. Refresh before trying again'; end if;
 if p_present and cardinality(person.issues)>0 then raise exception 'Please send this attendee to Chief: %',array_to_string(person.issues,', '); end if;
 if p_present and arrival.checked_in_at is not null then raise exception 'Already checked in. Refresh the roster'; end if;
 if not p_present and arrival.checked_in_at is null then raise exception 'This attendee is not checked in'; end if;
 insert into public.ball_arrivals(event_key,person_kind,person_id,checked_in_at,checked_in_by,revision)
 values('2026',p_kind,p_person,case when p_present then coalesce(p_at,clock_timestamp()) else null end,case when p_present then p_actor else null end,p_next)
 on conflict(event_key,person_kind,person_id) do update set
 checked_in_at=excluded.checked_in_at,checked_in_by=excluded.checked_in_by,revision=excluded.revision
 returning * into arrival;
 insert into public.ball_arrival_log(event_key,person_kind,person_id,action,actor)
 values('2026',p_kind,p_person,case when p_present then 'check_in' else 'undo' end,p_actor);
 return jsonb_build_object('person_kind',p_kind,'person_id',p_person,'checked_in_at',arrival.checked_in_at,'revision',arrival.revision);
end $$;
revoke all on function public.ball_write_arrival(text,text,uuid,boolean,uuid,uuid,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.ball_set_arrival(p_kind text,p_person uuid,p_present boolean,p_revision uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.can_ball_checkin() then raise exception 'Check-in access required'; end if;
 return public.ball_write_arrival(lower(auth.jwt()->>'email'),p_kind,p_person,p_present,p_revision,gen_random_uuid(),null);
end $$;

-- Only the edge function may submit a reviewer ID after verifying the
-- signature against that enrollment's public key.
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
   select s.pin_hash into current_pin_hash from public.ball_door_approvers a
   join public.ball_dress_staff s on s.email=a.email
   where a.key=reviewer.approver_key and s.active
     and encode(sha256(convert_to(s.pin_hash,'UTF8')),'hex')=reviewer.pin_fingerprint;
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
