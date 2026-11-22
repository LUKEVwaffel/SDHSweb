-- Shared per-cadet board within an already-open company practice session.
-- Apply after BOARD_MEETING.sql and BOARD_MEETING_HARDENING.sql.
begin;
alter table public.board_practice_sessions add column if not exists active_cadet_id uuid;
alter table public.board_practice_sessions add column if not exists active_cadet_revision uuid not null default gen_random_uuid();
alter table public.board_practice_sessions add column if not exists active_cadet_started_at timestamptz;
alter table public.board_practice_sessions add column if not exists active_cadet_started_by text;
alter table public.board_practice_sheets add column if not exists edit_sequence bigint not null default 0;
create table if not exists public.board_practice_cadet_events(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references board_practice_sessions(id),
 company text not null,cadet_id uuid not null,action text not null check(action in ('open','pause','complete')),
 actor text not null,created_at timestamptz not null default clock_timestamp()
);
alter table public.board_practice_cadet_events enable row level security;
revoke all on public.board_practice_cadet_events from anon,authenticated;
grant select on public.board_practice_cadet_events to authenticated;
drop policy if exists practice_cadet_events_read on public.board_practice_cadet_events;
create policy practice_cadet_events_read on public.board_practice_cadet_events for select to authenticated using(is_board_for(company) or can_view_all_boards());

create or replace function public.board_practice_clear_focus()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.status<>'running' then
   if old.active_cadet_id is not null then new.active_cadet_revision:=gen_random_uuid();end if;
   new.active_cadet_id:=null;new.active_cadet_started_at:=null;new.active_cadet_started_by:=null;
 end if;
 return new;
end $$;
drop trigger if exists practice_clear_focus on public.board_practice_sessions;
create trigger practice_clear_focus before update on public.board_practice_sessions for each row execute function public.board_practice_clear_focus();

create or replace function public.board_practice_open_cadet(p_session_id uuid,p_cadet_id uuid,p_expected_focus uuid)
returns public.board_practice_sessions language plpgsql security definer set search_path=public as $$
declare s board_practice_sessions;c jsonb;b board_practice_sheets;
begin
 select * into s from board_practice_sessions where id=p_session_id for update;
 if s.id is null or not is_board_for(s.company) then raise exception 'board: Not authorized for this company';end if;
 if s.status<>'running' then raise exception 'board: This session is closed for scoring';end if;
 select x into c from jsonb_array_elements(s.roster)x where x->>'id'=p_cadet_id::text;
 if c is null then raise exception 'board: This cadet is not in your company roster';end if;
 if s.active_cadet_id=p_cadet_id then return s;end if;
 if s.active_cadet_id is not null then raise exception 'board: Another cadet is already on the board. Finish or pause that board first.';end if;
 if s.active_cadet_revision is distinct from p_expected_focus then raise exception 'board: The board changed on another computer. Refresh and select the cadet again.';end if;
 select * into b from board_practice_sheets where session_id=s.id and cadet_id=p_cadet_id;
 if b.status='complete' then raise exception 'board: This cadet is already complete. Review the completed sheet instead.';end if;
 update board_practice_sessions set active_cadet_id=p_cadet_id,active_cadet_revision=gen_random_uuid(),active_cadet_started_at=clock_timestamp(),active_cadet_started_by=board_jwt_email() where id=s.id returning * into s;
 if b.id is null then
   perform board_practice_save(jsonb_build_object('session_id',s.id,'cadet_id',p_cadet_id,'rank_before',c->>'cadet_rank','scores','{}'::jsonb,
   'uniform_inspection','{"mode":"","noIssuedUniform":false,"missing":[],"infractions":[]}'::jsonb,'status','draft'));
 end if;
 insert into board_practice_cadet_events(session_id,company,cadet_id,action,actor)values(s.id,s.company,p_cadet_id,'open',board_jwt_email());
 return s;
end $$;

