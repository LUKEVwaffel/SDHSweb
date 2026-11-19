begin;
set test.role='service_role';
insert into public.ball_checkin_staff(email,display_name) values('auto-pin@example.invalid','Door Operator');
do $$
declare result jsonb; denied boolean:=false;
begin
 for attempt in 1..5 loop
   result:=public.ball_reserve_door_pin('auto-pin@example.invalid');
   assert (result->>'allowed')::boolean,'Five attempts should be permitted';
 end loop;
 assert not (public.ball_reserve_door_pin('auto-pin@example.invalid')->>'allowed')::boolean,'Repeated guesses not locked';
 update public.ball_door_pin_attempts set locked_until=now()-interval '1 second' where actor='auto-pin@example.invalid';
 assert (public.ball_reserve_door_pin('auto-pin@example.invalid')->>'allowed')::boolean,'Expired lock did not reopen';
 assert (select fail_count=1 from public.ball_door_pin_attempts where actor='auto-pin@example.invalid'),'Expired lock did not reset count';
 begin perform public.ball_reserve_door_pin('unauthorized@example.invalid');exception when others then denied:=true;end;
 assert denied,'Unknown actor could reserve attempts';
 assert not has_function_privilege('authenticated','public.ball_reserve_door_pin(text)','execute'),'Browser can reset or bypass the code limit';
 raise notice 'Automatic reviewer code limiter checks passed.';
end $$;
rollback;
