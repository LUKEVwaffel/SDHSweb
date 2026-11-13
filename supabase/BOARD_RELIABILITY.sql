-- Apply AFTER company_boards.sql. Safe to reapply; no roster/account seeds.
-- Database transactions serialize work on the quarter row before locking sheets.
-- Confirmed 2026-11-13: 20 points, one-rank promotions, khaki/polo only if no issued uniform.
begin;

-- Refuse an implicit conversion of any historical 15-point records.
-- There are no live sheets as of preparation; reruns after v2 deployment are safe.
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='board_sheets' and column_name='score_address')
     and exists(select 1 from public.board_sheets) then
    raise exception 'board: legacy sheets need an explicit migration before switching scoring';
  end if;
end $$;
alter table public.board_sheets add column if not exists score_address smallint check(score_address between 0 and 1);
alter table public.board_sheets add column if not exists uniform_inspection jsonb;
alter table public.board_sheets add column if not exists leadership_position boolean not null default false;
alter table public.board_sheets drop constraint if exists board_sheets_score_creed_check;
alter table public.board_sheets add constraint board_sheets_score_creed_check check(score_creed between 0 and 1);
alter table public.board_sheets drop constraint if exists board_sheets_score_uniform_check;
alter table public.board_sheets add constraint board_sheets_score_uniform_check check(score_uniform between 0 and 9);
drop view public.board_results;
alter table public.board_sheets drop column total;
alter table public.board_sheets add column total smallint generated always as (
 coalesce(score_address,0)+coalesce(score_facing,0)+coalesce(score_creed,0)+coalesce(score_uniform,0)+coalesce(score_jrotc,0)+coalesce(score_class,0)) stored;
create or replace function public.board_min_score(p_let int)
returns int language sql immutable as $$ select case when p_let=1 then 16 when p_let between 2 and 4 then 17 end $$;

create or replace function public.board_uniform_score(p jsonb)
returns int language plpgsql immutable as $$
declare deductions int;
begin
 if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
 if p->>'mode' = 'khaki_polo' then
   if p->'noIssuedUniform' = 'true'::jsonb then return 9; end if;
   return null;
 end if;
 if p->>'mode' <> 'class_a' or p->>'mode' is null then return null; end if;
 if jsonb_typeof(p->'missing') is distinct from 'array' or jsonb_typeof(p->'infractions') is distinct from 'array' then return null; end if;
 if exists(select 1 from jsonb_array_elements_text(p->'missing') x where x not in ('jacket','shirt','pants','shoes'))
    or exists(select 1 from jsonb_array_elements_text(p->'infractions') x where x not in ('ranks','nametag','ribbons','arcs','star','crest','socks','tie','belt')) then
   raise exception 'board: unknown uniform checklist item';
 end if;
 if jsonb_array_length(p->'missing') > 0 then return 0; end if;
 select coalesce(sum(points),0) into deductions from (values
 ('ranks',1),('nametag',1),('ribbons',1),('arcs',1),('star',1),('crest',1),('socks',1),('tie',2),('belt',2)) v(key,points)
 where p->'infractions' ? key;
 return greatest(0,9-deductions);
end $$;
-- Staff supply the final question bank. No invented or placeholder questions.
create table if not exists public.board_questions(
 id uuid primary key default gen_random_uuid(), let_level smallint not null check(let_level between 1 and 4),
 category text not null check(category in ('jrotc','class')), question text not null check(length(trim(question)) between 1 and 2000),
 answer text not null check(length(trim(answer)) between 1 and 4000), active boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.board_questions enable row level security;
drop policy if exists board_questions_read on public.board_questions;
create policy board_questions_read on public.board_questions for select to authenticated
 using(public.is_board_member() or public.can_view_all_boards());
revoke all on public.board_questions from anon,authenticated;
grant select on public.board_questions to authenticated;
create or replace function public.board_save_question(p jsonb)
returns public.board_questions language plpgsql security definer set search_path=public as $$
declare result public.board_questions;
begin
 if not coalesce(public.is_s6(),false) then raise exception 'board: S-6 only'; end if;
 insert into public.board_questions(id,let_level,category,question,answer,active)
 values(coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()),(p->>'let_level')::smallint,p->>'category',trim(p->>'question'),trim(p->>'answer'),coalesce((p->>'active')::boolean,true))
 on conflict(id) do update set let_level=excluded.let_level,category=excluded.category,question=excluded.question,answer=excluded.answer,active=excluded.active,updated_at=now()
 returning * into result;
 return result;