create or replace function public.board_practice_patch_field(p_session_id uuid,p_cadet_id uuid,p_focus uuid,p_field text,p_value jsonb,p_expected_value jsonb)
returns public.board_practice_sheets language plpgsql security definer set search_path=public as $$
declare s board_practice_sessions;b board_practice_sheets;payload jsonb;actual jsonb;u jsonb;item text;bucket text;
begin
 select * into s from board_practice_sessions where id=p_session_id for update;
 if s.id is null or not is_board_for(s.company) then raise exception 'board: Not authorized for this company';end if;
 if s.status<>'running' or s.active_cadet_id is distinct from p_cadet_id or s.active_cadet_revision is distinct from p_focus then raise exception 'board: The active cadet changed or this board ended. Follow the current shared board.';end if;
 select * into b from board_practice_sheets where session_id=s.id and cadet_id=p_cadet_id for update;
 if b.id is null or b.status<>'draft' then raise exception 'board: This cadet is not open for grading';end if;
 u:=jsonb_build_object('mode',coalesce(b.uniform_inspection->>'mode',''),'noIssuedUniform',coalesce((b.uniform_inspection->>'noIssuedUniform')::boolean,false),'missing',coalesce(b.uniform_inspection->'missing','[]'::jsonb),'infractions',coalesce(b.uniform_inspection->'infractions','[]'::jsonb));
 payload:=jsonb_build_object('session_id',s.id,'cadet_id',p_cadet_id,'expected_revision',b.revision,'scores',b.scores,'uniform_inspection',u,'rank_before',b.rank_before,'leadership_position',b.leadership_position,'decision',b.decision,'promote_to',b.promote_to,'comment',b.comment,'status','draft');
 if p_field in ('score_address','score_facing','score_creed','score_jrotc','score_class') then
   if jsonb_typeof(p_value) not in ('number','null') then raise exception 'board: Choose a valid score';end if;
   actual:=coalesce(b.scores->p_field,'null'::jsonb);payload:=jsonb_set(payload,array['scores',p_field],coalesce(p_value,'null'::jsonb),true);
 elsif p_field in ('rank_before','decision','promote_to','comment') then
   if jsonb_typeof(p_value)<>'string' then raise exception 'board: Invalid text field';end if;
   actual:=to_jsonb(coalesce(to_jsonb(b)->>p_field,''));payload:=jsonb_set(payload,array[p_field],p_value);
   if p_field='rank_before' then payload:=payload||'{"decision":null,"promote_to":null}';end if;
   if p_field='decision' then
     if p_value='"promote"'::jsonb then
       select payload||jsonb_build_object('promote_to',v.rank) into payload from (values('PV2'),('PFC'),('CPL'),('SGT'),('SSG'),('SFC'),('MSG'))v(rank)
       where board_rank_ladder(v.rank)=board_rank_ladder(b.rank_before)+1;
       if payload is null then raise exception 'board: No next enlisted rank is available';end if;
     else payload:=payload||'{"promote_to":null}';end if;
   end if;
 elsif p_field='leadership_position' then
   if jsonb_typeof(p_value)<>'boolean' then raise exception 'board: Invalid leadership flag';end if;
   actual:=to_jsonb(b.leadership_position);payload:=payload||jsonb_build_object('leadership_position',p_value,'decision',null,'promote_to',null);
 elsif p_field='uniform.mode' then
   if p_value not in ('""'::jsonb,'"class_a"'::jsonb,'"khaki_polo"'::jsonb) then raise exception 'board: Invalid uniform';end if;
   actual:=u->'mode';payload:=jsonb_set(payload,'{uniform_inspection,mode}',p_value);
 elsif p_field='uniform.noIssuedUniform' then
   if jsonb_typeof(p_value)<>'boolean' then raise exception 'board: Invalid uniform flag';end if;
   actual:=u->'noIssuedUniform';payload:=jsonb_set(payload,'{uniform_inspection,noIssuedUniform}',p_value);
 elsif p_field like 'uniform.missing.%' or p_field like 'uniform.infractions.%' then
   bucket:=split_part(p_field,'.',2);item:=split_part(p_field,'.',3);
   if jsonb_typeof(p_value)<>'boolean' or (bucket='missing' and item not in ('jacket','shirt','pants','shoes')) or (bucket='infractions' and item not in ('ranks','nametag','ribbons','arcs','star','crest','socks','tie','belt')) then raise exception 'board: Invalid uniform checklist item';end if;
   actual:=to_jsonb((u->bucket)?item);
   if p_value='true'::jsonb then
     if not ((u->bucket)?item) then u:=jsonb_set(u,array[bucket],(u->bucket)||jsonb_build_array(item));end if;
   else u:=jsonb_set(u,array[bucket],(u->bucket)-item);end if;
   payload:=jsonb_set(payload,'{uniform_inspection}',u);
 else raise exception 'board: This field cannot be edited';end if;
 if actual is distinct from coalesce(p_expected_value,'null'::jsonb) then
   if actual is not distinct from coalesce(p_value,'null'::jsonb) then return b;end if;
   raise exception 'board: Another leader changed this field. Review the shared value before trying again.';
 end if;
 select * into b from board_practice_save(payload);
 return b;
