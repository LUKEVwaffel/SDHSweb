-- After current Ball ticket distribution, live status and Chief reservation migrations.
-- This combined script installs tracking, then records the fixed Alpha/Staff historical batch at the end.
begin;
-- Historical handouts are recorded only through an explicit, service-owned
-- exception. This does not grant permission to complete requirements or admit.
create table if not exists public.ball_ticket_historical_receipts (
 signup_id uuid primary key references public.ball_signups(id) on delete cascade,
 host_company text not null check(host_company in ('alpha','staff')),
 guest_id_at_recording uuid,
 batch_id uuid not null,
 note text not null check(length(trim(note))>0),
 previous_delivery jsonb,
 recorded_at timestamptz not null default now()
);
alter table public.ball_ticket_historical_receipts enable row level security;
revoke all on public.ball_ticket_historical_receipts from public,anon,authenticated;
grant all on public.ball_ticket_historical_receipts to service_role;

create or replace function public.ball_ticket_historical_receipt_allowed(p_signup uuid,p_company text,p_guest uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.ball_ticket_historical_receipts proof
  where proof.signup_id=p_signup and proof.host_company=lower(trim(p_company))
   and proof.guest_id_at_recording is not distinct from p_guest
   and proof.recorded_at=transaction_timestamp())
$$;
revoke all on function public.ball_ticket_historical_receipt_allowed(uuid,text,uuid) from public,anon;
grant execute on function public.ball_ticket_historical_receipt_allowed(uuid,text,uuid) to authenticated,service_role;

create or replace function public.ball_ticket_delivery_guard()
returns trigger language plpgsql set search_path=public as $$
declare
  h public.ball_signups%rowtype;
  g public.ball_guests%rowtype;
  g_gender text;
  has_guest boolean;
  expected_type text := 'host';
  expected_id uuid := null;
  paid numeric;
  friend_paid boolean;
  guest_form_required boolean;
  standard_uniform boolean;
  recipient_company_value text;
begin
  if not new.distributed then
    new.distributed_at:=null;
    new.distributed_by:=null;
    return new;
  end if;
  select * into h from public.ball_signups where id=new.signup_id for share;
  if not found then raise exception 'Reservation no longer exists'; end if;
  select * into g from public.ball_guests where signup_id=h.id for share;
  has_guest:=found;
  if has_guest then
    guest_form_required:=g.field_trip_form_required is distinct from false
      or g.is_sdhs_jrotc is true
      or coalesce(g.school_attended ~* '(soddy[[:space:]-]*daisy|\msdhs\M)',false);
  end if;

  -- One authoritative predicate for server label generation and delivery writes.
  if not public.ball_ticket_historical_receipt_allowed(h.id,h.cadet_company,g.id) then
    if cardinality(public.ball_ticket_blockers(public.ball_effective_ticket_row(to_jsonb(h),'cadet'),case when has_guest then public.ball_effective_ticket_row(to_jsonb(g),'guest') else null end))>0 then
      raise exception 'Reservation is incomplete: %',array_to_string(public.ball_ticket_blockers(public.ball_effective_ticket_row(to_jsonb(h),'cadet'),case when has_guest then public.ball_effective_ticket_row(to_jsonb(g),'guest') else null end),', ');
    end if;
  end if;

  -- One reservation has one pickup person: a friend ticket goes to the host;
  -- for a female cadet with a male date, the male date is the pickup person.
  if has_guest and g.guest_type is distinct from 'friend' and lower(h.cadet_gender) in ('female','f') then
    select coalesce(c.gender,nullif(g.gender,'')) into g_gender
      from (select 1) seed
      left join public.cadet_consent c on c.id=g.sdhs_matched_cadet_id;
    if lower(g_gender) in ('male','m') then expected_type:='guest'; expected_id:=g.id; end if;
  end if;
  if new.recipient_type is distinct from expected_type or new.recipient_guest_id is distinct from expected_id then
    raise exception 'Ticket recipient does not match the reservation distribution rule';
  end if;
  if expected_type='guest' then
    new.recipient_name:=g.name;
    select coalesce(c.company,h.cadet_company,'Unassigned') into recipient_company_value
      from (select 1) seed left join public.cadet_consent c on c.id=g.sdhs_matched_cadet_id;
    new.recipient_company:=recipient_company_value;
  else
    new.recipient_name:=h.cadet_name;
    new.recipient_company:=coalesce(h.cadet_company,'Unassigned');
  end if;
  new.distributed_at:=coalesce(new.distributed_at,now());
  new.distributed_by:=coalesce(nullif(trim(new.distributed_by),''),lower(auth.jwt()->>'email'));
  if new.distributed_by is null then raise exception 'Staff identity is required to record ticket delivery'; end if;
  return new;