end $$;
revoke all on function public.board_save_question(jsonb) from public,anon;
grant execute on function public.board_save_question(jsonb) to authenticated;
alter table public.board_sheets add column if not exists question_snapshot jsonb;

create or replace function public.board_validate_sheet()
returns trigger language plpgsql as $$
declare
  v_let int := public.board_let_int(new.let_level);
  v_all boolean := new.score_address is not null and new.score_facing is not null and new.score_creed is not null
               and new.score_uniform is not null and new.score_jrotc is not null
               and new.score_class is not null;
  v_from int := coalesce(public.board_rank_ladder(new.rank_before), 0);
  v_to   int;
begin
  if tg_op='INSERT' or (old.status='draft' and new.status='complete') then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'question',question,'answer',answer) order by category,id),'[]'::jsonb)
      into new.question_snapshot from public.board_questions where let_level=v_let and active;
  end if;
  if new.status='complete' and new.decision is distinct from 'absent' and (
    (select count(*) from jsonb_array_elements(new.question_snapshot) x where x->>'category'='jrotc') < 3 or
    (select count(*) from jsonb_array_elements(new.question_snapshot) x where x->>'category'='class') < 3) then
    raise exception 'board: this LET level needs at least three JROTC and three class questions before boards';
  end if;
  if new.decision is distinct from 'absent' and new.status = 'complete' and public.board_uniform_score(new.uniform_inspection) is null then
    raise exception 'board: complete the uniform inspection; khakis/polo requires no issued uniform';
  end if;
  new.score_uniform := public.board_uniform_score(new.uniform_inspection);
  if new.promote_to is not null and new.decision is distinct from 'promote' then
    new.promote_to := null;
  end if;

  if new.status = 'complete' then
    if new.decision is null then raise exception 'board: a decision is required'; end if;
    if new.decision <> 'absent' and not v_all then raise exception 'board: all six categories must be scored'; end if;
    if new.decision <> 'absent' and new.rank_before is null then raise exception 'board: current rank is required'; end if;
  end if;

  if (new.decision = 'promote' or new.sai_decision = 'promote') and new.leadership_position then raise exception 'board: leadership positions are evaluation only'; end if;
  if new.decision = 'promote' then
    if v_let is null then raise exception 'board: LET level missing'; end if;
    if not v_all then raise exception 'board: cannot promote an incomplete sheet'; end if;
    if (coalesce(new.score_address,0) + coalesce(new.score_facing,0) + coalesce(new.score_creed,0) + coalesce(new.score_uniform,0) + coalesce(new.score_jrotc,0) + coalesce(new.score_class,0)) < public.board_min_score(v_let) then raise exception 'board: does not meet the board standard'; end if;
    v_to := public.board_rank_ladder(new.promote_to);
    if new.promote_to not in ('PV2','PFC','CPL','SGT','SSG','SFC','MSG') or v_to is null then
      raise exception 'board: invalid promote-to rank';
    end if;
    if v_to <> v_from + 1 then raise exception 'board: promotions are limited to one rank'; end if;
    if v_to > public.board_rank_ladder(public.board_max_rank(v_let)) then
      raise exception 'board: promote-to exceeds the LET % maximum', v_let;
    end if;
  end if;

  -- SAI overturn to promote must obey the same cap (min score is the SAI's call).
  if new.sai_decision = 'promote' then
    v_to := public.board_rank_ladder(new.sai_promote_to);
    if new.sai_promote_to not in ('PV2','PFC','CPL','SGT','SSG','SFC','MSG') or v_to is null
       or v_to <> v_from + 1 or v_let is null
       or v_to > public.board_rank_ladder(public.board_max_rank(v_let)) then
      raise exception 'board: invalid SAI promote-to rank';
    end if;
  elsif new.sai_decision is not null then
    new.sai_promote_to := null;
  end if;

  new.updated_at := now();
  return new;
end $$;

create or replace function public.board_current_session()
returns public.board_sessions language plpgsql security definer set search_path = public as $$
declare
  v_company text := public.board_my_company();
  v_q uuid;
  v_s public.board_sessions;
begin
  if v_company is null then raise exception 'board: not a company board member'; end if;
  select id into v_q from public.board_quarters where status = 'open' for update;
  if v_q is null then raise exception 'board: no board quarter is open'; end if;
  if exists (select 1 from public.board_sai_signoffs where quarter_id = v_q and company = v_company) then
    raise exception 'board: company already signed off';
  end if;
  select * into v_s from public.board_sessions where quarter_id = v_q and company = v_company and status = 'open';
  if v_s.id is null then
    if exists (select 1 from public.board_sai_signoffs where quarter_id = v_q and company = v_company) then
      raise exception 'board: the SAI already signed off this company for the quarter';
    end if;
    insert into public.board_sessions (quarter_id, company, opened_by)
      values (v_q, v_company, public.board_jwt_email()) returning * into v_s;
  end if;
  return v_s;
end $$;

create or replace function public.board_save_sheet(p jsonb)
returns public.board_sheets language plpgsql security definer set search_path = public as $$
declare
  v_s     public.board_sessions := public.board_current_session();
  v_cadet public.cadet_consent;
  v_row   public.board_sheets;
  v_id    uuid := nullif(p->>'id','')::uuid;
  v_status text := coalesce(p->>'status','draft');
  v_rank  text := nullif(p->>'rank_before','');
  v_revision timestamptz := nullif(p->>'expected_updated_at','')::timestamptz;
begin
  if v_s.sig_1sg_at is not null then raise exception 'board: signing has started; sheets cannot be changed'; end if;
  select * into v_cadet from public.cadet_consent where id = (p->>'cadet_id')::uuid;
  if v_cadet.id is null or v_cadet.company <> v_s.company then raise exception 'board: cadet is not in your company'; end if;
  if exists (select 1 from public.board_members m where m.cadet_id = v_cadet.id and m.active
               and m.company = v_cadet.company and m.board_role in ('co','xo','1sg')) then
    raise exception 'board: board members are not boarded';
  end if;
  if v_status not in ('draft','complete') then raise exception 'board: bad status'; end if;

  -- A rank entered on the sheet also updates the roster (same as RANKS tab).
  if v_rank is not null and v_rank is distinct from v_cadet.cadet_rank then
    perform public.board_set_rank(v_cadet.id, v_rank);
  end if;

  if v_id is not null then
    select * into v_row from public.board_sheets where id = v_id for update;
  end if;
  if v_row.id is not null then
    if v_row.id is null or v_row.session_id <> v_s.id then raise exception 'board: sheet is not in your open session'; end if;
    if v_row.locked then raise exception 'board: sheet is signed and locked'; end if;
    if v_revision is null or v_revision is distinct from v_row.updated_at then
      raise exception 'board: this sheet changed on another device; reload before saving';
    end if;
    update public.board_sheets set
      rank_before   = coalesce(v_rank, rank_before),
      score_address = (p->>'score_address')::smallint,
      uniform_inspection = p->'uniform_inspection',
      leadership_position = coalesce((p->>'leadership_position')::boolean,false) or exists(select 1 from public.personnel where cadet_consent_id=v_cadet.id),
      score_facing  = (p->>'score_facing')::smallint,
      score_creed   = (p->>'score_creed')::smallint,
      score_uniform = (p->>'score_uniform')::smallint,
      score_jrotc   = (p->>'score_jrotc')::smallint,
      score_class   = (p->>'score_class')::smallint,
      decision      = nullif(p->>'decision',''),
      promote_to    = nullif(p->>'promote_to',''),
      comment       = nullif(trim(coalesce(p->>'comment','')),''),
      status        = v_status,
      completed_at  = case when v_status = 'complete' then coalesce(completed_at, now()) else null end,
      updated_by    = public.board_jwt_email()
    where id = v_id returning * into v_row;
  else
    if v_revision is not null then raise exception 'board: this sheet was removed; reload before saving'; end if;
    insert into public.board_sheets (
      id, quarter_id, session_id, cadet_id, cadet_name, company, let_level, grade, rank_before,
      score_address, uniform_inspection, leadership_position, score_facing, score_creed, score_uniform, score_jrotc, score_class,
      decision, promote_to, comment, status, completed_at, created_by, updated_by)
    values (
      coalesce(v_id, gen_random_uuid()), v_s.quarter_id, v_s.id, v_cadet.id, v_cadet.name, v_cadet.company,
      public.board_let_int(v_cadet.let_level)::text, v_cadet.grade, coalesce(v_rank, v_cadet.cadet_rank),
      (p->>'score_address')::smallint, p->'uniform_inspection', coalesce((p->>'leadership_position')::boolean,false) or exists(select 1 from public.personnel where cadet_consent_id=v_cadet.id),
      (p->>'score_facing')::smallint, (p->>'score_creed')::smallint, (p->>'score_uniform')::smallint,
      (p->>'score_jrotc')::smallint, (p->>'score_class')::smallint,
      nullif(p->>'decision',''), nullif(p->>'promote_to',''), nullif(trim(coalesce(p->>'comment','')),''),
      v_status, case when v_status = 'complete' then now() end,
      public.board_jwt_email(), public.board_jwt_email())
    returning * into v_row;
  end if;
  return v_row;
end $$;

create or replace function public.board_discard_sheet(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.board_sheets;
begin
  perform 1 from public.board_quarters where id = (select quarter_id from public.board_sheets where id = p_id) for update;
  select * into v_row from public.board_sheets where id = p_id;
  if v_row.id is null or not public.is_board_for(v_row.company) then raise exception 'board: not authorized'; end if;
  if v_row.locked then raise exception 'board: sheet is signed and locked'; end if;
  if exists (select 1 from public.board_sessions where id = v_row.session_id and sig_1sg_at is not null) then
    raise exception 'board: signing has started; sheets cannot be changed';
  end if;
  delete from public.board_sheets where id = p_id;
end $$;

create or replace function public.board_sai_review(p_id uuid, p_decision text, p_promote_to text, p_note text)
returns public.board_sheets language plpgsql security definer set search_path = public as $$
declare v_row public.board_sheets;
begin
  if not public.is_board_sai() then raise exception 'board: SAI only'; end if;
  perform 1 from public.board_quarters where id = (select quarter_id from public.board_sheets where id = p_id) for update;
  select * into v_row from public.board_sheets where id = p_id for update;
  if v_row.id is null then raise exception 'board: no such sheet'; end if;
  if not v_row.locked then raise exception 'board: the company board has not signed this sheet yet'; end if;
  if exists (select 1 from public.board_sai_signoffs where quarter_id = v_row.quarter_id and company = v_row.company) then
    raise exception 'board: company already signed off';
  end if;
  if p_decision is null then
    update public.board_sheets set sai_action = null, sai_decision = null, sai_promote_to = null,
           sai_note = null, sai_by = null, sai_at = null where id = p_id returning * into v_row;
  else
    if p_decision not in ('promote','no_promote') then raise exception 'board: bad decision'; end if;
    if v_row.decision = 'absent' then raise exception 'board: cannot overturn an absence'; end if;
    update public.board_sheets set sai_action = 'overturn', sai_decision = p_decision,
           sai_promote_to = case when p_decision = 'promote' then p_promote_to end,
           sai_note = nullif(trim(coalesce(p_note,'')),''), sai_by = public.board_jwt_email(), sai_at = now()
     where id = p_id returning * into v_row;
  end if;
  return v_row;
end $$;

-- Shared payload for reproducible signatures. Review fields belong to the SAI seal.
create or replace function public.board_sheet_payload(s public.board_sheets)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'id',s.id,'quarter_id',s.quarter_id,'cadet_id',s.cadet_id,'cadet_name',s.cadet_name,
    'company',s.company,'let_level',s.let_level,'grade',s.grade,'rank_before',s.rank_before,
    'question_snapshot',s.question_snapshot,'score_address',s.score_address,'uniform_inspection',s.uniform_inspection,'leadership_position',s.leadership_position,'score_facing',s.score_facing,'score_creed',s.score_creed,'score_uniform',s.score_uniform,
    'score_jrotc',s.score_jrotc,'score_class',s.score_class,'total',s.total,
    'decision',s.decision,'promote_to',s.promote_to,'comment',s.comment)
$$;

-- Defense in depth for all writers, including service-role code.
create or replace function public.board_guard_sheet_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_session public.board_sessions; v_quarter uuid; v_company text;
begin
  if tg_op = 'INSERT' then v_quarter := new.quarter_id; v_company := new.company;
  else v_quarter := old.quarter_id; v_company := old.company; end if;
  perform 1 from public.board_quarters where id = v_quarter for update;
  if exists (select 1 from public.board_sai_signoffs where quarter_id = v_quarter and company = v_company) then
    raise exception 'board: company already signed off';
  end if;
  if tg_op = 'INSERT' then
    select * into v_session from public.board_sessions where id = new.session_id;
  else
    select * into v_session from public.board_sessions where id = old.session_id;
  end if;
  if tg_op = 'UPDATE' then
    if (new.id,new.session_id,new.quarter_id,new.company,new.cadet_id) is distinct from
       (old.id,old.session_id,old.quarter_id,old.company,old.cadet_id) then
      raise exception 'board: sheet identity cannot be changed';
    end if;
    -- Signing can set locked/seal; SAI can change only review metadata afterwards.
    if v_session.sig_1sg_at is not null and public.board_sheet_payload(new) - 'total'
       is distinct from public.board_sheet_payload(old) - 'total' then
      raise exception 'board: signing has started; sheets cannot be changed';
    end if;
  elsif v_session.sig_1sg_at is not null or v_session.status <> 'open' then
    raise exception 'board: signing has started; sheets cannot be changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if (new.quarter_id,new.company) is distinct from (v_session.quarter_id,v_session.company) then
    raise exception 'board: sheet does not match its session';
  end if;
  return new;
end $$;
drop trigger if exists board_sheets_guard on public.board_sheets;
create trigger board_sheets_guard before insert or update or delete on public.board_sheets
for each row execute function public.board_guard_sheet_mutation();

-- Called only by the edge function AFTER it verifies the holder's PIN.
create or replace function public.board_commit_signature(p_session_id uuid, p_seat text, p_holder text, p_laptop text)
returns public.board_sessions language plpgsql security definer set search_path = public, extensions as $$
declare s public.board_sessions; h public.board_members; v_seal text; v_prior text;
begin
  if p_seat is null or p_seat not in ('1sg','xo','co') then raise exception 'board: bad seat'; end if;
  perform 1 from public.board_quarters where id = (select quarter_id from public.board_sessions where id = p_session_id) for update;
  select * into s from public.board_sessions where id = p_session_id for update;
  if s.id is null then raise exception 'board: session not found'; end if;
  if not exists (select 1 from public.board_quarters where id = s.quarter_id and status = 'open') then
    raise exception 'board: quarter is closed';
  end if;
  if not exists (select 1 from public.board_members where email = p_laptop and active and company = s.company and board_role in ('1sg','xo','co')) then
    raise exception 'board: not a company board member';
  end if;
  select * into h from public.board_members where email = p_holder and active and company = s.company and board_role = p_seat for share;
  if h.email is null then raise exception 'board: seat holder changed; reload before signing'; end if;
  if exists (select 1 from public.board_sai_signoffs where quarter_id = s.quarter_id and company = s.company) then
    raise exception 'board: company already signed off';
  end if;
  -- A retry after a lost response is harmless and returns the recorded signature.
  if to_jsonb(s)->>('sig_'||p_seat||'_email') = h.email then return s; end if;
  if s.status <> 'open' then raise exception 'board: session already signed'; end if;
  if to_jsonb(s)->>('sig_'||p_seat||'_at') is not null then raise exception 'board: already signed'; end if;
  if p_seat in ('xo','co') and s.sig_1sg_at is null then raise exception 'board: 1SG must sign first'; end if;
  if p_seat = 'co' and s.sig_xo_at is null then raise exception 'board: XO must sign first'; end if;
  if not exists (select 1 from public.board_sheets where session_id = s.id) then raise exception 'board: no completed sheets to sign'; end if;
  if exists (select 1 from public.board_sheets where session_id = s.id and status <> 'complete') then
    raise exception 'board: finish or discard every draft sheet before signing';
  end if;
  select encode(digest(string_agg(encode(digest(public.board_sheet_payload(sh)::text,'sha256'),'hex'),':' order by sh.id),'sha256'),'hex')
    into v_seal from public.board_sheets sh where session_id = s.id;
  if s.sig_1sg_at is not null and s.seal is distinct from v_seal then
    raise exception 'board: signed content changed; contact S-6';
  end if;
  if p_seat = '1sg' then
    update public.board_sessions set sig_1sg_email=h.email,sig_1sg_name=h.display_name,sig_1sg_at=now(),seal=v_seal where id=s.id;
  elsif p_seat = 'xo' then
    update public.board_sessions set sig_xo_email=h.email,sig_xo_name=h.display_name,sig_xo_at=now() where id=s.id;
  else
    update public.board_sheets sh set locked=true,seal=encode(digest(public.board_sheet_payload(sh)::text,'sha256'),'hex') where session_id=s.id;
    update public.board_sessions set sig_co_email=h.email,sig_co_name=h.display_name,sig_co_at=now(),status='signed',signed_at=now(),seal=v_seal where id=s.id;
  end if;
  select * into s from public.board_sessions where id=p_session_id;
  return s;
end $$;

create or replace function public.board_commit_sai_signoff(p_quarter_id uuid, p_company text, p_sai text, p_note text default null)
returns public.board_sai_signoffs language plpgsql security definer set search_path = public, extensions as $$
declare h public.board_members; result public.board_sai_signoffs; sh public.board_sheets;
  s public.board_sessions; target text; v_seal text; v_applied int := 0; v_count int;
begin
  perform 1 from public.board_quarters where id=p_quarter_id and status='open' for update;
  if not found then raise exception 'board: quarter is closed or missing'; end if;
  select * into h from public.board_members where email=p_sai and active and board_role='sai' for share;
  if h.email is null then raise exception 'board: SAI only'; end if;
  if p_company is null or p_company not in ('alpha','bravo','charlie','delta') then raise exception 'board: bad company'; end if;
  select * into result from public.board_sai_signoffs where quarter_id=p_quarter_id and company=p_company;
  if result.id is not null then return result; end if;
  if not exists (select 1 from public.board_sheets where quarter_id=p_quarter_id and company=p_company) then
    raise exception 'board: no board sheets for this company';
  end if;
  for s in select * from public.board_sessions where quarter_id=p_quarter_id and company=p_company order by id for update loop
    if not exists (select 1 from public.board_sheets where session_id=s.id) and s.status='open' then
      delete from public.board_sessions where id=s.id;
      continue;
    end if;
    if s.status <> 'signed' then raise exception 'board: the company board has unsigned sheets'; end if;
    select encode(digest(string_agg(encode(digest(public.board_sheet_payload(b)::text,'sha256'),'hex'),':' order by b.id),'sha256'),'hex')
      into v_seal from public.board_sheets b where session_id=s.id;
    if s.seal is distinct from v_seal then raise exception 'board: session seal mismatch; contact S-6'; end if;
  end loop;
  for sh in select * from public.board_sheets where quarter_id=p_quarter_id and company=p_company order by cadet_id,id for update loop
    if not sh.locked or sh.status <> 'complete' or sh.seal is distinct from encode(digest(public.board_sheet_payload(sh)::text,'sha256'),'hex') then
      raise exception 'board: unsigned or changed sheet; contact S-6';
    end if;
    if coalesce(sh.sai_decision,sh.decision) <> 'promote' then continue; end if;
    if sh.leadership_position or exists(select 1 from public.personnel where cadet_consent_id=sh.cadet_id) then raise exception 'board: leadership positions are evaluation only'; end if;
    target := coalesce(sh.sai_promote_to,sh.promote_to);
    if sh.cadet_id is null or public.board_rank_ladder(target) is null then
      raise exception 'board: promotion is missing a cadet or rank';
    end if;
    perform 1 from public.cadet_consent where id=sh.cadet_id and company=p_company for update;
    if not found then raise exception 'board: promoted cadet moved companies; resolve before signing'; end if;
    update public.cadet_consent set cadet_rank=target,cadet_rank_updated_at=now(),cadet_rank_source='promotion'
      where id=sh.cadet_id and coalesce(public.board_rank_ladder(cadet_rank),0) < public.board_rank_ladder(target);
    get diagnostics v_count = row_count;
    v_applied := v_applied + v_count;
  end loop;
  -- Includes original decisions AND the SAI's final review, with deterministic ordering.
  select encode(digest(jsonb_agg(to_jsonb(b) order by b.id)::text,'sha256'),'hex') into v_seal
    from public.board_sheets b where quarter_id=p_quarter_id and company=p_company;
  insert into public.board_sai_signoffs(quarter_id,company,signed_by,signed_name,note,promotions_applied,seal)
    values(p_quarter_id,p_company,h.email,h.display_name,nullif(left(trim(p_note),2000),''),v_applied,v_seal)
    returning * into result;
  return result;
end $$;

revoke all on function public.board_commit_signature(uuid,text,text,text), public.board_commit_sai_signoff(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.board_commit_signature(uuid,text,text,text), public.board_commit_sai_signoff(uuid,text,text,text) to service_role;
-- These helpers are internal; the browser accesses only the established RPCs.
revoke all on function public.board_sheet_payload(public.board_sheets),public.board_guard_sheet_mutation() from public,anon,authenticated;
grant execute on function public.board_sheet_payload(public.board_sheets) to service_role;
create or replace view public.board_results
with (security_invoker = true) as
select s.*,
       coalesce(s.sai_decision, s.decision)                                  as final_decision,
       case when coalesce(s.sai_decision, s.decision) = 'promote'
            then coalesce(s.sai_promote_to, s.promote_to) end                 as final_promote_to,
       q.label                                                               as quarter_label,
       ss.sig_1sg_name, ss.sig_1sg_at, ss.sig_xo_name, ss.sig_xo_at,
       ss.sig_co_name,  ss.sig_co_at,  ss.status as session_status,
       so.signed_name as sai_signed_name, so.signed_at as sai_signed_at
  from public.board_sheets s
  join public.board_quarters q  on q.id = s.quarter_id
  join public.board_sessions ss on ss.id = s.session_id
  left join public.board_sai_signoffs so on so.quarter_id = s.quarter_id and so.company = s.company;
grant select on public.board_results to authenticated;
revoke all on public.board_results from anon;
grant execute on function public.reserve_board_pin_attempt(text), public.reset_board_pin_attempts(text) to service_role;

commit;