end $$;

create or replace function public.board_practice_finish_cadet(p_session_id uuid,p_cadet_id uuid,p_focus uuid,p_expected_revision uuid)
returns public.board_practice_sessions language plpgsql security definer set search_path=public as $$
declare s board_practice_sessions;b board_practice_sheets;
begin
 select * into s from board_practice_sessions where id=p_session_id for update;
 if s.id is null or not is_board_for(s.company) then raise exception 'board: Not authorized';end if;
 select * into b from board_practice_sheets where session_id=s.id and cadet_id=p_cadet_id for update;
 if b.status='complete' and s.active_cadet_id is distinct from p_cadet_id then return s;end if;
 if s.status<>'running' or s.active_cadet_id is distinct from p_cadet_id or s.active_cadet_revision is distinct from p_focus then raise exception 'board: This cadet is no longer on the board';end if;
 if b.id is null or b.revision is distinct from p_expected_revision then raise exception 'board: Scores changed on another screen. Review the latest shared sheet before completing.';end if;
 perform board_practice_save(jsonb_build_object('session_id',s.id,'cadet_id',p_cadet_id,'expected_revision',b.revision,'scores',b.scores,'uniform_inspection',b.uniform_inspection,'rank_before',b.rank_before,'leadership_position',b.leadership_position,'decision',b.decision,'promote_to',b.promote_to,'comment',b.comment,'status','complete'));
 update board_practice_sessions set active_cadet_id=null,active_cadet_revision=gen_random_uuid(),active_cadet_started_at=null,active_cadet_started_by=null where id=s.id returning * into s;
 insert into board_practice_cadet_events(session_id,company,cadet_id,action,actor)values(s.id,s.company,p_cadet_id,'complete',board_jwt_email());
 return s;
end $$;

create or replace function public.board_practice_pause_cadet(p_session_id uuid,p_cadet_id uuid,p_focus uuid)
returns public.board_practice_sessions language plpgsql security definer set search_path=public as $$
declare s board_practice_sessions;
begin
 select * into s from board_practice_sessions where id=p_session_id for update;
 if s.id is null or not is_board_for(s.company) then raise exception 'board: Not authorized';end if;
 if s.status<>'running' or s.active_cadet_id is distinct from p_cadet_id or s.active_cadet_revision is distinct from p_focus then raise exception 'board: This cadet is no longer on the board';end if;
 update board_practice_sessions set active_cadet_id=null,active_cadet_revision=gen_random_uuid(),active_cadet_started_at=null,active_cadet_started_by=null where id=s.id returning * into s;
 insert into board_practice_cadet_events(session_id,company,cadet_id,action,actor)values(s.id,s.company,p_cadet_id,'pause',board_jwt_email());
 return s;
end $$;
do $$declare f text;begin
 foreach f in array array['board_practice_open_cadet(uuid,uuid,uuid)','board_practice_patch_field(uuid,uuid,uuid,text,jsonb,jsonb)','board_practice_finish_cadet(uuid,uuid,uuid,uuid)','board_practice_pause_cadet(uuid,uuid,uuid)'] loop
 execute format('revoke all on function public.%s from public,anon',f);execute format('grant execute on function public.%s to authenticated',f);
 end loop;
end $$;
-- Browser writes use field-level merge and active-cadet guards. This existing
-- routine remains the transaction-internal validator, never a client bypass.
revoke all on function public.board_practice_save(jsonb) from public,anon,authenticated;

create or replace function public.board_practice_save(p jsonb)
returns public.board_practice_sheets language plpgsql security definer set search_path=public as $$
declare s board_practice_sessions; b board_practice_sheets; cadet jsonb; sc jsonb:=coalesce(p->'scores','{}');
 u int; n int; k text; max_score int; v_total int:=0; v_target text:=nullif(p->>'promote_to',''); v_let int; v_decision text:=nullif(p->>'decision','');
 v_complete boolean:=coalesce(p->>'status','draft')='complete'; v_leader boolean;
