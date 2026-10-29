begin;
set test.role='service_role'; set test.admin='yes';
do $$
declare totals jsonb; rejected boolean:=false;
begin
 totals:=public.christmas_music_poll_results();
 assert (totals->>'total')::int=3 and (totals->>'november_1')::int=2 and (totals->>'after_thanksgiving')::int=1,'Seed totals wrong';
 insert into public.christmas_music_poll_votes(choice,voter_name,device_fp) values('november_1','Fixture Voter','fp_00000000000000000000000000000001');
 begin insert into public.christmas_music_poll_votes(choice,voter_name,device_fp) values('after_thanksgiving','Different Name','fp_00000000000000000000000000000001');exception when unique_violation then rejected:=true;end;
 assert rejected,'One device voted twice';
 rejected:=false;
 begin insert into public.christmas_music_poll_votes(choice,voter_name,device_fp) values('november_1','  ','fp_00000000000000000000000000000002');exception when check_violation then rejected:=true;end;
 assert rejected,'Blank name accepted';
 assert position('device_fp' in public.christmas_music_poll_responses()::text)=0,'Admin response list leaked device keys';
 assert not has_table_privilege('anon','public.christmas_music_poll_votes','SELECT'),'Anonymous names readable';
 assert not has_table_privilege('authenticated','public.christmas_poll_guest_access','SELECT'),'Guest credentials readable';
 assert not has_function_privilege('anon','public.christmas_music_poll_responses()','execute'),'Public detailed results readable';
 assert not has_function_privilege('anon','public.christmas_poll_guest_totals()','execute'),'Public exact counts readable';
end $$;
set test.admin='';set local role authenticated;
do $$
declare rejected boolean:=false;
begin
 begin perform public.christmas_music_poll_results();exception when others then rejected:=true;end;
 assert rejected,'Non-admin aggregate access accepted';
end $$;
rollback;
