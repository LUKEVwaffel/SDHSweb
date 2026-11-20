-- Run against disposable check-in fixtures after BALL_DOOR_ADDITIONAL_REVIEWERS.sql.
begin;
set test.role='service_role';
set test.email='luke-door-test@example.invalid';
insert into public.ball_checkin_staff(email,display_name) values('luke-door-test@example.invalid','Desk Operator');
insert into public.ball_dress_staff(email,name,active,pin_hash) values('luke-door-test@example.invalid','Fixture','true','portal-hash');
insert into public.ball_door_approvers(key,email,door_pin_hash) values('luke','luke-door-test@example.invalid','door-hash');
insert into public.ball_dress_staff(email,name,active) values('danielle-door-test@example.invalid','Danielle',false);
insert into public.admin_roles(email,role) values('danielle-door-test@example.invalid','s5');
insert into public.ball_door_approvers(key,email,door_pin_hash) values('danielle','danielle-door-test@example.invalid','danielle-door-hash');
do $$
declare who uuid; station uuid; reviewer uuid; outcome jsonb; blocked boolean:=false;
begin
 insert into public.ball_vip_signups(name,dress_approved) values('Door Test Attendee',null) returning id into who;
 assert (select pin_hash='door-hash' from public.ball_door_reviewer_credentials() where key='luke');
 assert not has_function_privilege('authenticated','public.ball_door_reviewer_credentials()','execute');
 begin
   perform public.ball_decide_door_attire('luke-door-test@example.invalid','vip',who,'luke','portal-hash',true,'pending',true);
 exception when raise_exception then blocked:=true; end;
 assert blocked,'Portal PIN was accepted for Luke’s door-only attire review';
 outcome:=public.ball_decide_door_attire('luke-door-test@example.invalid','vip',who,'luke','door-hash',true,'pending',true);
 assert outcome->>'attire_by'='Luke Vetsch';
 outcome:=public.ball_decide_door_attire('luke-door-test@example.invalid','vip',who,'danielle','danielle-door-hash',true,'pending',true);
 assert outcome->>'attire_by'='Danielle';
 assert not exists(select 1 from public.ball_door_decision_log where person_id=who);
 station:=(public.ball_prepare_offline_station()->>'station_id')::uuid;
 insert into public.ball_offline_reviewers(station_id,approver_key,pin_fingerprint,public_key)
 values(station,'luke',encode(sha256(convert_to('door-hash','UTF8')),'hex'),'{}') returning id into reviewer;
 perform public.ball_apply_offline_operation('luke-door-test@example.invalid',station,
   jsonb_build_object('id',gen_random_uuid(),'kind','vip','person_id',who,'occurred_at',clock_timestamp(),
    'action','attire','payload',jsonb_build_object('reviewer_id',reviewer,'approved',true,'expected','pending')),reviewer);
 assert (select attire_by='Luke Vetsch' and attire_status='approved' from public.ball_door_people() where person_id=who);
 assert (select count(*)=1 from public.ball_door_decision_log where person_id=who and approver_key='luke' and action='attire_approved');
insert into public.ball_offline_reviewers(station_id,approver_key,pin_fingerprint,public_key)
 values(station,'danielle',encode(sha256(convert_to('danielle-door-hash','UTF8')),'hex'),'{}') returning id into reviewer;
 perform public.ball_apply_offline_operation('luke-door-test@example.invalid',station,
   jsonb_build_object('id',gen_random_uuid(),'kind','vip','person_id',who,'occurred_at',clock_timestamp(),
    'action','attire','payload',jsonb_build_object('reviewer_id',reviewer,'approved',false,'expected','approved')),reviewer);
 assert (select attire_by='Danielle' and attire_status='denied' from public.ball_door_people() where person_id=who);
 assert (select count(*)=1 from public.ball_door_decision_log where person_id=who and approver_key='danielle' and action='attire_denied');
end $$;
rollback;