begin
 select * into s from board_practice_sessions where id=(p->>'session_id')::uuid for update;
 if s.id is null or not is_board_for(s.company) then raise exception 'board: Not authorized for this company'; end if;
 if s.status<>'running' then raise exception 'board: Session ended. Review the frozen list and sign for your position.'; end if;
 select x into cadet from jsonb_array_elements(s.roster) x where x->>'id'=p->>'cadet_id';
 if cadet is null then raise exception 'board: Cadet is not in this company session'; end if;
 v_leader:=coalesce((cadet->>'leadership_position')::boolean,false) or coalesce((p->>'leadership_position')::boolean,false);
 v_let:=board_let_int(cadet->>'let_level');
 u:=board_uniform_score(p->'uniform_inspection');
 sc:=sc||jsonb_build_object('score_uniform',u);
 foreach k in array array['score_address','score_facing','score_creed','score_uniform','score_jrotc','score_class'] loop
   max_score:=case k when 'score_address' then 1 when 'score_creed' then 1 when 'score_uniform' then 9 else 3 end;
   n:=(sc->>k)::int;
   if n is not null and (n<0 or n>max_score) then raise exception 'board: Invalid score'; end if;
   if v_complete and v_decision is distinct from 'absent' and n is null then raise exception 'board: Score all six categories and complete the uniform inspection'; end if;
   v_total:=v_total+coalesce(n,0);
 end loop;
 if v_complete and v_decision is null then raise exception 'board: Choose a decision'; end if;
 if board_rank_ladder(coalesce(nullif(p->>'rank_before',''),cadet->>'cadet_rank')) is null then raise exception 'board: Choose a valid current rank'; end if;
 if v_target is not null and v_target not in ('PV2','PFC','CPL','SGT','SSG','SFC','MSG') then raise exception 'board: Choose a valid promote-to rank'; end if;
 if v_decision='promote' and v_complete then
   if v_leader then raise exception 'board: Leadership positions are evaluation only'; end if;
   if v_let is null or v_total<board_min_score(v_let) then raise exception 'board: Does not meet the board standard'; end if;
   if v_target is null or v_target not in ('PV2','PFC','CPL','SGT','SSG','SFC','MSG') or board_rank_ladder(v_target)<>board_rank_ladder(coalesce(nullif(p->>'rank_before',''),cadet->>'cadet_rank'))+1
      or board_rank_ladder(v_target)>board_rank_ladder(board_max_rank(v_let)) then raise exception 'board: Promotions are limited to one rank within the LET maximum'; end if;
 elsif v_decision is distinct from 'promote' then v_target:=null; end if;
 select * into b from board_practice_sheets where session_id=s.id and cadet_id=(cadet->>'id')::uuid for update;
 if b.id is not null and (p->>'expected_revision')::uuid is distinct from b.revision then raise exception 'board: Another leader saved this cadet. Reload their sheet before saving.'; end if;
 if b.id is null and p->>'expected_revision' is not null then raise exception 'board: Sheet no longer exists. Reload before saving.'; end if;
 insert into board_practice_sheets(session_id,company,cadet_id,cadet_name,let_level,rank_before,scores,uniform_inspection,decision,promote_to,comment,leadership_position,status,total,updated_by)
 values(s.id,s.company,(cadet->>'id')::uuid,cadet->>'name',v_let::text,coalesce(nullif(p->>'rank_before',''),cadet->>'cadet_rank'),sc,p->'uniform_inspection',v_decision,v_target,left(coalesce(p->>'comment',''),2000),v_leader,case when v_complete then 'complete' else 'draft' end,v_total,board_jwt_email())
 on conflict(session_id,cadet_id) do update set rank_before=excluded.rank_before,scores=excluded.scores,uniform_inspection=excluded.uniform_inspection,
 decision=excluded.decision,promote_to=excluded.promote_to,comment=excluded.comment,leadership_position=excluded.leadership_position,status=excluded.status,total=excluded.total,
 edit_sequence=board_practice_sheets.edit_sequence+1,revision=gen_random_uuid(),updated_at=clock_timestamp(),updated_by=excluded.updated_by returning * into b;
 return b;
end $$;
commit;
