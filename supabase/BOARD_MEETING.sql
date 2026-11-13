-- Shared company practice + one-time leader enrollment. All practice writes
-- are isolated from board_sheets, board_sessions, and cadet_consent ranks.
begin;
alter table public.board_members add column if not exists public_id uuid not null default gen_random_uuid();
create unique index if not exists board_members_public_id_idx on public.board_members(public_id);
create table if not exists public.board_enrollment_attempts(
 email text primary key references public.board_members(email) on delete cascade,
 failures int not null default 0, locked_until timestamptz
);
create table if not exists public.board_enrollment_challenges(
 token_hash text primary key, email text not null references public.board_members(email) on delete cascade,
 expires_at timestamptz not null, consumed_at timestamptz
);
alter table public.board_enrollment_attempts enable row level security;
alter table public.board_enrollment_challenges enable row level security;
revoke all on public.board_enrollment_attempts,public.board_enrollment_challenges from anon,authenticated;

create or replace function public.board_leader_directory()
returns table(member_id uuid,display_name text,company text,board_role text,needs_setup boolean)
language sql stable security definer set search_path=public as $$
 select m.public_id,m.display_name,m.company,m.board_role,not exists(select 1 from board_credentials c where c.email=m.email)
 from board_members m where m.active and m.board_role in ('co','xo','1sg') order by m.company,m.board_role
$$;
revoke all on function public.board_leader_directory() from public;
grant execute on function public.board_leader_directory() to anon,authenticated;

-- Returns a short-lived setup proof only after a rate-limited exact DOB check.
-- Neither birthdays nor school emails are returned to the pre-auth browser.
create or replace function public.board_verify_enrollment(p_member_id uuid,p_dob date)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare m board_members; a board_enrollment_attempts; v_dob date; v_token text;
begin
 select * into m from board_members where public_id=p_member_id and active and board_role in ('co','xo','1sg') for update;
 if m.email is null then return jsonb_build_object('error','Unable to verify these details'); end if;
 if exists(select 1 from board_credentials where email=m.email) then return jsonb_build_object('error','PIN already set. Sign in with your PIN.'); end if;
 insert into board_enrollment_attempts(email) values(m.email) on conflict do nothing;
 select * into a from board_enrollment_attempts where email=m.email for update;
 if a.locked_until > now() then return jsonb_build_object('error','Too many attempts. Try again in 15 minutes.'); end if;
 if a.locked_until is not null then a.failures:=0; end if;
 select birthdate into v_dob from cadet_consent where id=m.cadet_id;
 if v_dob is null or p_dob is distinct from v_dob then
   update board_enrollment_attempts set failures=a.failures+1,locked_until=case when a.failures+1>=5 then now()+interval '15 minutes' end where email=m.email;
   return jsonb_build_object('error','Unable to verify these details. Check your date of birth or ask S-6.');
 end if;
 update board_enrollment_attempts set failures=0,locked_until=null where email=m.email;
 delete from board_enrollment_challenges where email=m.email;
 v_token:=encode(gen_random_bytes(32),'hex');
 insert into board_enrollment_challenges(token_hash,email,expires_at) values(encode(digest(v_token,'sha256'),'hex'),m.email,now()+interval '10 minutes');
 return jsonb_build_object('setup_token',v_token);
end $$;

create or replace function public.board_finish_enrollment(p_token text,p_pin_hash text)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare c board_enrollment_challenges; m board_members;
begin
 select * into c from board_enrollment_challenges where token_hash=encode(digest(p_token,'sha256'),'hex');
 if c.email is null then raise exception 'board: Setup expired. Verify your date of birth again.'; end if;
 select * into m from board_members where email=c.email and active for update;
 select * into c from board_enrollment_challenges where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
 if m.email is null or c.email is null or c.consumed_at is not null or c.expires_at<=now() then
   raise exception 'board: Setup expired. Verify your date of birth again.';
 end if;
 if exists(select 1 from board_credentials where email=m.email) then raise exception 'board: PIN already set. Sign in with your PIN.'; end if;
 if p_pin_hash is null or p_pin_hash not like 'pbkdf2$%' then raise exception 'board: Invalid PIN'; end if;
 insert into board_credentials(email,pin_hash) values(m.email,p_pin_hash);
 update board_enrollment_challenges set consumed_at=now() where token_hash=c.token_hash;
 return m.email;
