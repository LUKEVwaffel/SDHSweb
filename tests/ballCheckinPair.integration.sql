-- Run against the disposable Ball fixture database after BALL_CHECKIN_PAIR.sql.
begin;
set test.role='service_role';
set test.email='pair-desk@example.invalid';
insert into public.ball_checkin_staff(email,display_name) values('pair-desk@example.invalid','Pair Desk');
do $$
declare host uuid; guest uuid; people jsonb; outcome jsonb; rejected boolean:=false;
begin
 insert into public.ball_vip_signups(name,dress_approved) values('Pair VIP',true) returning id into host;
 insert into public.ball_vip_dates(vip_signup_id,name,dress_approved) values(host,'Pair Date',true) returning id into guest;
 perform public.ball_confirm_door_student('pair-desk@example.invalid','vip',host,false);
 people:=jsonb_build_array(jsonb_build_object('kind','vip','id',host),jsonb_build_object('kind','vip_date','id',guest));
 begin
  perform public.ball_check_in_pair(people);
 exception when raise_exception then rejected:=position('currently attends SDHS' in sqlerrm)>0;
 end;
 assert rejected,'The unresolved guest was not rejected';
 assert not exists(select 1 from public.ball_arrivals where person_id=host),'A rejected pair left a saved arrival';
 assert not exists(select 1 from public.ball_arrival_log where person_id=host),'A rejected pair left an audit entry';
 perform public.ball_confirm_door_student('pair-desk@example.invalid','vip_date',guest,false);
 outcome:=public.ball_check_in_pair(people);
 assert jsonb_array_length(outcome)=2;
 assert (select count(*)=2 and count(distinct checked_in_at)=1 from public.ball_arrivals where person_id in (host,guest) and checked_in_by='pair-desk@example.invalid');
 assert (select count(*)=2 from public.ball_arrival_log where person_id in (host,guest) and actor='pair-desk@example.invalid');
end $$;
rollback;
