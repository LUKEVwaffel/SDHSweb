-- Requires ball_reservation_changes.sql (amount_paid/payment guard). Deploy with ball-ops-reservation.
begin;
create table if not exists public.ball_ops_audit (
 id uuid primary key default gen_random_uuid(), actor text not null, action text not null,
 signup_id uuid not null, before_state jsonb, after_state jsonb, created_at timestamptz not null default now()
);
alter table public.ball_ops_audit enable row level security;
alter table public.ball_ops_audit add column if not exists request_key uuid, add column if not exists request_hash text;
create unique index if not exists ball_ops_audit_request_key on public.ball_ops_audit(actor, request_key) where request_key is not null;
-- Service-only RPC: never grant authenticated callers permission to supply their own actor.
create or replace function public.ball_ops_reservation(p_actor text,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c public.cadet_consent; s public.ball_signups; g public.ball_guests; cfg public.ball_config;
 replay public.ball_ops_audit; v_request_key uuid; fingerprint text;
 sid uuid; price numeric; paid numeric; old_state jsonb; kind text; email text; gender text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only'; end if;
 if not exists(select 1 from public.email_reviewers r where r.email=lower(p_actor) and r.active and r.can_ball_ops and not r.must_change_password) then raise exception 'Ball Ops access required'; end if;
 if p_action='health' then return jsonb_build_object('ready',true); end if;
 select * into cfg from public.ball_config where id=true for share;
 if p_action='create' then
  v_request_key := (p_data->>'request_id')::uuid;
  if v_request_key is null then raise exception 'Reload the reservation form before saving'; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(p_actor)||v_request_key::text,0));
  select * into replay from public.ball_ops_audit a where a.actor=lower(p_actor) and a.request_key=v_request_key;
  if found then
   if replay.request_hash is distinct from md5(p_data::text) then raise exception 'This request was already saved. Find the existing reservation before making changes'; end if;
   p_data := jsonb_build_object('signup_id',replay.signup_id); p_action := 'packet';
  end if;
 end if;
 if p_action='create' then
  select * into c from public.cadet_consent where id=(p_data->>'cadet_id')::uuid for update;
  if not found or nullif(trim(c.school_email),'') is null then raise exception 'Select a cadet with a school identity on file'; end if;
  if exists(select 1 from public.ball_signups where lower(cadet_school_email)=lower(c.school_email))
   or exists(select 1 from public.ball_guests where sdhs_matched_cadet_id=c.id) then raise exception 'This cadet already has a reservation or is a guest'; end if;
  kind:=p_data->>'guest_type';
  if kind not in ('none','date','friend') or kind is null then raise exception 'Choose solo, date, or friend'; end if;
  gender:=p_data->>'gender';
  if gender not in ('male','female') or gender is null then raise exception 'Select cadet gender for attire instructions'; end if;
  email:=nullif(lower(trim(p_data->>'guest_email')),'');
  if email ~* '@([^.@]+\.)*(students\.)?hcde\.org$' then raise exception 'Use a personal, non-school guest email'; end if;
  if email is not null and email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid guest email'; end if;
  if kind<>'none' and email is not null then
   perform pg_advisory_xact_lock(hashtextextended('ball-guest:'||email,0));
   if exists(select 1 from public.ball_guests x where lower(trim(x.personal_email))=email)
     or exists(select 1 from public.ball_signups x where lower(trim(x.notification_email))=email or lower(trim(x.cadet_school_email))=email) then raise exception 'This guest already has a reservation. Review the existing reservation with S-6'; end if;
  end if;
  if kind<>'none' and (nullif(trim(p_data->>'guest_name'),'') is null or coalesce(p_data->>'guest_gender','') not in ('male','female')) then raise exception 'Guest name and gender required'; end if;
  if kind<>'none' and not coalesce((p_data->>'guest_form_required')::boolean,true) and nullif(trim(p_data->>'guest_school'),'') is null then raise exception 'Enter the guest school to confirm they do not need an SDHS form'; end if;
  if kind<>'none' and not coalesce((p_data->>'guest_form_required')::boolean,true) and coalesce(p_data->>'guest_school','') ~* '(soddy[[:space:]-]*daisy|\msdhs\M)' then raise exception 'SDHS guests need their own field trip form'; end if;
  price:=case when kind='date' then cfg.price_couple else cfg.price_cadet end;
  if price is null or price::text in ('NaN','Infinity','-Infinity') or price<0 or (kind='friend' and (cfg.price_cadet is null or cfg.price_cadet<0)) then raise exception 'Configure ticket prices first'; end if;
  if p_data ? 'expected_price' and price is distinct from (p_data->>'expected_price')::numeric then raise exception 'Ticket prices changed. Reload and review the reservation'; end if;
  if kind='friend' and p_data ? 'expected_friend_price' and cfg.price_cadet is distinct from (p_data->>'expected_friend_price')::numeric then raise exception 'Friend ticket price changed. Reload and review'; end if;
  paid:=coalesce((p_data->>'amount_paid')::numeric,0);
  if paid::text in ('NaN','Infinity','-Infinity') or paid<0 or paid<>round(paid,2) then raise exception 'Payment must be nonnegative and in cents'; end if;
  insert into public.ball_signups(cadet_school_email,cadet_name,cadet_let_level,cadet_company,cadet_gender,status,amount_due,amount_paid,cash_received,field_trip_form_required,field_trip_form_received)
   values(lower(c.school_email),c.name,c.let_level,c.company,gender,case when kind='none' or coalesce((p_data->>'guest_complete')::boolean,false) then 'fully_verified' else 'guest_pending' end,price,paid,paid>=price,true,coalesce((p_data->>'host_form')::boolean,false)) returning * into s;
  sid:=s.id;
  if kind<>'none' then
   insert into public.ball_guests(signup_id,name,gender,personal_email,verification_token,guest_type,friend_payment_method,friend_amount_due,friend_cash_received,school_attended,field_trip_form_required,field_trip_form_received,verified_at,dress_code_accepted_at)
   values(sid,trim(p_data->>'guest_name'),p_data->>'guest_gender',coalesce(email,''),replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),kind,case when kind='friend' then 'self_pays' end,case when kind='friend' then cfg.price_cadet end,case when kind='friend' then coalesce((p_data->>'guest_paid')::boolean,false) else false end,case when coalesce((p_data->>'guest_form_required')::boolean,true) then 'Soddy Daisy High School' else trim(p_data->>'guest_school') end,coalesce((p_data->>'guest_form_required')::boolean,true),coalesce((p_data->>'guest_form')::boolean,false),case when coalesce((p_data->>'guest_complete')::boolean,false) then now() end,case when coalesce((p_data->>'guest_complete')::boolean,false) then now() end) returning * into g;
  end if;
 elsif p_action in ('remove_guest','complete_guest','packet') then
  select * into s from public.ball_signups where id=(p_data->>'signup_id')::uuid for update;
  if not found then raise exception 'Reservation not found'; end if;
  sid:=s.id;
  select * into g from public.ball_guests where signup_id=sid for update;
  fingerprint := md5(jsonb_build_object('signup',to_jsonb(s),'guest',case when g.id is not null then to_jsonb(g) end)::text);
  if p_action in ('remove_guest','complete_guest') then
   if g.id is null or g.id::text is distinct from p_data->>'guest_id' then raise exception 'Guest changed. Refresh and review again'; end if;
   if fingerprint is distinct from p_data->>'expected_version' then raise exception 'Reservation changed. Refresh and review again'; end if;
  end if;
  if p_action='complete_guest' and g.verified_at is null then
   if coalesce((p_data->>'paper_acknowledged')::boolean,false) is not true then raise exception 'Review signed guest registration and dress-code acknowledgment first'; end if;
   old_state:=jsonb_build_object('signup',to_jsonb(s),'guest',to_jsonb(g));
   update public.ball_guests set verified_at=now(),dress_code_accepted_at=now() where id=g.id returning * into g;
   update public.ball_signups set status='fully_verified' where id=sid returning * into s;
   insert into public.ball_ops_audit(actor,action,signup_id,before_state,after_state) values(lower(p_actor),p_action,sid,old_state,jsonb_build_object('signup',to_jsonb(s),'guest',to_jsonb(g)));
  end if;
  if p_action='remove_guest' then
   if g.id is null or g.id::text is distinct from p_data->>'guest_id' then raise exception 'Guest changed. Refresh and review again'; end if;
   if s.amount_due is distinct from (p_data->>'expected_total')::numeric or coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end) is distinct from (p_data->>'expected_paid')::numeric then raise exception 'Payment changed. Refresh and review again'; end if;
   old_state:=jsonb_build_object('signup',to_jsonb(s),'guest',to_jsonb(g));
   if g.guest_type='date' then
    if cfg.price_cadet is distinct from (p_data->>'expected_solo_price')::numeric then raise exception 'Solo price changed. Review removal again'; end if;
    if cfg.price_cadet is null or cfg.price_cadet::text in ('NaN','Infinity','-Infinity') or cfg.price_cadet<0 then raise exception 'Configure solo ticket price first'; end if;
    update public.ball_signups set amount_due=cfg.price_cadet,amount_paid=coalesce(s.amount_paid,case when s.cash_received then s.amount_due else 0 end),status='fully_verified' where id=sid returning * into s;
   else
    update public.ball_signups set status='fully_verified' where id=sid returning * into s;
   end if;
   delete from public.ball_guests where id=g.id;
   insert into public.ball_ops_audit(actor,action,signup_id,before_state,after_state) values(lower(p_actor),p_action,sid,old_state,jsonb_build_object('signup',to_jsonb(s)));
   g:=null;
  end if;
 else raise exception 'Invalid action'; end if;
 if p_action='create' then insert into public.ball_ops_audit(actor,action,signup_id,after_state,request_key,request_hash) values(lower(p_actor),p_action,sid,jsonb_build_object('signup',to_jsonb(s),'guest',to_jsonb(g)),v_request_key,md5(p_data::text)); end if;
 return jsonb_build_object('version',md5(jsonb_build_object('signup',to_jsonb(s),'guest',case when g.id is not null then to_jsonb(g) end)::text),'signup',to_jsonb(s)-array['cadet_allergies','cadet_has_allergy','cadet_allergy_email','allergy_status','allergy_contacted_at','dress_approved','dress_approved_by'],'guest',case when g.id is not null then to_jsonb(g)-array['allergies','dress_approved','dress_approved_by'] end,'config',jsonb_build_object('price_cadet',cfg.price_cadet,'price_couple',cfg.price_couple,'ball_date',cfg.ball_date,'event_time_text',cfg.event_time_text,'venue_address',cfg.venue_address,'field_trip_form_pdf_url',cfg.field_trip_form_pdf_url));
