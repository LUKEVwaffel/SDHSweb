-- Run against the disposable Ball fixture database. No live arrivals or emails.
begin;
set test.role='service_role';
set test.email='door@example.invalid';
set test.s6='';
insert into public.ball_checkin_staff(email,display_name) values('door@example.invalid','Desk Operator');
insert into public.ball_signups(cadet_school_email,cadet_name,notification_email,status,amount_due,amount_paid,cash_received,field_trip_form_required,field_trip_form_received,dress_approved,cadet_gender)
 values('door-host@school.invalid','Door Test Host','host@example.invalid','fully_verified',50,50,true,true,true,null,'male');
insert into public.ball_guests(signup_id,name,personal_email,verification_token,guest_type,verified_at,field_trip_form_required,field_trip_form_received,dress_approved)
 select id,'Door Test Guest','guest@example.invalid','private-token','date',now(),true,true,true from public.ball_signups where cadet_school_email='door-host@school.invalid';
insert into public.ball_vip_signups(name,dress_approved) values('Door Test VIP',true);
insert into public.ball_vip_dates(vip_signup_id,name,dress_approved) select id,'Door VIP Date',true from public.ball_vip_signups where name='Door Test VIP';
do $$
declare h uuid; g uuid; v uuid; vd uuid; result jsonb; roster jsonb; rejected boolean; revision uuid;
begin
 select id into h from public.ball_signups where cadet_school_email='door-host@school.invalid';
 select id into g from public.ball_guests where signup_id=h;
 select id into v from public.ball_vip_signups where name='Door Test VIP';
 select id into vd from public.ball_vip_dates where vip_signup_id=v;
 perform public.ball_confirm_door_student('door@example.invalid','vip',v,false);
 perform public.ball_confirm_door_student('door@example.invalid','vip_date',vd,false);
 roster:=public.ball_checkin_roster();
 assert jsonb_array_length(roster->'people')=4,'Incomplete door roster';
 assert position('private-token' in roster::text)=0 and position('example.invalid' in roster::text)=0,'Private contact or token exposed';
 result:=public.ball_set_arrival('cadet',h,true);
 revision:=(result->>'revision')::uuid;
 assert result->>'checked_in_at' is not null;
 assert not exists(select 1 from public.ball_arrivals where person_id=g),'Checking host in also checked guest in';
 rejected:=false;
 begin perform public.ball_set_arrival('cadet',h,true);
 exception when others then rejected:=position('another station' in sqlerrm)>0; end;
 assert rejected,'Stale station check-in accepted';
 perform public.ball_set_arrival('guest',g,true);
 perform public.ball_set_arrival('vip',v,true);
 perform public.ball_set_arrival('vip_date',vd,true);
 result:=public.ball_set_arrival('cadet',h,false,revision);
 assert result->>'checked_in_at' is null,'Undo failed';
 rejected:=false;
 begin perform public.ball_set_arrival('cadet',h,false,revision);
 exception when others then rejected:=true; end;
 assert rejected,'Stale undo accepted';
 update public.ball_signups set amount_paid=0 where id=h;
 rejected:=false;
 begin perform public.ball_set_arrival('cadet',h,true,(result->>'revision')::uuid);
 exception when others then rejected:=position('Chief' in sqlerrm)>0; end;
 assert rejected,'Unpaid admission accepted';
 update public.ball_signups set amount_paid=50,cadet_gender=null where id=h;
 assert (select 'Attire approval needed'=any(issues) from public.ball_door_people() where person_id=h),'Unknown gender skipped attire review';
 update public.ball_checkin_staff set active=false where email='door@example.invalid';
 rejected:=false;
 begin perform public.ball_checkin_roster(); exception when others then rejected:=position('access required' in sqlerrm)>0; end;
 assert rejected,'Disabled staff retained roster access';
 rejected:=false;
 begin perform public.ball_set_arrival('cadet',h,true); exception when others then rejected:=position('access required' in sqlerrm)>0; end;
 assert rejected,'Disabled staff retained attendance writes';
 assert (select count(*)=5 from public.ball_arrival_log),'Audit lost or duplicate writes logged';
 raise notice 'Ball check-in checks passed: independent arrivals, all attendee types, undo, stale stations, payment gate, attire unknowns, revocation, minimal roster and audit.';
end $$;
-- Authenticated check-in-only role cannot read registration or alter staff grants.
update public.ball_checkin_staff set active=true where email='door@example.invalid';
set test.role='authenticated';
set local role authenticated;
do $$
declare rejected boolean;
begin
 assert public.can_ball_checkin();
 assert jsonb_array_length(public.ball_checkin_roster()->'people')=4;
 assert (select count(*)=0 from public.ball_signups),'Door account can read full reservations';
 assert (select count(*)=0 from public.ball_checkin_staff),'Door account can read staff directory';
 begin insert into public.ball_checkin_staff(email,display_name) values('unauthorized@example.invalid','No');
 exception when insufficient_privilege then rejected:=true; end;
 assert rejected,'Door account can grant access';
 rejected:=false;
 begin perform public.ball_door_people(); exception when insufficient_privilege then rejected:=true; end;
 assert rejected,'Internal projection exposed';
end $$;
rollback;
