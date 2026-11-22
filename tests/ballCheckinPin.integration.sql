-- Run on the disposable Ball Check-in fixtures after BALL_CHECKIN_PIN.sql.
begin;
set test.role='service_role';
do $$
declare
 person constant text:='pin-staff@example.invalid';
 alias constant text:='checkin-11111111-1111-1111-1111-111111111111@ball-checkin.invalid';
 valid_tag constant text:=repeat('a',64);
 old_tag constant text:=repeat('b',64);
 network constant text:=repeat('c',64);
 second_network constant text:=repeat('d',64);
 result jsonb;
begin
 assert public.ball_issue_checkin_pin(person,'PIN Fixture',alias,old_tag)>clock_timestamp();
 assert public.ball_issue_checkin_pin(person,'PIN Fixture',alias,valid_tag)>clock_timestamp();
 assert public.ball_resolve_checkin_actor(alias)=person;
 assert (public.ball_lookup_checkin_pin(old_tag,network) ->> 'auth_email') is null;
 assert (public.ball_lookup_checkin_pin(valid_tag,network,'another@example.invalid') ->> 'auth_email') is null;
 for attempt in 1..3 loop
  assert public.ball_lookup_checkin_pin(old_tag,network) = '{}'::jsonb;
 end loop;
 assert (public.ball_lookup_checkin_pin(valid_tag,network)->>'limited')::boolean;
 assert public.ball_lookup_checkin_pin(valid_tag,second_network,person)->>'auth_email'=alias;

 perform set_config('test.email',alias,true);
 assert public.can_ball_checkin();
 result:=public.ball_prepare_offline_station();
 assert result->>'actor'=person;
 assert not has_function_privilege('authenticated','public.ball_lookup_checkin_pin(text,text,text)','execute');
 assert not has_table_privilege('authenticated','public.ball_checkin_pin_credentials','select');
 update public.ball_checkin_staff set active=false where email=person;
 assert public.ball_resolve_checkin_actor(alias) is null;
 assert not public.can_ball_checkin();
 assert public.ball_lookup_checkin_pin(valid_tag,second_network)='{}'::jsonb;
 update public.ball_checkin_staff set active=true where email=person;
 update public.ball_checkin_pin_credentials set expires_at=clock_timestamp()-interval '1 minute' where staff_email=person;
 assert public.ball_resolve_checkin_actor(alias) is null;
end $$;
rollback;
