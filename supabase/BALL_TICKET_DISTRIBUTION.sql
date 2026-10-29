-- Manual import for the S-6 Ticket Delivery page.
-- Tracks one checkbox and one ticket recipient per fully completed reservation.
-- Importing this file creates no distribution records and marks nothing delivered.
begin;
create table if not exists public.ball_ticket_deliveries (
  signup_id uuid primary key references public.ball_signups(id) on delete cascade,
  recipient_type text not null check(recipient_type in ('host','guest')),
  recipient_guest_id uuid,
  recipient_name text not null,
  recipient_company text not null,
  distributed boolean not null default false,
  distributed_at timestamptz,
  distributed_by text,
  created_at timestamptz not null default now(),
  constraint ball_ticket_delivery_recipient_check check(
    (recipient_type='host' and recipient_guest_id is null) or
    (recipient_type='guest' and recipient_guest_id is not null)
  ),
  constraint ball_ticket_delivery_state_check check(
    (distributed and distributed_at is not null and distributed_by is not null) or
    (not distributed and distributed_at is null and distributed_by is null)
  )
);

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
  if cardinality(public.ball_ticket_blockers(public.ball_effective_ticket_row(to_jsonb(h),'cadet'),case when has_guest then public.ball_effective_ticket_row(to_jsonb(g),'guest') else null end))>0 then
    raise exception 'Reservation is incomplete: %',array_to_string(public.ball_ticket_blockers(public.ball_effective_ticket_row(to_jsonb(h),'cadet'),case when has_guest then public.ball_effective_ticket_row(to_jsonb(g),'guest') else null end),', ');
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

drop trigger if exists ball_ticket_delivery_guard_trg on public.ball_ticket_deliveries;
create trigger ball_ticket_delivery_guard_trg before insert or update on public.ball_ticket_deliveries
for each row execute function public.ball_ticket_delivery_guard();

alter table public.ball_ticket_deliveries enable row level security;
revoke all on public.ball_ticket_deliveries from anon,public;
grant select,insert,update,delete on public.ball_ticket_deliveries to authenticated;
drop policy if exists ball_ticket_delivery_s6 on public.ball_ticket_deliveries;
create policy ball_ticket_delivery_s6 on public.ball_ticket_deliveries
  for all to authenticated using(public.is_s6()) with check(public.is_s6());
commit;