end $$;
revoke all on function public.board_verify_enrollment(uuid,date),public.board_finish_enrollment(text,text) from public,anon,authenticated;
grant execute on function public.board_verify_enrollment(uuid,date),public.board_finish_enrollment(text,text) to service_role;

create table if not exists public.board_practice_rounds(
 id uuid primary key default gen_random_uuid(),title text not null,host_controlled boolean not null default true,
 status text not null default 'running' check(status in ('running','review','complete')),
 started_by text not null,started_at timestamptz not null default now(),ended_by text,ended_at timestamptz
);
create unique index if not exists board_practice_one_meeting on board_practice_rounds((true)) where host_controlled and status<>'complete';
create table if not exists public.board_practice_sessions(
 id uuid primary key default gen_random_uuid(),round_id uuid not null references board_practice_rounds(id),
 company text not null check(company in ('alpha','bravo','charlie','delta')),
 status text not null default 'running' check(status in ('running','review','signed')),
 started_at timestamptz not null default now(),ended_at timestamptz,ended_by text,
 roster jsonb not null,required_signers jsonb not null,unique(round_id,company)
);
create unique index if not exists board_practice_one_company on board_practice_sessions(company) where status<>'signed';
create table if not exists public.board_practice_sheets(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references board_practice_sessions(id),
 company text not null,cadet_id uuid not null,cadet_name text not null,let_level text,rank_before text,
 scores jsonb not null default '{}',uniform_inspection jsonb,decision text check(decision in ('promote','no_promote','absent')),
 promote_to text,comment text not null default '' check(length(comment)<=2000),leadership_position boolean not null default false,
 status text not null default 'draft' check(status in ('draft','complete')),total int not null default 0,
 simulated boolean not null default false,revision uuid not null default gen_random_uuid(),updated_by text not null,updated_at timestamptz not null default now(),
 unique(session_id,cadet_id)
);
create table if not exists public.board_practice_signatures(
 session_id uuid not null references board_practice_sessions(id),company text not null,
 seat text not null check(seat in ('co','xo','1sg')),signed_by text not null,signed_name text not null,
 signed_at timestamptz not null default now(),seal text not null,primary key(session_id,seat)
);
create table if not exists public.board_practice_presence(
 email text primary key references board_members(email),company text,display_name text not null,board_role text not null,
 last_seen timestamptz not null default now()
);
-- Upgrade existing installations as well as fresh ones.
alter table public.board_practice_sessions add column if not exists review_snapshot jsonb;
alter table public.board_practice_sessions alter column started_at set default clock_timestamp();
alter table public.board_practice_rounds alter column started_at set default clock_timestamp();
alter table public.board_practice_rounds add column if not exists cancelled_at timestamptz;
alter table public.board_practice_rounds add column if not exists cancelled_by text;
alter table public.board_practice_rounds add column if not exists cancellation_reason text;
alter table public.board_practice_rounds drop constraint if exists board_practice_rounds_status_check;
alter table public.board_practice_rounds add constraint board_practice_rounds_status_check check(status in ('running','review','complete','cancelled'));
alter table public.board_practice_sessions drop constraint if exists board_practice_sessions_status_check;
alter table public.board_practice_sessions add constraint board_practice_sessions_status_check check(status in ('running','review','signed','cancelled'));
drop index if exists public.board_practice_one_meeting;
create unique index board_practice_one_meeting on public.board_practice_rounds((true)) where host_controlled and status in ('running','review');
drop index if exists public.board_practice_one_company;
create unique index board_practice_one_company on public.board_practice_sessions(company) where status in ('running','review');

-- SELECT-only RLS. No browser can edit the frozen review list or forge a signature.
alter table board_practice_rounds enable row level security;
alter table board_practice_sessions enable row level security;
alter table board_practice_sheets enable row level security;
alter table board_practice_signatures enable row level security;
alter table board_practice_presence enable row level security;
drop policy if exists practice_rounds_read on board_practice_rounds;
create policy practice_rounds_read on board_practice_rounds for select to authenticated using(
 can_view_all_boards() or (is_board_member() and (host_controlled or exists(select 1 from board_practice_sessions s where s.round_id=board_practice_rounds.id and is_board_for(s.company))))
);
do $$ declare t text; begin
 foreach t in array array['board_practice_sessions','board_practice_sheets','board_practice_signatures','board_practice_presence'] loop
  execute format('drop policy if exists practice_company_read on public.%I',t);
  execute format('create policy practice_company_read on public.%I for select to authenticated using(public.is_board_for(company) or public.can_view_all_boards())',t);
 end loop;
