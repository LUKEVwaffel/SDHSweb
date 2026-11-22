-- Disposable fixture only. No real identities or ranks.
-- Disposable fixture database only. All names, DOBs, and PIN hashes are fictional.
begin;
insert into cadet_consent(id,name,company,let_level,cadet_rank,birthdate)
 select gen_random_uuid(),'Fixture '||company||' '||n,company,'1','PVT',date '2010-01-02'
 from (values('alpha'),('bravo'),('charlie'),('delta')) c(company) cross join generate_series(1,9) n;
insert into board_members(email,display_name,board_role,company,cadet_id)
 select seat||'.'||c.company||'@example.invalid','Fixture '||seat||' '||c.company,seat,c.company,
 (select id from cadet_consent cc where cc.name='Fixture '||c.company||' '||case seat when 'co' then '1' when 'xo' then '2' else '3' end)
 from (values('alpha'),('bravo'),('charlie'),('delta')) c(company) cross join (values('co'),('xo'),('1sg')) s(seat);

set test.email='co.alpha@example.invalid';set test.s6='yes';select board_practice_start('Shared cadet fixture',null);set test.s6='';
do $$
declare s board_practice_sessions;b board_practice_sheets;c uuid;c2 uuid;focus uuid;old_focus uuid;blocked boolean;seq bigint;
begin
 select * into s from board_practice_sessions where company='alpha';c:=(s.roster->0->>'id')::uuid;c2:=(s.roster->1->>'id')::uuid;
 s:=board_practice_open_cadet(s.id,c,s.active_cadet_revision);focus:=s.active_cadet_revision;
 assert s.active_cadet_id=c,'Selection was not shared on session';
 assert (board_practice_open_cadet(s.id,c,gen_random_uuid())).active_cadet_revision=focus,'Repeated selection restarted the board';
 blocked:=false;begin perform board_practice_open_cadet(s.id,c2,focus);exception when others then blocked:=position('already on the board' in sqlerrm)>0;end;assert blocked,'A second cadet replaced an in-progress board';
 perform set_config('test.email','co.bravo@example.invalid',true);blocked:=false;begin perform board_practice_patch_field(s.id,c,focus,'score_facing','3','null');exception when others then blocked:=true;end;assert blocked,'Other company graded the active cadet';
 perform set_config('test.email','co.alpha@example.invalid',true);
 b:=board_practice_patch_field(s.id,c,focus,'score_facing','3','null');seq:=b.edit_sequence;
 assert b.edit_sequence>0,'Missing monotonic shared edit sequence';
 b:=board_practice_patch_field(s.id,c,focus,'score_facing','3','null');assert b.edit_sequence=seq,'Retry duplicated a grade edit';
 perform set_config('test.email','xo.alpha@example.invalid',true);
 b:=board_practice_patch_field(s.id,c,focus,'score_creed','1','null');assert b.scores->>'score_facing'='3','XO overwrote another category';
 blocked:=false;begin perform board_practice_patch_field(s.id,c,focus,'score_facing','0','null');exception when others then blocked:=position('Another leader changed' in sqlerrm)>0;end;assert blocked,'Conflicting grade silently overwrote the CO';
 perform set_config('test.email','1sg.alpha@example.invalid',true);
 b:=board_practice_patch_field(s.id,c,focus,'score_address','1','null');
 b:=board_practice_patch_field(s.id,c,focus,'score_jrotc','3','null');
 b:=board_practice_patch_field(s.id,c,focus,'score_class','3','null');
 b:=board_practice_patch_field(s.id,c,focus,'uniform.mode','"class_a"','""');
 b:=board_practice_patch_field(s.id,c,focus,'uniform.infractions.ranks','true','false');
 perform set_config('test.email','xo.alpha@example.invalid',true);
 b:=board_practice_patch_field(s.id,c,focus,'uniform.infractions.belt','true','false');assert b.total=17,'Uniform checkbox edits failed to merge';
 b:=board_practice_patch_field(s.id,c,focus,'uniform.infractions.belt','false','true');
 b:=board_practice_patch_field(s.id,c,focus,'uniform.infractions.ranks','false','true');
 b:=board_practice_patch_field(s.id,c,focus,'decision','"promote"','""');assert b.total=20 and b.promote_to='PV2','Shared decision or scoring failed';
 old_focus:=focus;
 s:=board_practice_pause_cadet(s.id,c,focus);assert s.active_cadet_id is null,'Pause did not return all screens to roster';
 s:=board_practice_open_cadet(s.id,c,s.active_cadet_revision);focus:=s.active_cadet_revision;assert focus<>old_focus,'Resumed board reused a stale focus token';
 blocked:=false;begin perform board_practice_patch_field(s.id,c,old_focus,'score_facing','1','3');exception when others then blocked:=true;end;assert blocked,'An old open screen edited a resumed board';
 select * into b from board_practice_sheets where session_id=s.id and cadet_id=c;
 blocked:=false;begin perform board_practice_finish_cadet(s.id,c,focus,gen_random_uuid());exception when others then blocked:=position('Scores changed' in sqlerrm)>0;end;assert blocked,'Completion ignored changed grades';
 s:=board_practice_finish_cadet(s.id,c,focus,b.revision);assert s.active_cadet_id is null,'Completion did not release shared board';
 assert (select status='complete' and total=20 from board_practice_sheets where id=b.id),'Shared board did not complete';
 perform board_practice_finish_cadet(s.id,c,focus,b.revision);
 assert (select count(*)=1 from board_practice_cadet_events where session_id=s.id and action='complete'),'Completion retry duplicated history';
 assert not has_function_privilege('authenticated','board_practice_save(jsonb)','execute'),'Whole-sheet browser writes can bypass shared merge';
 s:=board_practice_open_cadet(s.id,c2,s.active_cadet_revision);perform set_config('test.s6','yes',true);perform board_practice_end(s.round_id);perform set_config('test.s6','',true);
 assert (select active_cadet_id is null and status='review' from board_practice_sessions where id=s.id),'Daily session close did not clear active cadet';
 assert not exists(select 1 from cadet_consent where cadet_rank<>'PVT'),'Shared practice changed real ranks';
end $$;
rollback;
