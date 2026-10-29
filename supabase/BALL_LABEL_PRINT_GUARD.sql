-- Read-only, S-6-only label generation. Never marks a ticket delivered.
begin;
create or replace function public.ball_ticket_blockers(h jsonb,g jsonb default null) returns text[]
language plpgsql immutable set search_path=public as $$
declare issues text[]:='{}';due numeric;paid numeric;friend_due numeric;requires_form boolean;
begin
 if h is null then return array['reservation_missing'];end if;
 if h->>'status' is distinct from 'fully_verified' then issues:=array_append(issues,'reservation_not_verified');end if;
 if g is not null and (g->>'is_sdhs_jrotc')::boolean is distinct from true and (g->>'field_trip_form_required')::boolean is false and nullif(g->>'sdhs_matched_cadet_id','') is null and nullif(trim(coalesce(g->>'school_attended','')),'') is null then issues:=array_append(issues,'guest_school_unconfirmed');end if;
 if g is not null and nullif(g->>'verified_at','') is null then issues:=array_append(issues,'guest_not_verified');end if;
 if ((h->>'standalone_guest')::boolean is distinct from true or (h->>'field_trip_form_required')::boolean is distinct from false) and (h->>'field_trip_form_received')::boolean is distinct from true then issues:=array_append(issues,'host_form_missing');end if;
 requires_form:=g is not null and ((g->>'field_trip_form_required')::boolean is distinct from false or (g->>'is_sdhs_jrotc')::boolean is true or nullif(g->>'sdhs_matched_cadet_id','') is not null or coalesce(g->>'school_attended','') ~* '(soddy[[:space:]-]*daisy|\msdhs\M)');
 if requires_form and (g->>'field_trip_form_received')::boolean is distinct from true then issues:=array_append(issues,'guest_form_missing');end if;
 due:=(h->>'amount_due')::numeric;
 paid:=coalesce((h->>'amount_paid')::numeric,case when (h->>'cash_received')::boolean is true then due else 0 end);
 if due is null or due<0 or due::text in ('NaN','Infinity','-Infinity') then issues:=array_append(issues,'host_price_unknown');
 elsif paid is null or paid<0 or paid::text in ('NaN','Infinity','-Infinity') or round(paid,2)<round(due,2) then issues:=array_append(issues,'host_balance_due');end if;
 if g->>'guest_type'='friend' then
  friend_due:=(g->>'friend_amount_due')::numeric;
  if friend_due is null or friend_due<0 or friend_due::text in ('NaN','Infinity','-Infinity') then issues:=array_append(issues,'friend_price_unknown');
  elsif friend_due>0 and not(coalesce((g->>'friend_cash_received')::boolean,false) or (coalesce(g->>'friend_payment_method'='host_delivers',false) and coalesce((h->>'cash_received')::boolean,false))) then issues:=array_append(issues,'friend_payment_missing');end if;
 end if;
 if not(lower(trim(coalesce(h->>'cadet_gender','')))='male' and (h->>'standalone_guest')::boolean is distinct from true) and (h->>'dress_approved')::boolean is distinct from true then issues:=array_append(issues,'host_attire_unapproved');end if;
 if (h->>'door_attire_denied')::boolean is true then issues:=array_append(issues,'host_attire_denied_on_site');end if;
 if g is not null and (g->>'dress_approved')::boolean is distinct from true then issues:=array_append(issues,'guest_attire_unapproved');end if;
 return issues;
end $$;
revoke all on function public.ball_ticket_blockers(jsonb,jsonb) from public,anon;
grant execute on function public.ball_ticket_blockers(jsonb,jsonb) to authenticated,service_role;
create or replace function public.ball_label_print_batch(p_signup_ids uuid[],p_undelivered_only boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare snapshot jsonb;h jsonb;g jsonb;c jsonb;labels jsonb:='[]';expected_guest boolean;recipient_name text;company text;let_level text;blocked text[]:='{}';
begin
 if auth.role() is distinct from 'service_role' and public.is_s6() is distinct from true then raise exception 'S-6 required'; end if;
 if p_signup_ids is null or cardinality(p_signup_ids)=0 or cardinality(p_signup_ids)>1000 or array_position(p_signup_ids,null) is not null then raise exception 'Choose 1 to 1000 reservations'; end if;
 if (select count(distinct id) from unnest(p_signup_ids)id)<>cardinality(p_signup_ids) then raise exception 'Duplicate reservation selection'; end if;
 snapshot:=public.ball_ticket_snapshot(2);
 for h in select value from jsonb_array_elements(snapshot->'hosts') where (value->>'id')::uuid=any(p_signup_ids) loop
  select value into g from jsonb_array_elements(snapshot->'guests') where value->>'signup_id'=h->>'id';
  if coalesce(p_undelivered_only,false) and exists(select 1 from jsonb_array_elements(snapshot->'deliveries')d where d->>'signup_id'=h->>'id' and (d->>'distributed')::boolean) then continue;end if;
  if cardinality(public.ball_ticket_blockers(h,g))>0
  then blocked:=array_append(blocked,h->>'cadet_name');continue;end if;
  select value into c from jsonb_array_elements(snapshot->'roster') where value->>'id'=g->>'sdhs_matched_cadet_id';
  expected_guest:=g is not null and g->>'guest_type' is distinct from 'friend' and lower(trim(h->>'cadet_gender')) in ('female','f') and lower(trim(coalesce(c->>'gender',g->>'gender',''))) in ('male','m');
  recipient_name:=case when expected_guest then g->>'name' else h->>'cadet_name' end;
  company:=case when expected_guest then coalesce(nullif(c->>'company',''),h->>'cadet_company','Unassigned') else coalesce(h->>'cadet_company','Unassigned') end;
  let_level:=case when expected_guest then coalesce(c->>'let_level','') else coalesce(h->>'cadet_let_level','') end;
  labels:=labels||jsonb_build_array(jsonb_build_object('signupId',h->>'id','cadetName',recipient_name,'company',company,'letLevel',let_level,'guestName',case when expected_guest then h->>'cadet_name' else g->>'name' end));
 end loop;
 if (select count(*) from jsonb_array_elements(snapshot->'hosts') where (value->>'id')::uuid=any(p_signup_ids))<>cardinality(p_signup_ids) then raise exception 'A selected reservation no longer exists. Refresh; nothing was printed.';end if;
 if cardinality(blocked)>0 then raise exception 'Incomplete reservations blocked: %. Refresh and review; nothing was printed.',array_to_string(blocked,', ');end if;
 if jsonb_array_length(labels)=0 then raise exception 'No undelivered complete reservations remain. Nothing was printed.';end if;
 select jsonb_agg(value order by value->>'company',value->>'cadetName',value->>'signupId') into labels from jsonb_array_elements(labels);
 return jsonb_build_object('policy_version',2,'labels',labels,'snapshot_version',snapshot->>'version','checked_at',snapshot->>'checked_at');
end $$;
revoke all on function public.ball_label_print_batch(uuid[],boolean) from public,anon;
grant execute on function public.ball_label_print_batch(uuid[],boolean) to authenticated,service_role;
commit;