end $$;
revoke all on board_practice_rounds,board_practice_sessions,board_practice_sheets,board_practice_signatures,board_practice_presence from anon,authenticated;
grant select on board_practice_rounds,board_practice_sessions,board_practice_sheets,board_practice_signatures,board_practice_presence to authenticated;

create or replace function public.board_practice_heartbeat()
returns void language plpgsql security definer set search_path=public as $$
declare m board_members;
begin
 select * into m from board_members where email=board_jwt_email() and active;
 if m.email is null then
   if not coalesce(is_s6(),false) then raise exception 'board: Board access required'; end if;
   return;
 end if;
 insert into board_practice_presence(email,company,display_name,board_role) values(m.email,m.company,m.display_name,m.board_role)
 on conflict(email) do update set last_seen=now(),company=excluded.company,display_name=excluded.display_name,board_role=excluded.board_role;
end $$;

create or replace function public.board_practice_start(p_title text default 'Leadership practice',p_company text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare r uuid; c text; v_roster jsonb; v_signers jsonb;
begin
 -- Serialize round creation even when no round exists yet.
 perform pg_advisory_xact_lock(61743822);
 if p_company is null then
   if not (coalesce(is_s6(),false) or is_board_sai()) then raise exception 'board: Only the presenter can start a meeting'; end if;
 else
   if not (is_board_for(p_company) or coalesce(is_s6(),false)) then raise exception 'board: Not authorized for this company'; end if;
   if p_company not in ('alpha','bravo','charlie','delta') then raise exception 'board: Invalid company'; end if;
 end if;
 if p_company is not null and exists(select 1 from board_practice_rounds where host_controlled and status in ('running','review')) then raise exception 'board: Finish the presenter-controlled workshop before starting independent company practice'; end if;
 if exists(select 1 from board_practice_sessions where status in ('running','review') and (p_company is null or company=p_company)) then
   raise exception 'board: Finish the current review and all three signatures before starting another session';
 end if;
 insert into board_practice_rounds(title,started_by,host_controlled) values(left(coalesce(nullif(trim(p_title),''),'Leadership practice'),120),board_jwt_email(),p_company is null) returning id into r;
 foreach c in array case when p_company is null then array['alpha','bravo','charlie','delta'] else array[p_company] end loop
   select jsonb_agg(jsonb_build_object('email',email,'name',display_name,'seat',board_role) order by board_role) into v_signers
    from board_members where active and company=c and board_role in ('co','xo','1sg');
   if coalesce(jsonb_array_length(v_signers),0)<>3 then raise exception 'board: Set up all three leadership seats for % first',c; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',cc.id,'name',cc.name,'company',cc.company,'let_level',board_let_int(cc.let_level),'grade',cc.grade,
    'cadet_rank',coalesce(cc.cadet_rank,'PVT'),'leadership_position',exists(select 1 from personnel p where p.cadet_consent_id=cc.id)) order by cc.name),'[]'::jsonb)
    into v_roster from cadet_consent cc where cc.company=c and not exists(select 1 from board_members m where m.active and m.cadet_id=cc.id and m.board_role in ('co','xo','1sg'));
   if jsonb_array_length(v_roster)=0 then raise exception 'board: No cadets found for %',c; end if;
   insert into board_practice_sessions(round_id,company,roster,required_signers) values(r,c,v_roster,v_signers);
 end loop;
 return r;
end $$;

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
 revision=gen_random_uuid(),updated_at=now(),updated_by=excluded.updated_by returning * into b;
 return b;
end $$;

