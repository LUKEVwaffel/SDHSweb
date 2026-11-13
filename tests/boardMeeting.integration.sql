-- Disposable fixture database only. All names, DOBs, and PIN hashes are fictional.
begin;
insert into cadet_consent(id,name,company,let_level,cadet_rank,birthdate)
 select gen_random_uuid(),'Fixture '||company||' '||n,company,'1','PVT',date '2010-01-02'
 from (values('alpha'),('bravo'),('charlie'),('delta')) c(company) cross join generate_series(1,9) n;
insert into board_members(email,display_name,board_role,company,cadet_id)
 select seat||'.'||c.company||'@example.invalid','Fixture '||seat||' '||c.company,seat,c.company,
 (select id from cadet_consent cc where cc.name='Fixture '||c.company||' '||case seat when 'co' then '1' when 'xo' then '2' else '3' end)
 from (values('alpha'),('bravo'),('charlie'),('delta')) c(company) cross join (values('co'),('xo'),('1sg')) s(seat);
set test.email='co.alpha@example.invalid';
do $$
declare id uuid; result jsonb; token text; blocked boolean;
begin
 select public_id into id from board_members where email='co.alpha@example.invalid';
 for i in 1..5 loop
  result:=board_verify_enrollment(id,date '2000-01-01'); assert result ? 'error','DOB mismatch accepted';
 end loop;
 result:=board_verify_enrollment(id,date '2010-01-02'); assert result->>'error' like '%15 minutes%','DOB attempts not locked';
 update board_enrollment_attempts set locked_until=now()-interval '1 minute' where email='co.alpha@example.invalid';
 result:=board_verify_enrollment(id,date '2010-01-02'); token:=result->>'setup_token'; assert length(token)=64,'Missing proof';
 assert not exists(select 1 from board_enrollment_challenges where token_hash=token),'Plaintext proof persisted';
 assert board_finish_enrollment(token,'pbkdf2$fixture')='co.alpha@example.invalid','Enrollment failed';
 blocked:=false;begin perform board_finish_enrollment(token,'pbkdf2$replacement');exception when others then blocked:=true;end;
 assert blocked,'Enrollment proof reused';
 result:=board_verify_enrollment(id,date '2010-01-02');assert result ? 'error','DOB can replace existing PIN';
 assert not exists(select 1 from board_leader_directory() where member_id=id and needs_setup),'Returning leader sent to setup';
 assert not has_function_privilege('authenticated','board_verify_enrollment(uuid,date)','execute'),'Browser can bypass enrollment endpoint';
 assert not has_function_privilege('anon','board_finish_enrollment(text,text)','execute'),'Anonymous can set arbitrary hashes';
end $$;
set test.s6='yes';
select board_practice_start('Fixture leadership meeting',null);
set test.s6='';
do $$
declare s board_practice_sessions; c jsonb; p jsonb; b board_practice_sheets; blocked boolean; other_id uuid;
begin
 assert (select count(*) from board_practice_sessions)=4,'Meeting missing companies';
 select * into s from board_practice_sessions where company='alpha';
 assert jsonb_array_length(s.roster)=6,'Leadership seats not excluded';
 assert not exists(select 1 from jsonb_array_elements(s.roster)x where x->>'company'<>'alpha'),'Cross-company cadet leaked';
 c:=s.roster->0;
 p:=jsonb_build_object('session_id',s.id,'cadet_id',c->>'id','rank_before','PVT','scores','{"score_address":1,"score_facing":3,"score_creed":1,"score_jrotc":3,"score_class":3}'::jsonb,
 'uniform_inspection','{"mode":"class_a","missing":[],"infractions":[]}'::jsonb,'decision','promote','promote_to','PV2','status','complete');
 b:=board_practice_save(p);assert b.total=20,'Practice score incorrect';
 blocked:=false;begin perform board_practice_save(p);exception when others then blocked:=position('Another leader' in sqlerrm)>0;end;assert blocked,'Stale practice save accepted';
 b:=board_practice_save(p||jsonb_build_object('expected_revision',b.revision,'comment','Shared practice'));
 select id into other_id from board_practice_sessions where company='bravo';
 blocked:=false;begin perform board_practice_save(p||jsonb_build_object('session_id',other_id));exception when others then blocked:=true;end;assert blocked,'Cross-company save accepted';
 blocked:=false;begin perform board_practice_end(s.round_id);exception when others then blocked:=true;end;assert blocked,'Leader ended presenter-controlled meeting';
 blocked:=false;begin perform board_practice_commit_signature(s.id,'co.alpha@example.invalid');exception when others then blocked:=position('End the session' in sqlerrm)>0;end;assert blocked,'Signed running session';
 perform set_config('test.s6','yes',true);perform board_practice_end(s.round_id);perform set_config('test.s6','',true);
 assert not exists(select 1 from board_practice_sessions where status<>'review'),'Not all companies notified';
 assert (select count(*) from board_practice_sheets)=24,'Missing company-specific simulation lists';
 assert (select comment='Shared practice' from board_practice_sheets where id=b.id),'Saved practice overwritten';
 blocked:=false;begin perform board_practice_save(p||jsonb_build_object('expected_revision',b.revision));exception when others then blocked:=position('Session ended' in sqlerrm)>0;end;assert blocked,'Save accepted after session closed';
 blocked:=false;begin perform board_practice_commit_signature(s.id,'co.bravo@example.invalid');exception when others then blocked:=true;end;assert blocked,'Wrong company signed';
 -- Any order is allowed: each signs only their own fixed position.
 perform board_practice_commit_signature(s.id,'co.alpha@example.invalid');
 perform board_practice_commit_signature(s.id,'co.alpha@example.invalid');
 assert (select count(*) from board_practice_signatures)=1,'Signature retry duplicated';
 perform board_practice_commit_signature(s.id,'1sg.alpha@example.invalid');
 perform board_practice_commit_signature(s.id,'xo.alpha@example.invalid');
 assert (select status='signed' from board_practice_sessions where id=s.id),'Company not signed';
 assert (select count(distinct seal)=1 from board_practice_signatures where session_id=s.id),'Signers attested different lists';
 assert not exists(select 1 from cadet_consent where cadet_rank<>'PVT'),'Practice changed real ranks';
 assert not exists(select 1 from board_sheets),'Practice wrote real board sheets';
 assert not exists(select 1 from board_sessions),'Practice opened real board session';
 assert not has_function_privilege('authenticated','board_practice_commit_signature(uuid,text)','execute'),'Browser can forge practice signatures';
 assert not has_table_privilege('authenticated','board_practice_sheets','update'),'Browser can edit frozen practice list';
end $$;
-- Check actual RLS, not just helper predicates.
grant usage on schema auth to authenticated;
set local role authenticated;
set test.email='co.alpha@example.invalid';
do $$ begin
 assert (select count(*) from board_practice_sessions)=1,'Leader sees another company session';
 assert not exists(select 1 from board_practice_sheets where company<>'alpha'),'Leader sees another company scores';
 assert (select count(*) from board_practice_rounds)=1,'Company cannot see meeting';
end $$;
reset role;
rollback;
