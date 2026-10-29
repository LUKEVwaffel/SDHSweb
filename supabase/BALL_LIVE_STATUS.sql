-- One database snapshot for receipts, ticket delivery and labels.
begin;
create or replace function public.ball_ticket_snapshot() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare payload jsonb;
begin
 if auth.role() is distinct from 'service_role' and public.is_s6() is distinct from true then raise exception 'S-6 required'; end if;
 select jsonb_build_object(
  'hosts',coalesce((select jsonb_agg(jsonb_build_object(
   'id',h.id,'cadet_name',h.cadet_name,'cadet_company',h.cadet_company,'cadet_let_level',h.cadet_let_level,'cadet_gender',h.cadet_gender,
   'status',h.status,'amount_due',h.amount_due,'amount_paid',h.amount_paid,'cash_received',h.cash_received,'standalone_guest',h.standalone_guest,
   'field_trip_form_required',h.field_trip_form_required,'field_trip_form_received',h.field_trip_form_received,'dress_approved',h.dress_approved
  ) order by h.id) from public.ball_signups h),'[]'::jsonb),
  'guests',coalesce((select jsonb_agg(jsonb_build_object(
   'id',g.id,'signup_id',g.signup_id,'name',g.name,'gender',g.gender,'guest_type',g.guest_type,'verified_at',g.verified_at,
   'is_sdhs_jrotc',g.is_sdhs_jrotc,'sdhs_matched_cadet_id',g.sdhs_matched_cadet_id,'school_attended',g.school_attended,
   'field_trip_form_required',g.field_trip_form_required,'field_trip_form_received',g.field_trip_form_received,'dress_approved',g.dress_approved,
   'friend_amount_due',g.friend_amount_due,'friend_cash_received',g.friend_cash_received,'friend_payment_method',g.friend_payment_method
  ) order by g.id) from public.ball_guests g),'[]'::jsonb),
  'roster',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'company',c.company,'let_level',c.let_level,'gender',c.gender) order by c.id)
   from public.cadet_consent c where exists(select 1 from public.ball_guests g where g.sdhs_matched_cadet_id=c.id)),'[]'::jsonb),
  'deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by d.signup_id) from public.ball_ticket_deliveries d),'[]'::jsonb)
 ) into payload;
 return payload || jsonb_build_object('version',md5(payload::text),'checked_at',statement_timestamp());
end $$;
revoke all on function public.ball_ticket_snapshot() from public,anon;
grant execute on function public.ball_ticket_snapshot() to authenticated,service_role;
-- Refresh is also polled in the client; delivery events are no longer omitted.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ball_ticket_deliveries') then
  alter publication supabase_realtime add table public.ball_ticket_deliveries;
 end if;
end $$;
commit;