create or replace function public.board_practice_discard(p_id uuid,p_revision uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s board_practice_sessions; b board_practice_sheets;
begin
 select * into s from board_practice_sessions where id=(select session_id from board_practice_sheets where id=p_id) for update;
 if s.id is null or not is_board_for(s.company) then raise exception 'board: Not authorized'; end if;
 if s.status<>'running' then raise exception 'board: Session ended. The review list is frozen.'; end if;
 select * into b from board_practice_sheets where id=p_id for update;
 if b.id is null or b.revision is distinct from p_revision then raise exception 'board: This sheet changed. Reload before discarding.'; end if;
 delete from board_practice_sheets where id=b.id;
end $$;

create or replace function public.board_practice_end(p_round_id uuid,p_session_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare r board_practice_rounds; s board_practice_sessions; c jsonb; v_let int; target text; i int; v_total int; v_scores jsonb; v_uniform jsonb; v_extra jsonb; v_review jsonb;
begin
 select * into r from board_practice_rounds where id=p_round_id for update;
 if r.id is null then raise exception 'board: Session not found'; end if;
 if r.status='cancelled' then raise exception 'board: This practice round was cancelled'; end if;
 if r.host_controlled or p_session_id is null then
   if not (coalesce(is_s6(),false) or is_board_sai()) then raise exception 'board: The presenter controls this meeting'; end if;
 else
   if not exists(select 1 from board_practice_sessions where id=p_session_id and round_id=r.id and is_board_for(company)) then raise exception 'board: Not authorized'; end if;
 end if;
 if r.host_controlled then p_session_id:=null; end if;
 for s in select * from board_practice_sessions where round_id=r.id and (p_session_id is null or id=p_session_id) order by id for update loop
   if s.status<>'running' then continue; end if;
   v_extra:='[]'::jsonb;
   -- A presenter-ended meeting produces sample results using only this company's
   -- snapshotted names. Saved practice work is preserved and clearly distinguished.
   if r.host_controlled then
     i:=0;
     for c in select x from jsonb_array_elements(s.roster) x order by x->>'name' limit 6 loop
       i:=i+1;
       v_let:=board_let_int(c->>'let_level');
       v_scores:='{"score_address":1,"score_facing":3,"score_creed":1,"score_uniform":9,"score_jrotc":3,"score_class":3}'::jsonb;
       v_uniform:='{"mode":"class_a","missing":[],"infractions":[]}'::jsonb;
       v_total:=20;
       if i=2 then v_total:=17;v_scores:=v_scores||'{"score_uniform":6}';v_uniform:=v_uniform||'{"infractions":["tie","ranks"]}';
       elsif i=3 then v_total:=14;v_scores:=v_scores||'{"score_uniform":3}';v_uniform:=v_uniform||'{"infractions":["tie","belt","ranks","nametag"]}';
       elsif i=4 then v_total:=0;v_scores:='{}';v_uniform:=null;
       elsif i=5 then v_total:=19;v_scores:=v_scores||'{"score_address":0}';
       elsif i=6 then v_total:=16;v_scores:=v_scores||'{"score_uniform":5}';v_uniform:=v_uniform||'{"infractions":["tie","belt"]}';end if;
       select v.rank into target from (values('PV2'),('PFC'),('CPL'),('SGT'),('SSG'),('SFC'),('MSG')) v(rank)
        where board_rank_ladder(v.rank)=board_rank_ladder(c->>'cadet_rank')+1 and board_rank_ladder(v.rank)<=board_rank_ladder(board_max_rank(v_let))
          and not coalesce((c->>'leadership_position')::boolean,false) and v_total>=board_min_score(v_let);
       insert into board_practice_sheets(session_id,company,cadet_id,cadet_name,let_level,rank_before,scores,uniform_inspection,decision,promote_to,comment,status,total,simulated,updated_by)
       values(s.id,s.company,(c->>'id')::uuid,c->>'name',v_let::text,c->>'cadet_rank',
        v_scores,v_uniform,case when i=4 then 'absent' when target is null then 'no_promote' else 'promote' end,target,
        'Simulated result for leadership meeting. No real promotion.', 'complete',v_total,true,board_jwt_email()) on conflict(session_id,cadet_id) do nothing;
       -- Keep unfinished saved work intact, but put a separate completed example
       -- into the frozen review instead of asking leaders to sign a draft.
       if exists(select 1 from board_practice_sheets where session_id=s.id and cadet_id=(c->>'id')::uuid and status='draft') then
         v_extra:=v_extra||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'session_id',s.id,'company',s.company,'cadet_id',c->>'id','cadet_name',c->>'name','let_level',v_let,'rank_before',c->>'cadet_rank','scores',v_scores,'uniform_inspection',v_uniform,'decision',case when i=4 then 'absent' when target is null then 'no_promote' else 'promote' end,'promote_to',target,'comment','Simulated result for leadership meeting. Original unfinished practice is retained separately.','status','complete','total',v_total,'simulated',true));
       end if;
     end loop;
   elsif not exists(select 1 from board_practice_sheets where session_id=s.id) or exists(select 1 from board_practice_sheets where session_id=s.id and status<>'complete') then
     raise exception 'board: Complete or remove all drafts before ending the session';
   end if;
   select coalesce(jsonb_agg(to_jsonb(b) order by b.cadet_name,b.id),'[]'::jsonb)||v_extra into v_review from board_practice_sheets b where session_id=s.id and status='complete';
   select coalesce(jsonb_agg(x order by x->>'cadet_name',x->>'id'),'[]'::jsonb) into v_review from jsonb_array_elements(v_review) x;
   if jsonb_array_length(v_review)=0 then raise exception 'board: No completed results to review'; end if;
   update board_practice_sessions set review_snapshot=v_review,status='review',ended_at=now(),ended_by=board_jwt_email() where id=s.id;
 end loop;
 update board_practice_rounds set status='review',ended_at=coalesce(ended_at,now()),ended_by=coalesce(ended_by,board_jwt_email()) where id=r.id and status='running';
