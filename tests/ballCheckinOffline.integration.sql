-- Run after the production Ball door migrations in a disposable fixture database.
begin;
set test.role='service_role';
set test.email='offline@example.invalid';
insert into public.ball_checkin_staff(email,display_name) values('offline@example.invalid','Offline Operator');
insert into public.ball_dress_staff(email,name,pin_hash,active) values('agillott1414@gmail.com','Aubry Gillott','fixture-hash',true)
on conflict (email) do update set active=true,pin_hash=excluded.pin_hash;
insert into public.ball_door_approvers(key,email) values('aubry','agillott1414@gmail.com') on conflict (key) do nothing;

do $$
declare
 person uuid;
 second_person uuid;
 station uuid;
 reviewer uuid;
 happened timestamptz;
 operation jsonb;
 arrival_id uuid:=gen_random_uuid();
 rejected boolean;
 operator_email constant text:='offline@example.invalid';
begin
 insert into public.ball_vip_signups(name,dress_approved) values('Offline Test VIP',null) returning id into person;
 insert into public.ball_vip_signups(name,dress_approved) values('Other Test VIP',true) returning id into second_person;
 station:=(public.ball_prepare_offline_station()->>'station_id')::uuid;
 insert into public.ball_offline_reviewers(station_id,approver_key,pin_fingerprint,public_key)
 values(station,'aubry',encode(sha256(convert_to('fixture-hash','UTF8')),'hex'),'{}') returning id into reviewer;
 happened:=clock_timestamp();
 operation:=jsonb_build_object('id',gen_random_uuid(),'kind','vip','person_id',person,'occurred_at',happened,
   'action','school','payload',jsonb_build_object('sdhs',true));
 perform public.ball_apply_offline_operation(operator_email,station,operation);
 perform public.ball_apply_offline_operation(operator_email,station,operation);
 assert (select count(*)=1 from public.ball_door_decision_log where person_id=person and action='student_status_confirmed');
 operation:=operation||jsonb_build_object('id',gen_random_uuid(),'action','form','payload',jsonb_build_object('parent','Fixture Parent','signed',true));
 perform public.ball_apply_offline_operation(operator_email,station,operation);
 operation:=operation||jsonb_build_object('id',gen_random_uuid(),'action','attire',
   'payload',jsonb_build_object('reviewer_id',reviewer,'approved',true,'expected','pending'));
 rejected:=false;
 begin perform public.ball_apply_offline_operation(operator_email,station,operation);
 exception when raise_exception then rejected:=position('reviewer proof' in sqlerrm)>0; end;
 assert rejected,'Unsigned attire was accepted';
 update public.ball_dress_staff set pin_hash='reset-hash' where email='agillott1414@gmail.com';
 rejected:=false;
 begin perform public.ball_apply_offline_operation(operator_email,station,operation,reviewer);
 exception when raise_exception then rejected:=position('reviewer access changed' in sqlerrm)>0; end;
 assert rejected,'Reset reviewer could still sync a new decision';
 update public.ball_dress_staff set pin_hash='fixture-hash' where email='agillott1414@gmail.com';
 perform public.ball_apply_offline_operation(operator_email,station,operation,reviewer);
 operation:=operation||jsonb_build_object('id',arrival_id,'action','arrival','payload',jsonb_build_object('present',true,'revision',null));
 perform public.ball_apply_offline_operation(operator_email,station,operation);
 perform public.ball_apply_offline_operation(operator_email,station,operation);
 assert (select a.checked_in_at=happened and a.revision=r.arrival_revision and a.revision<>arrival_id and a.checked_in_by=operator_email
   from public.ball_arrivals a join public.ball_offline_receipts r on r.id=arrival_id where a.person_id=person);
 assert (select count(*)=1 from public.ball_arrival_log where person_id=person);
 assert (select occurred_at=happened and synced_at>=happened from public.ball_offline_receipts where id=arrival_id);

 rejected:=false;
 begin perform public.ball_apply_offline_operation(operator_email,station,operation||jsonb_build_object('person_id',second_person));
 exception when raise_exception then rejected:=position('already used' in sqlerrm)>0; end;
 assert rejected,'Same offline action ID accepted a different payload';

 perform public.ball_apply_offline_operation(operator_email,station,operation||jsonb_build_object('id',gen_random_uuid(),
   'payload',jsonb_build_object('present',false,'revision',arrival_id)));
 assert (select checked_in_at is null from public.ball_arrivals where person_id=person);
 rejected:=false;
 begin
   perform public.ball_apply_offline_operation(operator_email,station,operation||jsonb_build_object('id',gen_random_uuid()));
 exception when raise_exception then rejected:=position('another station' in sqlerrm)>0; end;
 assert rejected,'Stale local arrival overwrote current state';
 assert (select count(*)=5 from public.ball_offline_receipts where station_id=station);
 update public.ball_checkin_staff set active=false where email=operator_email;
 rejected:=false;
 begin perform public.ball_apply_offline_operation(operator_email,station,operation);
 exception when raise_exception then rejected:=position('access required' in sqlerrm)>0; end;
 assert rejected,'Revoked operator could sync';
end $$;
rollback;
