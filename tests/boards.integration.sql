-- Run in the disposable boards fixture database, never against real cadets.
begin;
insert into board_questions(let_level,category,question,answer) select 1,category,'Fixture question '||n,'Fixture answer' from (values('jrotc'),('class')) c(category) cross join generate_series(1,3) n;
set test.email='co.alpha@example.invalid';
insert into board_members(email,display_name,board_role,company) values
 ('co.alpha@example.invalid','Alpha CO','co','alpha'),('xo.alpha@example.invalid','Alpha XO','xo','alpha'),
 ('1sg.alpha@example.invalid','Alpha 1SG','1sg','alpha'),('sai@example.invalid','Test SAI','sai',null);
set test.s6='yes';
select board_open_quarter('TEST Q2');
set test.s6='';
insert into cadet_consent(id,name,company,let_level,grade,cadet_rank) values
 ('00000000-0000-4000-8000-000000000001','Test One','alpha','1','9','PVT'),
 ('00000000-0000-4000-8000-000000000002','Test Two','alpha','2','10','PV2');
do $$
declare q uuid; s board_sessions; sh board_sheets; so board_sai_signoffs; p jsonb; rejected boolean;
begin
 s:=board_current_session(); q:=s.quarter_id;
 assert s.id=(board_current_session()).id,'Duplicate session';
 p:=jsonb_build_object('id','00000000-0000-4000-8000-000000000010','cadet_id','00000000-0000-4000-8000-000000000001',
 'rank_before','PVT','score_address',1,'score_facing',3,'score_creed',1,'score_uniform',9,'score_jrotc',3,'score_class',3,
 'uniform_inspection',jsonb_build_object('mode','khaki_polo','noIssuedUniform',true),'decision','promote','promote_to','PV2','status','complete');
 rejected:=false;
 begin perform board_save_sheet(p||'{"promote_to":"CPL"}'); exception when others then rejected:=position('one rank' in sqlerrm)>0; end;
 assert rejected,'Multiple-rank promotion accepted';
 rejected:=false;
 begin perform board_save_sheet(p||'{"score_jrotc":0,"score_class":0}'); exception when others then rejected:=position('board standard' in sqlerrm)>0; end;
 assert rejected,'Low score bypassed generated total check';
 rejected:=false;
 begin perform board_save_sheet(p||'{"uniform_inspection":{"mode":"khaki_polo","noIssuedUniform":false}}'); exception when others then rejected:=position('uniform' in sqlerrm)>0; end;
 assert rejected,'Alternative uniform accepted for issued uniform';
 rejected:=false;
 begin perform board_save_sheet(p||'{"leadership_position":true}'); exception when others then rejected:=position('evaluation only' in sqlerrm)>0; end;
 assert rejected,'Leadership promotion accepted';
 sh:=board_save_sheet(p); assert sh.total=20 and sh.score_uniform=9,'Wrong 20-point scoring';
 rejected:=false;
 begin perform board_save_sheet(p||'{"comment":"stale overwrite"}'); exception when others then rejected:=position('another device' in sqlerrm)>0; end;
 assert rejected,'Stale overwrite accepted';
 sh:=board_save_sheet(p||jsonb_build_object('expected_updated_at',sh.updated_at,'comment','confirmed version'));
 assert sh.comment='confirmed version';
 rejected:=false;
 begin perform board_commit_signature(s.id,'co','co.alpha@example.invalid','co.alpha@example.invalid'); exception when others then rejected:=position('1SG' in sqlerrm)>0; end;
 assert rejected,'Out-of-order signature accepted';
 s:=board_commit_signature(s.id,'1sg','1sg.alpha@example.invalid','co.alpha@example.invalid');
 rejected:=false;
 begin perform board_save_sheet(p||jsonb_build_object('expected_updated_at',sh.updated_at)); exception when others then rejected:=position('signing has started' in sqlerrm)>0; end;
 assert rejected,'Changed sheet after first signature';
 rejected:=false;
 begin perform board_discard_sheet(sh.id); exception when others then rejected:=position('signing has started' in sqlerrm)>0; end;
 assert rejected,'Deleted sheet after first signature';
 s:=board_commit_signature(s.id,'xo','xo.alpha@example.invalid','co.alpha@example.invalid');
 s:=board_commit_signature(s.id,'co','co.alpha@example.invalid','co.alpha@example.invalid');
 assert s.status='signed' and (select locked from board_sheets where id=sh.id),'Final signature did not seal';
 assert (board_commit_signature(s.id,'co','co.alpha@example.invalid','co.alpha@example.invalid')).id=s.id,'Signature retry failed';
 perform set_config('test.email','sai@example.invalid',true);
 rejected:=false;
 begin perform board_sai_review(sh.id,'promote','CPL','jump'); exception when others then rejected:=position('invalid SAI' in sqlerrm)>0; end;
 assert rejected,'SAI bypassed one-rank rule';
 perform board_sai_review(sh.id,'no_promote',null,'evaluation');
 perform board_sai_review(sh.id,null,null,null);
 -- Force a failure on the rank write to verify the entire signoff rolls back.
 execute 'alter table cadet_consent add constraint test_rank_failure check(cadet_rank <> ''PV2'') not valid';
 rejected:=false;
 begin perform board_commit_sai_signoff(q,'alpha','sai@example.invalid'); exception when check_violation then rejected:=true; end;
 assert rejected,'Failure injection did not run';
 assert not exists(select 1 from board_sai_signoffs where quarter_id=q),'Partial signoff survived rank failure';
 assert (select cadet_rank='PVT' from cadet_consent where id=sh.cadet_id),'Rank survived rollback';
 execute 'alter table cadet_consent drop constraint test_rank_failure';
 so:=board_commit_sai_signoff(q,'alpha','sai@example.invalid','Approved');
 assert so.promotions_applied=1,'Wrong promotions count';
 assert (select cadet_rank='PV2' from cadet_consent where id=sh.cadet_id),'Promotion missing';
 assert (board_commit_sai_signoff(q,'alpha','sai@example.invalid')).id=so.id,'Signoff retry duplicated record';
 rejected:=false;
 begin perform board_sai_review(sh.id,'no_promote',null,'late'); exception when others then rejected:=position('already signed off' in sqlerrm)>0; end;
 assert rejected,'Review accepted after signoff';
 assert not has_function_privilege('authenticated','board_commit_signature(uuid,text,text,text)','execute'),'Browser can forge signatures';
 assert not has_function_privilege('anon','board_commit_sai_signoff(uuid,text,text,text)','execute'),'Anonymous can apply promotions';
end $$;
rollback;
