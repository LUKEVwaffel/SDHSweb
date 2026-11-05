-- After current Ball ticket distribution, live status and Chief reservation migrations.
-- Installs Chief ticket tracking. This file marks no tickets received.
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