end $$;

-- This function is service-only: the edge endpoint verifies THIS caller's PIN.
create or replace function public.board_practice_commit_signature(p_session_id uuid,p_email text)
returns public.board_practice_signatures language plpgsql security definer set search_path=public,extensions as $$
declare s board_practice_sessions; m board_members; result board_practice_signatures; v_seal text; v_round uuid;
begin
 select round_id into v_round from board_practice_sessions where id=p_session_id;
 perform 1 from board_practice_rounds where id=v_round for update;
 select * into s from board_practice_sessions where id=p_session_id for update;
 select * into m from board_members where email=p_email and active and company=s.company and board_role in ('co','xo','1sg') for share;
 if s.id is null or m.email is null then raise exception 'board: Not authorized for this company'; end if;
 if not exists(select 1 from jsonb_array_elements(s.required_signers) x where x->>'email'=m.email and x->>'seat'=m.board_role) then raise exception 'board: Leadership assignment changed. Ask the presenter.'; end if;
 select * into result from board_practice_signatures where session_id=s.id and seat=m.board_role;
 if result.session_id is not null then return result; end if;
 if s.status<>'review' then raise exception 'board: End the session before signing'; end if;
 if s.review_snapshot is not null then
   v_seal:=encode(digest(s.review_snapshot::text,'sha256'),'hex');
 else
   -- Preserve seals for any session ended before this upgrade.
   select encode(digest(coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]'::jsonb)::text,'sha256'),'hex') into v_seal from board_practice_sheets b where session_id=s.id;
 end if;
 insert into board_practice_signatures(session_id,company,seat,signed_by,signed_name,seal) values(s.id,s.company,m.board_role,m.email,m.display_name,v_seal) returning * into result;
 if (select count(*) from board_practice_signatures where session_id=s.id)=3 then
   update board_practice_sessions set status='signed' where id=s.id;
   if not exists(select 1 from board_practice_sessions where round_id=s.round_id and status<>'signed') then update board_practice_rounds set status='complete' where id=s.round_id; end if;
 end if;
 return result;
end $$;
revoke all on function public.board_practice_commit_signature(uuid,text) from public,anon,authenticated;
grant execute on function public.board_practice_commit_signature(uuid,text) to service_role;
do $$ declare f text; begin
 foreach f in array array['board_practice_heartbeat()','board_practice_start(text,text)','board_practice_save(jsonb)','board_practice_discard(uuid,uuid)','board_practice_end(uuid,uuid)'] loop
   execute format('revoke all on function public.%s from public,anon',f);
   execute format('grant execute on function public.%s to authenticated',f);
 end loop;
end $$;
-- Explicit presenter recovery never fabricates a missing leader's signature.
create or replace function public.board_practice_cancel(p_round_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare r board_practice_rounds;
begin
 if not (coalesce(is_s6(),false) or is_board_sai()) then raise exception 'board: Presenter access required'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'board: Enter a short reason for cancelling this practice round'; end if;
 select * into r from board_practice_rounds where id=p_round_id for update;
 if r.id is null then raise exception 'board: Round not found'; end if;
 if r.status='cancelled' then return; end if;
 if r.status='complete' then raise exception 'board: This round is already complete'; end if;
 perform 1 from board_practice_sessions where round_id=r.id order by id for update;
 update board_practice_sessions set status='cancelled',ended_at=coalesce(ended_at,now()),ended_by=coalesce(ended_by,board_jwt_email()) where round_id=r.id and status in ('running','review');
 update board_practice_rounds set status='cancelled',cancelled_at=now(),cancelled_by=board_jwt_email(),cancellation_reason=left(trim(p_reason),500) where id=r.id;
end $$;
revoke all on function public.board_practice_cancel(uuid,text) from public,anon;
grant execute on function public.board_practice_cancel(uuid,text) to authenticated;

-- One RLS-governed statement gives every screen a coherent snapshot. This also
-- avoids row-limit truncation of a long session history and six requests per poll.
create table if not exists public.board_practice_account_resets(
 id uuid primary key default gen_random_uuid(),email text not null,requested_by text not null,created_at timestamptz not null default now()
);
alter table public.board_practice_account_resets enable row level security;
revoke all on public.board_practice_account_resets from anon,authenticated;
grant select on public.board_practice_account_resets to authenticated;
drop policy if exists board_account_resets_read on public.board_practice_account_resets;
create policy board_account_resets_read on public.board_practice_account_resets for select to authenticated using(coalesce(is_s6(),false) or is_board_sai());
create or replace function public.board_practice_account_status()
returns table(member_id uuid,display_name text,company text,board_role text,has_dob boolean,has_pin boolean,pin_locked_until timestamptz,dob_locked_until timestamptz)
language sql stable security definer set search_path=public as $$
 select m.public_id,m.display_name,m.company,m.board_role,c.birthdate is not null,bc.email is not null,bc.pin_locked_until,a.locked_until
 from board_members m left join cadet_consent c on c.id=m.cadet_id left join board_credentials bc on bc.email=m.email left join board_enrollment_attempts a on a.email=m.email
 where m.active and m.board_role in ('co','xo','1sg') and (coalesce(is_s6(),false) or is_board_sai()) order by m.company,m.board_role
$$;
create or replace function public.board_practice_unlock_member(p_member_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare m board_members;
begin
 if not (coalesce(is_s6(),false) or is_board_sai()) then raise exception 'board: Presenter access required'; end if;
 select * into m from board_members where public_id=p_member_id and active and board_role in ('co','xo','1sg') for update;
 if m.email is null then raise exception 'board: Leader not found'; end if;
 update board_enrollment_attempts set failures=0,locked_until=null where email=m.email;
 update board_credentials set pin_fail_count=0,pin_locked_until=null,updated_at=now() where email=m.email;
 insert into board_practice_account_resets(email,requested_by) values(m.email,board_jwt_email());
end $$;
revoke all on function public.board_practice_account_status(),public.board_practice_unlock_member(uuid) from public,anon;
grant execute on function public.board_practice_account_status(),public.board_practice_unlock_member(uuid) to authenticated;

create or replace function public.board_practice_state()
returns jsonb language sql stable security invoker set search_path=public as $$
 with latest as (select distinct on(company) * from board_practice_sessions order by company,started_at desc,id desc),
 chosen as (select * from latest union select * from board_practice_sessions where status in ('running','review'))
 select jsonb_build_object(
 'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by started_at desc,id desc) from chosen s),'[]'::jsonb),
 'rounds',coalesce((select jsonb_agg(to_jsonb(r) order by started_at desc,id desc) from board_practice_rounds r where id in(select round_id from chosen)),'[]'::jsonb),
 'sheets',coalesce((select jsonb_agg(to_jsonb(b) order by cadet_name,id) from board_practice_sheets b where session_id in(select id from chosen)),'[]'::jsonb),
 'signatures',coalesce((select jsonb_agg(to_jsonb(s)) from board_practice_signatures s where session_id in(select id from chosen)),'[]'::jsonb),
 'presence',coalesce((select jsonb_agg(to_jsonb(p)) from board_practice_presence p),'[]'::jsonb),
 'account_status',coalesce((select jsonb_agg(to_jsonb(a)) from board_practice_account_status() a),'[]'::jsonb),
 'identity',coalesce((select jsonb_agg(to_jsonb(i)) from board_whoami() i),'[]'::jsonb),
 'directory',coalesce((select jsonb_agg(to_jsonb(d)) from board_leader_directory() d),'[]'::jsonb)
 )
$$;
revoke all on function public.board_practice_state() from public,anon;
grant execute on function public.board_practice_state() to authenticated;

-- Live notifications, with bounded polling as a reconnect fallback in the UI.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['board_practice_rounds','board_practice_sessions','board_practice_sheets','board_practice_signatures','board_practice_presence'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
 end if;
end $$;
commit;
