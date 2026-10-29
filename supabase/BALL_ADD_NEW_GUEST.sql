-- Reviewed creation of a new, UNVERIFIED guest. No attendee records change on import.
begin;
do $$declare definition text;begin
 select pg_get_expr(conbin,conrelid) into definition from pg_constraint where conrelid='public.ball_reservation_changes'::regclass and conname='ball_reservation_changes_action_check';
 if definition is null then raise exception 'Install the Ball reservation change audit first';end if;
 if position('add_guest' in definition)=0 then
  alter table public.ball_reservation_changes drop constraint ball_reservation_changes_action_check;
  execute 'alter table public.ball_reservation_changes add constraint ball_reservation_changes_action_check check (('||definition||') or action=''add_guest'')';
 end if;
end $$;
create unique index if not exists ball_guests_personal_email_unique on public.ball_guests(lower(trim(personal_email))) where nullif(trim(personal_email),'') is not null;
create or replace function public.prepare_ball_guest_addition(p_admin text,p_signup uuid,p_guest jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare h public.ball_signups;c public.cadet_consent;cfg public.ball_config;v jsonb;payload jsonb;change_id uuid;v_email text;name text;kind text;school text;roster uuid;age_value numeric;paid numeric;host_total numeric;friend_total numeric:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 if not exists(select 1 from public.admin_roles where email=lower(p_admin) and role='s6' and not must_change_password) then raise exception 'S-6 required';end if;
 select * into h from public.ball_signups where id=p_signup for update;
 if not found then raise exception 'Host reservation not found';end if;
 if h.standalone_guest is true or h.status is distinct from 'fully_verified' then raise exception 'Choose an existing verified cadet solo reservation';end if;
 if exists(select 1 from public.ball_guests where signup_id=h.id) then raise exception 'This host already has a guest. Use the supported removal or split first';end if;
 if exists(select 1 from public.ball_ticket_deliveries where signup_id=h.id and distributed) then raise exception 'Tickets were already delivered. Revoke delivery and review before adding a guest';end if;
 name:=trim(p_guest->>'name');v_email:=lower(trim(p_guest->>'personal_email'));kind:=p_guest->>'guest_type';
 if coalesce(length(name),0) not between 1 and 120 then raise exception 'Provide the guest full name';end if;
 if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or v_email ~ '(^|[.@])(students[.])?hcde[.]org$' then raise exception 'Provide a valid personal guest email, not a school inbox';end if;
 if kind is null or kind not in ('date','friend') then raise exception 'Choose date (couple pricing) or friend (separate ticket)';end if;
 if jsonb_typeof(p_guest->'age') is distinct from 'number' then raise exception 'Provide the guest age';end if;
 age_value:=(p_guest->>'age')::numeric;
 if age_value<1 or age_value>120 or age_value<>trunc(age_value) then raise exception 'Provide a valid whole-number age';end if;
 if p_guest->>'gender' is null or p_guest->>'gender' not in ('male','female') then raise exception 'Provide guest gender for the existing attire workflow';end if;
 if jsonb_typeof(p_guest->'attends_sdhs') is distinct from 'boolean' then raise exception 'Confirm whether the guest currently attends SDHS';end if;
 roster:=nullif(p_guest->>'roster_id','')::uuid;
 if roster is not null then
  if kind<>'date' then raise exception 'A roster cadet must be added as a date or keep their own reservation, not an out-of-program friend';end if;
  select * into c from public.cadet_consent where id=roster;
  if not found or lower(trim(c.name))<>lower(name) then raise exception 'Resolve the exact guest roster identity before preparing';end if;
  if lower(trim(c.school_email))=lower(trim(h.cadet_school_email)) then raise exception 'The host cannot be their own guest';end if;
  if (p_guest->>'attends_sdhs')::boolean is not true then raise exception 'A matched SDHS cadet attends SDHS';end if;
 else
  if nullif(trim(p_guest->>'poc_name'),'') is null or coalesce(p_guest->>'poc_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(regexp_replace(coalesce(p_guest->>'poc_phone',''),'[^0-9]','','g'))<10 then raise exception 'Outside-program guests need point-of-contact name, email and phone, as on the signup form';end if;
 end if;
 school:=case when (p_guest->>'attends_sdhs')::boolean then 'Soddy Daisy High School' else nullif(trim(p_guest->>'school_attended'),'') end;
 if school is null then raise exception 'Provide the guest school, or an explicit not-currently-a-student description';end if;
 if (p_guest->>'attends_sdhs')::boolean is false and school ~* '(soddy[[:space:]-]*daisy|\msdhs\M)' then raise exception 'School and SDHS enrollment answers conflict';end if;
 if v_email=lower(trim(h.notification_email)) or v_email=lower(trim(h.cadet_school_email)) then raise exception 'Use the guest own personal email, not the host email';end if;
 perform pg_advisory_xact_lock(hashtextextended('ball-guest:'||v_email,0));
 if exists(select 1 from public.ball_guests where lower(trim(personal_email))=v_email or (roster is not null and sdhs_matched_cadet_id=roster)) then raise exception 'This guest is already attached to a reservation; resolve that record first';end if;
 if exists(select 1 from public.ball_signups where lower(trim(notification_email))=v_email or (roster is not null and lower(trim(cadet_school_email))=lower(trim(c.school_email)))) then raise exception 'This person already has a reservation; use the existing reservation merge instead';end if;
 if kind='friend' and (exists(select 1 from public.cadet_consent where lower(trim(school_email))=v_email) or exists(select 1 from public.admin_roles where lower(email)=v_email)) then raise exception 'Program members cannot be added as out-of-program friends';end if;
 if nullif(trim(h.notification_email),'') is null or h.notification_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Correct the host personal notification email first';end if;
 select * into cfg from public.ball_config where id=true for share;
 if h.amount_due is null or h.amount_due<0 or h.amount_due::text in ('NaN','Infinity','-Infinity') then raise exception 'Resolve the current ticket price first';end if;
 paid:=coalesce(h.amount_paid,case when h.cash_received then h.amount_due else 0 end);
 host_total:=case when kind='date' then cfg.price_couple else h.amount_due end;
 friend_total:=case when kind='friend' then cfg.price_cadet else 0 end;
 if host_total is null or friend_total is null or host_total<0 or friend_total<0 or host_total::text in ('NaN','Infinity','-Infinity') or friend_total::text in ('NaN','Infinity','-Infinity') then raise exception 'Configure valid Ball ticket prices first';end if;
 if paid is null or paid<0 or paid::text in ('NaN','Infinity','-Infinity') then raise exception 'Resolve recorded host payment first';end if;
 payload:=jsonb_build_object('name',name,'personal_email',v_email,'age',age_value,'gender',p_guest->>'gender','guest_type',kind,'is_sdhs_jrotc',roster is not null,'sdhs_matched_cadet_id',roster,'school_attended',school,'field_trip_form_required',(p_guest->>'attends_sdhs')::boolean,'poc_name',nullif(trim(p_guest->>'poc_name'),''),'poc_email',nullif(lower(trim(p_guest->>'poc_email')),''),'poc_phone',nullif(trim(p_guest->>'poc_phone'),''));
 v:=jsonb_build_object('action','add_guest','signup_id',h.id,'host_name',h.cadet_name,'date_name',name,'host_email',h.notification_email,'date_email',v_email,'guest_type',kind,'old_total',h.amount_due,'old_paid',paid,'host_total',host_total,'host_paid',paid,'host_balance',greatest(host_total-paid,0),'host_credit',greatest(paid-host_total,0),'date_total',friend_total,'date_paid',0,'date_balance',friend_total,'date_credit',0,'guest_verified',false,'guest_details',payload,'friend_payment_method',case when kind='friend' then 'self_pays' else null end,'verification_note','New guest invitation required. No verification, payment, form or attire approval is granted. Friend payment is recorded separately, including when the host brings it.');
 insert into public.ball_reservation_changes(admin_email,signup_id,action,before_state,preview) values(lower(p_admin),h.id,'add_guest',jsonb_build_object('signup',to_jsonb(h),'cadet',to_jsonb(c),'couple_price',cfg.price_couple,'cadet_price',cfg.price_cadet),v) returning id into change_id;
 return v||jsonb_build_object('id',change_id,'status','pending');
end $$;
create or replace function public.apply_ball_guest_addition(p_admin text,p_change uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.ball_reservation_changes;h public.ball_signups;c public.cadet_consent;cfg public.ball_config;g jsonb;guest_id uuid;v jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 if not exists(select 1 from public.admin_roles where email=lower(p_admin) and role='s6' and not must_change_password) then raise exception 'S-6 required';end if;
 select * into a from public.ball_reservation_changes where id=p_change and admin_email=lower(p_admin) for update;
 if not found or a.action<>'add_guest' then raise exception 'Guest-addition proposal not found';end if;
 if a.status='applied' then return a.result;end if;
 if a.status<>'pending' or a.created_at<now()-interval '30 minutes' then raise exception 'Proposal cancelled or expired. Prepare again';end if;
 select * into h from public.ball_signups where id=a.signup_id for update;
 select * into cfg from public.ball_config where id=true for share;
 g:=a.preview->'guest_details';
 if to_jsonb(h) is distinct from a.before_state->'signup' or to_jsonb(cfg.price_couple) is distinct from a.before_state->'couple_price' or to_jsonb(cfg.price_cadet) is distinct from a.before_state->'cadet_price' then raise exception 'Reservation or pricing changed. Prepare again';end if;
 if exists(select 1 from public.ball_guests where signup_id=h.id) then raise exception 'The reservation now has a guest. Prepare again';end if;
 if exists(select 1 from public.ball_ticket_deliveries where signup_id=h.id and distributed) then raise exception 'Tickets were delivered since preview. Review delivery first';end if;
 perform pg_advisory_xact_lock(hashtextextended('ball-guest:'||(g->>'personal_email'),0));
 if exists(select 1 from public.ball_guests where lower(trim(personal_email))=g->>'personal_email' or (g->>'sdhs_matched_cadet_id' is not null and sdhs_matched_cadet_id=(g->>'sdhs_matched_cadet_id')::uuid)) then raise exception 'Guest already belongs to another reservation';end if;
 if nullif(g->>'sdhs_matched_cadet_id','') is not null then
  select * into c from public.cadet_consent where id=(g->>'sdhs_matched_cadet_id')::uuid for share;
  if to_jsonb(c) is distinct from a.before_state->'cadet' then raise exception 'Guest roster identity changed. Prepare again';end if;
 end if;
 if exists(select 1 from public.ball_signups where lower(trim(notification_email))=g->>'personal_email' or (c.id is not null and lower(trim(cadet_school_email))=lower(trim(c.school_email)))) then raise exception 'Guest now has their own reservation. Use the existing merge';end if;
 if g->>'guest_type'='friend' and (exists(select 1 from public.cadet_consent where lower(trim(school_email))=g->>'personal_email') or exists(select 1 from public.admin_roles where lower(email)=g->>'personal_email')) then raise exception 'Program members cannot be added as friends';end if;
 insert into public.ball_guests(signup_id,name,age,gender,is_sdhs_jrotc,sdhs_matched_cadet_id,school_attended,poc_name,poc_email,poc_phone,personal_email,verification_token,guest_type,friend_payment_method,friend_amount_due,friend_cash_received,field_trip_form_required,field_trip_form_received,dress_approved,verified_at)
 values(h.id,g->>'name',(g->>'age')::integer,g->>'gender',(g->>'is_sdhs_jrotc')::boolean,(g->>'sdhs_matched_cadet_id')::uuid,g->>'school_attended',g->>'poc_name',g->>'poc_email',g->>'poc_phone',g->>'personal_email',gen_random_uuid()::text,g->>'guest_type',a.preview->>'friend_payment_method',case when g->>'guest_type'='friend' then (a.preview->>'date_total')::numeric else null end,false,(g->>'field_trip_form_required')::boolean,false,null,null) returning id into guest_id;
 update public.ball_signups set status='guest_pending',amount_due=(a.preview->>'host_total')::numeric,amount_paid=(a.preview->>'host_paid')::numeric,cash_received=(a.preview->>'host_paid')::numeric >= (a.preview->>'host_total')::numeric where id=h.id;
 v:=a.preview||jsonb_build_object('id',a.id,'status','applied','guest_id',guest_id);
 update public.ball_reservation_changes set status='applied',result=v,applied_at=now() where id=a.id;
 return v;
end $$;
revoke all on function public.prepare_ball_guest_addition(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.apply_ball_guest_addition(text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_ball_guest_addition(text,uuid,jsonb) to service_role;
grant execute on function public.apply_ball_guest_addition(text,uuid) to service_role;
commit;
