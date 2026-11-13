-- Disposable fixture database only. All records are fictional.
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
set test.s6='yes';
select board_practice_start('Hardening fixture',null);
set test.s6='';
do $$
declare s board_practice_sessions; c jsonb; p jsonb; review jsonb; blocked boolean; sign_count int; next_round uuid; member_id uuid; prior_hash text;
begin
 select * into s from board_practice_sessions where company='alpha';c:=s.roster->0;
 select public_id into member_id from board_members where email='co.alpha@example.invalid';
 insert into board_credentials(email,pin_hash,pin_fail_count,pin_locked_until) values('co.alpha@example.invalid','pbkdf2$do-not-change',5,now()+interval '15 minutes');
 insert into board_enrollment_attempts(email,failures,locked_until) values('co.alpha@example.invalid',5,now()+interval '15 minutes');
 assert not exists(select 1 from board_practice_account_status()),'Leader can read privileged verification status';
 blocked:=false;begin perform board_practice_unlock_member(member_id);exception when others then blocked:=true;end;assert blocked,'Leader cleared their own attempt lockout';
 perform set_config('test.s6','yes',true);perform board_practice_unlock_member(member_id);perform set_config('test.s6','',true);
 assert (select pin_hash='pbkdf2$do-not-change' and pin_fail_count=0 and pin_locked_until is null from board_credentials where email='co.alpha@example.invalid'),'Unlock changed a PIN or failed to reset attempts';
 assert (select failures=0 and locked_until is null from board_enrollment_attempts where email='co.alpha@example.invalid'),'DOB lock was not cleared';
 assert (select count(*)=1 from board_practice_account_resets where email='co.alpha@example.invalid'),'Presenter unlock was not audited';

 p:=jsonb_build_object('session_id',s.id,'cadet_id',c->>'id','rank_before','PVT','scores','{}'::jsonb,'status','draft','comment','Keep this unfinished draft');
 perform board_practice_save(p||'{"decision":"promote","promote_to":"PV2"}');
 perform set_config('test.s6','yes',true);
 -- A company session id cannot accidentally close only one quarter of a meeting.
 perform board_practice_end(s.round_id,s.id);
 assert not exists(select 1 from board_practice_sessions where status='running'),'Partial meeting close';
 select review_snapshot into review from board_practice_sessions where id=s.id;
 assert jsonb_array_length(review)=6,'Missing frozen sample review';
 assert not exists(select 1 from jsonb_array_elements(review)x where x->>'status'<>'complete'),'Draft included in signed review';
 assert exists(select 1 from board_practice_sheets where session_id=s.id and status='draft' and comment='Keep this unfinished draft'),'Unfinished work destroyed';
 perform set_config('test.s6','',true);
 perform board_practice_commit_signature(s.id,'co.alpha@example.invalid');
 perform board_practice_commit_signature(s.id,'xo.alpha@example.invalid');
 perform board_practice_commit_signature(s.id,'1sg.alpha@example.invalid');
 blocked:=false;begin perform board_practice_start('Bypass meeting','alpha');exception when others then blocked:=position('presenter-controlled' in sqlerrm)>0;end;
 assert blocked,'Signed company escaped an active shared round';
 blocked:=false;begin perform board_practice_cancel(s.round_id,'Unauthorized restart');exception when others then blocked:=position('Presenter access' in sqlerrm)>0;end;
 assert blocked,'Company leader cancelled everyone';
 perform set_config('test.s6','yes',true);
 select count(*) into sign_count from board_practice_signatures;
 perform board_practice_cancel(s.round_id,'Absent leader; restart the demonstration');
 assert (select status='cancelled' from board_practice_rounds where id=s.round_id),'Round not cancelled';
 assert (select count(*)=sign_count from board_practice_signatures),'Cancellation fabricated or removed signatures';
 assert not exists(select 1 from board_practice_sessions where status in ('running','review')),'Cancellation did not release pending companies';
 blocked:=false;begin perform board_practice_commit_signature((select id from board_practice_sessions where company='bravo'),'co.bravo@example.invalid');exception when others then blocked:=true;end;
 assert blocked,'Cancelled session accepted a new signature';
 next_round:=board_practice_start('Fresh manual restart',null);
 assert next_round<>s.round_id,'Restart reused the cancelled record';
 assert (select count(*)=4 from board_practice_sessions where round_id=next_round),'Restart failed to include all companies';
 assert (select status='cancelled' and cancellation_reason is not null from board_practice_rounds where id=s.round_id),'Restart destroyed cancellation history';
end $$;
grant usage on schema auth to authenticated;
set local role authenticated;
set test.s6='';
set test.email='co.bravo@example.invalid';
do $$ declare state jsonb;begin
 state:=board_practice_state();
 assert jsonb_array_length(state->'sessions')=1,'Atomic state leaks other company sessions or needless history';
 assert not exists(select 1 from jsonb_array_elements(state->'sessions')x where x->>'company'<>'bravo'),'Atomic state bypasses company RLS';
 assert state->'identity'->0->>'email'='co.bravo@example.invalid','Snapshot has wrong identity';
 assert jsonb_array_length(state->'directory')=12,'Missing safe name directory';
end $$;
reset role;
rollback;
