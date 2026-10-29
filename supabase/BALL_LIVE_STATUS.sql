-- One database snapshot for receipts, ticket delivery and labels.
begin;
create or replace function public.ball_effective_ticket_row(person jsonb,kind text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare decision boolean;
begin
 if auth.role() is distinct from 'service_role' and public.is_s6() is distinct from true then raise exception 'S-6 required';end if;
 if person is null then return null;end if;
 if to_regclass('public.ball_door_attire') is not null then
  execute 'select approved from public.ball_door_attire where person_kind=$1 and person_id=$2' into decision using kind,(person->>'id')::uuid;
  if decision is not null then return person||jsonb_build_object('dress_approved',decision,'door_attire_denied',not decision);end if;
 end if;
 return person;
end $$;
revoke all on function public.ball_effective_ticket_row(jsonb,text) from public,anon;
grant execute on function public.ball_effective_ticket_row(jsonb,text) to authenticated,service_role;
create or replace function public.ball_ticket_snapshot(p_policy_version integer) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare payload jsonb;
begin
 if auth.role() is distinct from 'service_role' and public.is_s6() is distinct from true then raise exception 'S-6 required'; end if;
 if p_policy_version is distinct from 2 then raise exception 'Ball checks were updated. Reload Dispatch before printing. Nothing was printed.';end if;
 select jsonb_build_object(
  'policy_version',2,
  'hosts',coalesce((select jsonb_agg(public.ball_effective_ticket_row(jsonb_build_object(
   'id',h.id,'cadet_name',h.cadet_name,'cadet_company',h.cadet_company,'cadet_let_level',h.cadet_let_level,'cadet_gender',h.cadet_gender,
   'status',h.status,'amount_due',h.amount_due,'amount_paid',h.amount_paid,'cash_received',h.cash_received,'standalone_guest',h.standalone_guest,
   'field_trip_form_required',h.field_trip_form_required,'field_trip_form_received',h.field_trip_form_received,'dress_approved',h.dress_approved
  ),'cadet') order by h.id) from public.ball_signups h),'[]'::jsonb),
  'guests',coalesce((select jsonb_agg(public.ball_effective_ticket_row(jsonb_build_object(
   'id',g.id,'signup_id',g.signup_id,'name',g.name,'gender',g.gender,'guest_type',g.guest_type,'verified_at',g.verified_at,
   'is_sdhs_jrotc',g.is_sdhs_jrotc,'sdhs_matched_cadet_id',g.sdhs_matched_cadet_id,'school_attended',g.school_attended,
   'field_trip_form_required',g.field_trip_form_required,'field_trip_form_received',g.field_trip_form_received,'dress_approved',g.dress_approved,
   'friend_amount_due',g.friend_amount_due,'friend_cash_received',g.friend_cash_received,'friend_payment_method',g.friend_payment_method
  ),'guest') order by g.id) from public.ball_guests g),'[]'::jsonb),
  'roster',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'company',c.company,'let_level',c.let_level,'gender',c.gender) order by c.id)
   from public.cadet_consent c where exists(select 1 from public.ball_guests g where g.sdhs_matched_cadet_id=c.id)),'[]'::jsonb),
  'deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by d.signup_id) from public.ball_ticket_deliveries d),'[]'::jsonb)
 ) into payload;
 return payload || jsonb_build_object('version',md5(payload::text),'checked_at',statement_timestamp());
end $$;
revoke all on function public.ball_ticket_snapshot(integer) from public,anon;
grant execute on function public.ball_ticket_snapshot(integer) to authenticated,service_role;
-- Retire cached clients using the earlier completion rules.
create or replace function public.ball_ticket_snapshot() returns jsonb language plpgsql stable as $$begin raise exception 'Ball checks were updated. Reload Dispatch before printing. Nothing was printed.';end $$;
revoke all on function public.ball_ticket_snapshot() from public,anon;
grant execute on function public.ball_ticket_snapshot() to authenticated,service_role;
-- Refresh is also polled in the client; delivery events are no longer omitted.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ball_ticket_deliveries') then
  alter publication supabase_realtime add table public.ball_ticket_deliveries;
 end if;
end $$;
commit;