end $$;

create or replace function public.ball_ops_ticket_record(p_signup uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare h public.ball_signups;g public.ball_guests;c public.cadet_consent;d public.ball_ticket_deliveries;
 recipient_type_value text:='host';recipient_id uuid;recipient_name_value text;company text;ready boolean;payload jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 select * into h from public.ball_signups where id=p_signup;
 if not found then return null;end if;
 select * into g from public.ball_guests where signup_id=h.id;
 if g.sdhs_matched_cadet_id is not null then select * into c from public.cadet_consent where id=g.sdhs_matched_cadet_id;end if;
 if g.id is not null and g.guest_type is distinct from 'friend' and lower(trim(h.cadet_gender)) in ('female','f') and lower(trim(coalesce(c.gender,nullif(g.gender,'')))) in ('male','m') then
  recipient_type_value:='guest';recipient_id:=g.id;recipient_name_value:=g.name;company:=coalesce(c.company,h.cadet_company,'Unassigned');
 else recipient_name_value:=h.cadet_name;company:=coalesce(h.cadet_company,'Unassigned');end if;
 select * into d from public.ball_ticket_deliveries where signup_id=h.id;
 ready:=cardinality(public.ball_ticket_blockers(public.ball_effective_ticket_row(to_jsonb(h),'cadet'),case when g.id is not null then public.ball_effective_ticket_row(to_jsonb(g),'guest') end))=0;
 payload:=jsonb_build_object('signup_id',h.id,'ready',ready,'distributed',coalesce(d.distributed,false),
  'recipient_type',recipient_type_value,'recipient_guest_id',recipient_id,'recipient_name',recipient_name_value,'recipient_company',company,
  'received_by_name',case when d.distributed then d.recipient_name end,'received_company',case when d.distributed then d.recipient_company end,
  'distributed_at',d.distributed_at,'distributed_by',d.distributed_by,'ticket_count',case when g.id is null then 1 else 2 end,
  'historical',exists(select 1 from public.ball_ticket_historical_receipts where signup_id=h.id));
 return payload||jsonb_build_object('version',md5((payload||jsonb_build_object('host_facts',public.ball_effective_ticket_row(to_jsonb(h),'cadet'),'guest_facts',case when g.id is not null then public.ball_effective_ticket_row(to_jsonb(g),'guest') end))::text));
end $$;
revoke all on function public.ball_ops_ticket_record(uuid) from public,anon,authenticated;
grant execute on function public.ball_ops_ticket_record(uuid) to service_role;

create or replace function public.ball_ops_ticket_status(p_actor text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare payload jsonb;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.email_reviewers where email=lower(p_actor) and active and can_ball_ops and not must_change_password) then raise exception 'Ball Ops access required';end if;
 select coalesce(jsonb_agg(public.ball_ops_ticket_record(id) order by created_at,id),'[]'::jsonb) into payload from public.ball_signups;
 return jsonb_build_object('tickets',payload,'checked_at',statement_timestamp());
end $$;
revoke all on function public.ball_ops_ticket_status(text) from public,anon,authenticated;
grant execute on function public.ball_ops_ticket_status(text) to service_role;

create or replace function public.ball_ops_receive_tickets(p_actor text,p_signup uuid,p_expected_version text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare h public.ball_signups;g public.ball_guests;d public.ball_ticket_deliveries;ticket jsonb;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.email_reviewers where email=lower(p_actor) and active and can_ball_ops and not must_change_password) then raise exception 'Ball Ops access required';end if;
 select * into h from public.ball_signups where id=p_signup for update;
 if not found then raise exception 'Reservation no longer exists';end if;
 select * into g from public.ball_guests where signup_id=h.id for update;
 select * into d from public.ball_ticket_deliveries where signup_id=h.id for update;
 ticket:=public.ball_ops_ticket_record(h.id);
 -- A lost response can be retried without changing the original receipt.
 if coalesce(d.distributed,false) then return jsonb_build_object('ticket',ticket,'already_received',true);end if;
 if ticket->>'version' is distinct from p_expected_version then raise exception 'Ticket details changed. Refresh and review the reservation again';end if;
 if (ticket->>'ready')::boolean is distinct from true then raise exception 'Complete the reservation requirements before handing out tickets';end if;
 insert into public.ball_ticket_deliveries(signup_id,recipient_type,recipient_guest_id,recipient_name,recipient_company,distributed,distributed_at,distributed_by)
 values(h.id,ticket->>'recipient_type',(ticket->>'recipient_guest_id')::uuid,ticket->>'recipient_name',ticket->>'recipient_company',true,now(),lower(p_actor))
 on conflict(signup_id) do update set recipient_type=excluded.recipient_type,recipient_guest_id=excluded.recipient_guest_id,recipient_name=excluded.recipient_name,recipient_company=excluded.recipient_company,distributed=true,distributed_at=excluded.distributed_at,distributed_by=excluded.distributed_by;
 return jsonb_build_object('ticket',public.ball_ops_ticket_record(h.id),'already_received',false);
end $$;
revoke all on function public.ball_ops_receive_tickets(text,uuid,text) from public,anon,authenticated;
grant execute on function public.ball_ops_receive_tickets(text,uuid,text) to service_role;

create table if not exists public.ball_ticket_historical_batches(
 id uuid primary key,signup_ids uuid[] not null,note text not null,recorded_at timestamptz not null default now(),newly_recorded integer not null default 0
);
alter table public.ball_ticket_historical_batches enable row level security;
revoke all on public.ball_ticket_historical_batches from public,anon,authenticated;
grant all on public.ball_ticket_historical_batches to service_role;
commit;

-- One-time, user-directed historical correction. Host company was confirmed.
-- Fixed cohort captured 2026-11-05T14:08:50.110944+00:00: 31 reservations.
-- No future reservation is automatically marked received. Existing receipts,
-- payments, forms, verification, attire decisions and arrivals are preserved.
begin;
do $$
declare
 ids uuid[]:=array['1aff05b1-0384-4c7a-be00-f7ae13f582e7'::uuid,'2200544c-5b10-4508-8ea8-245b9be0a6f8'::uuid,'27ca39d7-91a3-497a-b70d-d7f1eab44fc2'::uuid,'2ae8aa07-175c-41be-a4f4-7a23aaec41af'::uuid,'2b135186-57c7-48e4-b8f5-111ea16e13f8'::uuid,'3659209c-85e8-4e32-8e87-b278ebde2c34'::uuid,'380633ec-0347-4b4c-aeb7-478318069016'::uuid,'39ece6d8-52db-4317-a458-5e204e3f7997'::uuid,'3af71b06-0a55-4da0-bb8e-67d7c347d700'::uuid,'445b40db-1a11-42d0-9615-2b3230559aca'::uuid,'47d0d41c-709c-45eb-93d4-ea189bc72018'::uuid,'4f2e18f1-28e4-4e44-a469-87d861eac0ee'::uuid,'56c96f2f-e241-4991-84f9-2c96264b0104'::uuid,'6c070f39-a6f5-4d78-80d2-3423e318d6a5'::uuid,'737dcb5a-e2af-478e-b49b-4c173959846c'::uuid,'790f152e-c720-4259-9b9e-70197622c004'::uuid,'807cc797-ee7b-4776-a10f-6d19b3ee1a1b'::uuid,'813783d1-4222-4796-8c52-305bbebf73d0'::uuid,'84ddfa4c-1a11-4c71-b619-96d94dc7bf0c'::uuid,'853ee553-9875-4eac-9053-257b970a2669'::uuid,'8558b51d-4df3-42d1-ad02-c4e842237eae'::uuid,'8bc42699-d3a2-469a-bf7d-b6a4f454ce49'::uuid,'91e8adac-5e76-4048-90aa-3a15e7ff0300'::uuid,'93386aef-65b2-4120-ad93-fba76744ae18'::uuid,'980c1555-765e-4c71-b648-7dedf2be5091'::uuid,'bf39b8f4-65c7-43e3-b40c-0d11d9b7fa86'::uuid,'cb1744bd-6bc6-4191-8f67-565ad45e7667'::uuid,'cb395ec3-f1ea-465e-b28d-83280d4f459e'::uuid,'ccc3f0bc-7bfe-45d2-835b-a52d365e0b4d'::uuid,'ee883537-431a-45cf-adcd-ea04391cf963'::uuid,'ef2f0058-3405-41b3-82d1-8d34c7cabfa9'::uuid];
 batch uuid:='94d76083-6187-412a-8f04-3c5a8ee242d6';
 h public.ball_signups;g public.ball_guests;c public.cadet_consent;d public.ball_ticket_deliveries;
 inserted_batch uuid;new_count integer:=0;kind text;person uuid;person_name text;company text;
 note_value text:='Already handed out: Alpha and Staff host-company reservations, explicitly reported by the user on November 5, 2026. This records ticket receipt only; outstanding requirements remain outstanding.';
begin
 insert into public.ball_ticket_historical_batches(id,signup_ids,note) values(batch,ids,note_value)
 on conflict(id) do nothing returning id into inserted_batch;
 if inserted_batch is null then raise notice 'This historical ticket batch was already recorded; nothing changed.';return;end if;
 if (select count(*) from public.ball_signups where id=any(ids))<>cardinality(ids) then raise exception 'A selected reservation no longer exists. Review the batch before applying it';end if;
 for h in select * from public.ball_signups where id=any(ids) order by id for update loop
  if lower(trim(h.cadet_company)) not in ('alpha','staff') or h.cadet_company is null then raise exception 'A selected host moved out of Alpha/Staff. Nothing was recorded';end if;
  select * into d from public.ball_ticket_deliveries where signup_id=h.id for update;
  if coalesce(d.distributed,false) then continue;end if;
  select * into g from public.ball_guests where signup_id=h.id for share;
  c:=null;
  if g.sdhs_matched_cadet_id is not null then select * into c from public.cadet_consent where id=g.sdhs_matched_cadet_id;end if;
  kind:='host';person:=null;person_name:=h.cadet_name;company:=coalesce(h.cadet_company,'Unassigned');
  if g.id is not null and g.guest_type is distinct from 'friend' and lower(h.cadet_gender) in ('female','f') and lower(coalesce(c.gender,nullif(g.gender,''))) in ('male','m') then kind:='guest';person:=g.id;person_name:=g.name;company:=coalesce(c.company,h.cadet_company,'Unassigned');end if;
  insert into public.ball_ticket_historical_receipts(signup_id,host_company,guest_id_at_recording,batch_id,note,previous_delivery)
   values(h.id,lower(trim(h.cadet_company)),g.id,batch,note_value,case when d.signup_id is not null then to_jsonb(d) end);
  insert into public.ball_ticket_deliveries(signup_id,recipient_type,recipient_guest_id,recipient_name,recipient_company,distributed,distributed_at,distributed_by)
   values(h.id,kind,person,person_name,company,true,now(),'user-reported historical handout / 2026-11-05')
   on conflict(signup_id) do update set recipient_type=excluded.recipient_type,recipient_guest_id=excluded.recipient_guest_id,recipient_name=excluded.recipient_name,recipient_company=excluded.recipient_company,distributed=true,distributed_at=excluded.distributed_at,distributed_by=excluded.distributed_by;
  new_count:=new_count+1;
 end loop;
 update public.ball_ticket_historical_batches set newly_recorded=new_count where id=batch;
 raise notice 'Historical ticket receipt recorded: % selected, % newly recorded, % already received. No reservation requirements were changed.',cardinality(ids),new_count,cardinality(ids)-new_count;
end $$;
commit;