end $$;
revoke all on function public.ball_ops_reservation(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ball_ops_reservation(text,text,jsonb) to service_role;
-- Preserve existing view columns/order while adding the identity/contact facts
-- that the Chief portal uses. Invitation tokens and medical details stay out.
do $$
declare spec record; definition text; additions text; column_name text;
begin
 for spec in select * from (values
  ('ball_signups_ops_view','ball_signups',array['standalone_guest','cadet_gender','notification_email','cadet_phone','cadet_school_email']),
  ('ball_guests_ops_view','ball_guests',array['gender','verified_at','poc_name','poc_email','poc_phone','personal_email','guest_phone','sdhs_matched_cadet_id'])
 ) as specs(view_name,table_name,columns_to_add)
 loop
  if to_regclass('public.'||spec.view_name) is null then continue; end if;
  additions:='';
  foreach column_name in array spec.columns_to_add loop
   if not exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||spec.view_name) and attname=column_name and not attisdropped) then
    additions:=additions||format(', base.%I',column_name);
   end if;
  end loop;
  if additions<>'' then
   definition:=rtrim(pg_get_viewdef(to_regclass('public.'||spec.view_name),true),E';\n ');
   execute format('create or replace view public.%I with (security_barrier=true) as select old_view.*%s from (%s) old_view join public.%I base on base.id=old_view.id where public.is_ball_ops_reviewer()',spec.view_name,additions,definition,spec.table_name);
  end if;
 end loop;
end $$;
commit;
