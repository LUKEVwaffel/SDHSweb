-- ============================================================================
-- COMPANY PROMOTION BOARDS — digital replacement for the paper board sheet.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: cadet_consent.sql (+ grade_let), admin_roles.sql (is_s6()),
-- portal_hub.sql (my_portals()).
--
-- Who does what:
--   * Each company's CO / XO / 1SG ('board' members) see ONLY their company.
--     They record ranks before boards, score cadets on one laptop, then all
--     three sign the session with their own PIN (edge fn board-sign-session).
--   * The SAI (Chief Thrasher) reviews every company, can overturn single
--     sheets, then signs each company once with his PIN
--     (edge fn board-sai-signoff). Promotions hit cadet_consent.cadet_rank
--     only at that point.
--   * 'viewer' members (S-1 / instructors) and S-6 can read + export.
--   * Cadets never get access to anything here.
--
-- Every client WRITE goes through a SECURITY DEFINER rpc below that
-- re-checks who the caller is and validates the sheet against the paper
-- sheet's rules; tables have SELECT-only RLS for the browser. Signatures and
-- SAI sign-off are edge-function-only (service role) because they verify PINs.
--
-- Rules mirror src/lib/boardRules.js — change both together.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── SECTION 1 — cadet rank on the roster ───────────────────────────────────
alter table public.cadet_consent
  add column if not exists cadet_rank            text,
  add column if not exists cadet_rank_updated_at timestamptz,
  add column if not exists cadet_rank_source     text; -- 'board_prep' | 'promotion' | 'dispatch' | 'role_backfill'

-- Leaders already carry their rank as a free-text title in `role`. Seed
-- cadet_rank from it once so nobody re-enters a Captain's rank by hand.
update public.cadet_consent c
   set cadet_rank = m.code, cadet_rank_updated_at = now(), cadet_rank_source = 'role_backfill'
  from (values
    ('private','PVT'),('private second class','PV2'),('private first class','PFC'),
    ('corporal','CPL'),('sergeant','SGT'),('staff sergeant','SSG'),
    ('sergeant first class','SFC'),('master sergeant','MSG'),('first sergeant','1SG'),
    ('sergeant major','SGM'),('command sergeant major','CSM'),
    ('second lieutenant','2LT'),('first lieutenant','1LT'),('captain','CPT'),
    ('major','MAJ'),('lieutenant colonel','LTC'),('colonel','COL')
  ) as m(title, code)
 where c.cadet_rank is null
   and lower(regexp_replace(trim(coalesce(c.role,'')), '^[Cc]adet\s+', '')) = m.title;


-- ── SECTION 2 — rank ladder (mirrors boardRules.js RANKS) ──────────────────
create or replace function public.board_rank_ladder(p_code text)
returns int language sql immutable as $$
  select case p_code
    when 'PVT' then 0 when 'PV2' then 1 when 'PFC' then 2 when 'CPL' then 3
    when 'SGT' then 4 when 'SSG' then 5 when 'SFC' then 6 when 'MSG' then 7
    when '1SG' then 7 when 'SGM' then 8 when 'CSM' then 8 when '2LT' then 9
    when '1LT' then 10 when 'CPT' then 11 when 'MAJ' then 12 when 'LTC' then 13
    when 'COL' then 14 else null end
$$;

create or replace function public.board_let_int(p_let text)
returns int language sql immutable as $$
  select case when n between 1 and 4 then n else null end
  from (select nullif(regexp_replace(coalesce(p_let,''), '\D', '', 'g'), '')::int as n) s
$$;

create or replace function public.board_max_rank(p_let int)
returns text language sql immutable as $$
  select case p_let when 1 then 'CPL' when 2 then 'SSG' when 3 then 'SFC' when 4 then 'MSG' end
$$;

-- Leadership-only. Never exposed through any view a cadet could reach.
create or replace function public.board_min_score(p_let int)
returns int language sql immutable as $$
  select case when p_let = 1 then 10 when p_let between 2 and 4 then 12 end
$$;

alter table public.cadet_consent drop constraint if exists cadet_consent_cadet_rank_chk;
alter table public.cadet_consent add constraint cadet_consent_cadet_rank_chk
  check (cadet_rank is null or public.board_rank_ladder(cadet_rank) is not null);


-- ── SECTION 3 — board accounts ─────────────────────────────────────────────
create table if not exists public.board_members (
  email        text primary key check (email = lower(email)),
  display_name text not null,
  board_role   text not null check (board_role in ('co','xo','1sg','sai','viewer')),
  company      text check (company in ('alpha','bravo','charlie','delta')),
  cadet_id     uuid references public.cadet_consent(id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint board_members_company_chk check (
    (board_role in ('co','xo','1sg') and company is not null)
    or (board_role in ('sai','viewer') and company is null)
  )
);

-- One active CO / XO / 1SG per company.
create unique index if not exists board_members_one_per_seat
  on public.board_members (company, board_role)
  where active and board_role in ('co','xo','1sg');

-- PIN secrets — service role only (RLS on, zero policies).
create table if not exists public.board_credentials (
  email            text primary key references public.board_members(email) on delete cascade,
  pin_hash         text not null,
  pin_fail_count   int  not null default 0,
  pin_locked_until timestamptz,
  updated_at       timestamptz not null default now()
);
alter table public.board_credentials enable row level security;
revoke all on public.board_credentials from anon, authenticated;


-- ── SECTION 4 — identity helpers ───────────────────────────────────────────
create or replace function public.board_jwt_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.board_my_company()
returns text language sql stable security definer set search_path = public as $$
  select company from public.board_members
   where email = public.board_jwt_email() and active and board_role in ('co','xo','1sg')
$$;

create or replace function public.is_board_for(p_company text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_company is not null and public.board_my_company() = p_company
$$;

create or replace function public.is_board_sai()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_members
                  where email = public.board_jwt_email() and active and board_role = 'sai')
$$;

-- Read-everything population: SAI, viewers (S-1 / instructors), S-6.
create or replace function public.can_view_all_boards()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_board_sai()
      or exists (select 1 from public.board_members
                  where email = public.board_jwt_email() and active and board_role = 'viewer')
      or coalesce(public.is_s6(), false)
$$;

create or replace function public.is_board_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.board_members where email = public.board_jwt_email() and active)
$$;

revoke all on function public.board_my_company(), public.is_board_for(text), public.is_board_sai(),
               public.can_view_all_boards(), public.is_board_member() from public, anon;
grant execute on function public.board_my_company(), public.is_board_for(text), public.is_board_sai(),
               public.can_view_all_boards(), public.is_board_member() to authenticated;


-- ── SECTION 5 — quarters, sessions, sheets, SAI sign-offs ──────────────────
create table if not exists public.board_quarters (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,
  status     text not null default 'open' check (status in ('open','closed')),
  opened_at  timestamptz not null default now(),
  opened_by  text,
  closed_at  timestamptz,
  closed_by  text
);
create unique index if not exists board_quarters_one_open on public.board_quarters ((true)) where status = 'open';

create table if not exists public.board_sessions (
  id           uuid primary key default gen_random_uuid(),
  quarter_id   uuid not null references public.board_quarters(id) on delete cascade,
  company      text not null check (company in ('alpha','bravo','charlie','delta')),
  status       text not null default 'open' check (status in ('open','signed')),
  opened_by    text not null,
  opened_at    timestamptz not null default now(),
  sig_1sg_email text, sig_1sg_name text, sig_1sg_at timestamptz,
  sig_xo_email  text, sig_xo_name  text, sig_xo_at  timestamptz,
  sig_co_email  text, sig_co_name  text, sig_co_at  timestamptz,
  signed_at    timestamptz,
  seal         text  -- sha-256 over every sheet sealed by this session
);
create unique index if not exists board_sessions_one_open
  on public.board_sessions (quarter_id, company) where status = 'open';

create table if not exists public.board_sheets (
  id            uuid primary key default gen_random_uuid(),
  quarter_id    uuid not null references public.board_quarters(id) on delete cascade,
  session_id    uuid not null references public.board_sessions(id) on delete cascade,
  cadet_id      uuid references public.cadet_consent(id) on delete set null,
  -- snapshot at board time, so the sheet stays truthful if the roster changes
  cadet_name    text not null,
  company       text not null,
  let_level     text,
  grade         text,
  rank_before   text,
  score_facing  smallint check (score_facing  between 0 and 3),
  score_creed   smallint check (score_creed   between 0 and 3),
  score_uniform smallint check (score_uniform between 0 and 3),
  score_jrotc   smallint check (score_jrotc   between 0 and 3),
  score_class   smallint check (score_class   between 0 and 3),
  total         smallint generated always as (
                  coalesce(score_facing,0) + coalesce(score_creed,0) + coalesce(score_uniform,0)
                + coalesce(score_jrotc,0) + coalesce(score_class,0)) stored,
  decision      text check (decision in ('promote','no_promote','absent')),
  promote_to    text,
  comment       text check (char_length(comment) <= 2000),
  status        text not null default 'draft' check (status in ('draft','complete')),
  locked        boolean not null default false,
  seal          text,
  created_by    text not null,
  created_at    timestamptz not null default now(),
  updated_by    text,
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz,
  -- SAI review (overturn keeps the board's original decision intact above)
  sai_action    text check (sai_action in ('overturn')),
  sai_decision  text check (sai_decision in ('promote','no_promote')),
  sai_promote_to text,
  sai_note      text check (char_length(sai_note) <= 2000),
  sai_by        text,
  sai_at        timestamptz
);
-- One real sheet per cadet per quarter; 'absent' rows are history and may repeat.
create unique index if not exists board_sheets_one_per_cadet
  on public.board_sheets (quarter_id, cadet_id) where decision is distinct from 'absent';
create index if not exists board_sheets_company_idx on public.board_sheets (quarter_id, company);
create index if not exists board_sheets_session_idx on public.board_sheets (session_id);

create table if not exists public.board_sai_signoffs (
  id          uuid primary key default gen_random_uuid(),
  quarter_id  uuid not null references public.board_quarters(id) on delete cascade,
  company     text not null check (company in ('alpha','bravo','charlie','delta')),
  signed_by   text not null,
  signed_name text not null,
  signed_at   timestamptz not null default now(),
  note        text,
  promotions_applied int not null default 0,
  seal        text,
  unique (quarter_id, company)
);

-- Final outcome of a sheet after SAI review — what exports + promotions use.
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


-- ── SECTION 6 — RLS: browser reads only ────────────────────────────────────
alter table public.board_members      enable row level security;
alter table public.board_quarters     enable row level security;
alter table public.board_sessions     enable row level security;
alter table public.board_sheets       enable row level security;
alter table public.board_sai_signoffs enable row level security;

drop policy if exists board_members_read on public.board_members;
create policy board_members_read on public.board_members for select to authenticated
  using (public.can_view_all_boards() or email = public.board_jwt_email()
         or (company is not null and public.is_board_for(company)));

drop policy if exists board_quarters_read on public.board_quarters;
create policy board_quarters_read on public.board_quarters for select to authenticated
  using (public.is_board_member() or public.can_view_all_boards());

drop policy if exists board_sessions_read on public.board_sessions;
create policy board_sessions_read on public.board_sessions for select to authenticated
  using (public.is_board_for(company) or public.can_view_all_boards());

drop policy if exists board_sheets_read on public.board_sheets;
create policy board_sheets_read on public.board_sheets for select to authenticated
  using (public.is_board_for(company) or public.can_view_all_boards());

drop policy if exists board_signoffs_read on public.board_sai_signoffs;
create policy board_signoffs_read on public.board_sai_signoffs for select to authenticated
  using (public.is_board_for(company) or public.can_view_all_boards());

revoke insert, update, delete on public.board_members, public.board_quarters, public.board_sessions,
  public.board_sheets, public.board_sai_signoffs from anon, authenticated;
grant select on public.board_members, public.board_quarters, public.board_sessions,
  public.board_sheets, public.board_sai_signoffs, public.board_results to authenticated;
revoke all on public.board_results from anon;


-- ── SECTION 7 — sheet validation (the paper sheet's rules, enforced) ───────
create or replace function public.board_validate_sheet()
returns trigger language plpgsql as $$
declare
  v_let int := public.board_let_int(new.let_level);
  v_all boolean := new.score_facing is not null and new.score_creed is not null
               and new.score_uniform is not null and new.score_jrotc is not null
               and new.score_class is not null;
  v_from int := coalesce(public.board_rank_ladder(new.rank_before), 0);
  v_to   int;
begin
  if new.promote_to is not null and new.decision is distinct from 'promote' then
    new.promote_to := null;
  end if;

  if new.status = 'complete' then
    if new.decision is null then raise exception 'board: a decision is required'; end if;
    if new.decision <> 'absent' and not v_all then raise exception 'board: all five categories must be scored'; end if;
    if new.decision <> 'absent' and new.rank_before is null then raise exception 'board: current rank is required'; end if;
  end if;

  if new.decision = 'promote' then
    if v_let is null then raise exception 'board: LET level missing'; end if;
    if not v_all then raise exception 'board: cannot promote an incomplete sheet'; end if;
    if new.total < public.board_min_score(v_let) then raise exception 'board: does not meet the board standard'; end if;
    v_to := public.board_rank_ladder(new.promote_to);
    if new.promote_to not in ('PV2','PFC','CPL','SGT','SSG','SFC','MSG') or v_to is null then
      raise exception 'board: invalid promote-to rank';
    end if;
    if v_to <= v_from then raise exception 'board: promote-to must be above current rank'; end if;
    if v_to > public.board_rank_ladder(public.board_max_rank(v_let)) then
      raise exception 'board: promote-to exceeds the LET % maximum', v_let;
    end if;
  end if;

  -- SAI overturn to promote must obey the same cap (min score is the SAI's call).
  if new.sai_decision = 'promote' then
    v_to := public.board_rank_ladder(new.sai_promote_to);
    if new.sai_promote_to not in ('PV2','PFC','CPL','SGT','SSG','SFC','MSG') or v_to is null
       or v_to <= v_from or v_let is null
       or v_to > public.board_rank_ladder(public.board_max_rank(v_let)) then
      raise exception 'board: invalid SAI promote-to rank';
    end if;
  elsif new.sai_decision is not null then
    new.sai_promote_to := null;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists board_sheets_validate on public.board_sheets;
create trigger board_sheets_validate before insert or update on public.board_sheets
  for each row execute function public.board_validate_sheet();


-- ── SECTION 8 — RPCs (all client writes) ───────────────────────────────────
-- Roster for a company board: excludes the company's own CO/XO/1SG seats.
create or replace function public.board_roster(p_company text)
returns table (id uuid, name text, company text, let_level text, grade text, gender text,
               cadet_rank text, cadet_rank_updated_at timestamptz, is_board_seat boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.company, c.let_level, c.grade, c.gender, c.cadet_rank, c.cadet_rank_updated_at,
         exists (select 1 from public.board_members m
                  where m.cadet_id = c.id and m.active and m.board_role in ('co','xo','1sg')
                    and m.company = c.company) as is_board_seat
    from public.cadet_consent c
   where c.company = p_company
     and p_company in ('alpha','bravo','charlie','delta')
     and (public.is_board_for(p_company) or public.can_view_all_boards())
   order by split_part(c.name, ' ', array_length(string_to_array(c.name, ' '), 1)), c.name
$$;

-- Pre-board rank collection.
create or replace function public.board_set_rank(p_cadet_id uuid, p_rank text)
returns void language plpgsql security definer set search_path = public as $$
declare v_company text;
begin
  select company into v_company from public.cadet_consent where id = p_cadet_id;
  if v_company is null then raise exception 'board: no such cadet'; end if;
  if not (public.is_board_for(v_company) or coalesce(public.is_s6(), false)) then
    raise exception 'board: not authorized for this company';
  end if;
  if p_rank is not null and public.board_rank_ladder(p_rank) is null then
    raise exception 'board: unknown rank %', p_rank;
  end if;
  update public.cadet_consent
     set cadet_rank = p_rank, cadet_rank_updated_at = now(),
         cadet_rank_source = case when public.is_board_for(v_company) then 'board_prep' else 'dispatch' end
   where id = p_cadet_id;
end $$;

-- Get (or open) this company's live session for the open quarter.
create or replace function public.board_current_session()
returns public.board_sessions language plpgsql security definer set search_path = public as $$
declare
  v_company text := public.board_my_company();
  v_q uuid;
  v_s public.board_sessions;
begin
  if v_company is null then raise exception 'board: not a company board member'; end if;
  select id into v_q from public.board_quarters where status = 'open';
  if v_q is null then raise exception 'board: no board quarter is open'; end if;
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

-- Save (create/update) a sheet in the caller's open session. Drafts allowed.
create or replace function public.board_save_sheet(p jsonb)
returns public.board_sheets language plpgsql security definer set search_path = public as $$
declare
  v_s     public.board_sessions := public.board_current_session();
  v_cadet public.cadet_consent;
  v_row   public.board_sheets;
  v_id    uuid := nullif(p->>'id','')::uuid;
  v_status text := coalesce(p->>'status','draft');
  v_rank  text := nullif(p->>'rank_before','');
begin
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
    if v_row.id is null or v_row.session_id <> v_s.id then raise exception 'board: sheet is not in your open session'; end if;
    if v_row.locked then raise exception 'board: sheet is signed and locked'; end if;
    update public.board_sheets set
      rank_before   = coalesce(v_rank, rank_before),
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
    insert into public.board_sheets (
      quarter_id, session_id, cadet_id, cadet_name, company, let_level, grade, rank_before,
      score_facing, score_creed, score_uniform, score_jrotc, score_class,
      decision, promote_to, comment, status, completed_at, created_by, updated_by)
    values (
      v_s.quarter_id, v_s.id, v_cadet.id, v_cadet.name, v_cadet.company,
      public.board_let_int(v_cadet.let_level)::text, v_cadet.grade, coalesce(v_rank, v_cadet.cadet_rank),
      (p->>'score_facing')::smallint, (p->>'score_creed')::smallint, (p->>'score_uniform')::smallint,
      (p->>'score_jrotc')::smallint, (p->>'score_class')::smallint,
      nullif(p->>'decision',''), nullif(p->>'promote_to',''), nullif(trim(coalesce(p->>'comment','')),''),
      v_status, case when v_status = 'complete' then now() end,
      public.board_jwt_email(), public.board_jwt_email())
    returning * into v_row;
  end if;
  return v_row;
end $$;

-- Discard an unsigned sheet (mis-click, wrong cadet).
create or replace function public.board_discard_sheet(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.board_sheets;
begin
  select * into v_row from public.board_sheets where id = p_id;
  if v_row.id is null or not public.is_board_for(v_row.company) then raise exception 'board: not authorized'; end if;
  if v_row.locked then raise exception 'board: sheet is signed and locked'; end if;
  delete from public.board_sheets where id = p_id;
end $$;

-- SAI per-sheet review: overturn (or clear an overturn) before company sign-off.
create or replace function public.board_sai_review(p_id uuid, p_decision text, p_promote_to text, p_note text)
returns public.board_sheets language plpgsql security definer set search_path = public as $$
declare v_row public.board_sheets;
begin
  if not public.is_board_sai() then raise exception 'board: SAI only'; end if;
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

-- Quarter management (S-6 or SAI). Opening a new quarter closes the old one.
create or replace function public.board_open_quarter(p_label text)
returns public.board_quarters language plpgsql security definer set search_path = public as $$
declare v_q public.board_quarters;
begin
  if not (public.is_board_sai() or coalesce(public.is_s6(), false)) then raise exception 'board: not authorized'; end if;
  if coalesce(trim(p_label),'') = '' then raise exception 'board: label required'; end if;
  update public.board_quarters set status = 'closed', closed_at = now(), closed_by = public.board_jwt_email()
   where status = 'open';
  insert into public.board_quarters (label, opened_by) values (trim(p_label), public.board_jwt_email())
  on conflict (label) do update set status = 'open', closed_at = null, closed_by = null
  returning * into v_q;
  return v_q;
end $$;

create or replace function public.board_close_quarter(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_board_sai() or coalesce(public.is_s6(), false)) then raise exception 'board: not authorized'; end if;
  update public.board_quarters set status = 'closed', closed_at = now(), closed_by = public.board_jwt_email()
   where id = p_id and status = 'open';
end $$;

-- Who am I? Drives the /boards landing screen.
create or replace function public.board_whoami()
returns table (email text, display_name text, board_role text, company text, cadet_id uuid, is_s6 boolean)
language sql stable security definer set search_path = public as $$
  select m.email, m.display_name, m.board_role, m.company, m.cadet_id, coalesce(public.is_s6(), false)
    from public.board_members m where m.email = public.board_jwt_email() and m.active
  union all
  select public.board_jwt_email(), 'S-6', 'viewer', null, null, true
   where coalesce(public.is_s6(), false)
     and not exists (select 1 from public.board_members m where m.email = public.board_jwt_email() and m.active)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'board_roster(text)','board_set_rank(uuid,text)','board_current_session()','board_save_sheet(jsonb)',
    'board_discard_sheet(uuid)','board_sai_review(uuid,text,text,text)','board_open_quarter(text)',
    'board_close_quarter(uuid)','board_whoami()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;


-- ── SECTION 9 — PIN lockout (service role only; same shape as rifle) ──────
create or replace function public.reserve_board_pin_attempt(p_email text)
returns table(allowed boolean, fail_count integer, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_count int; v_locked timestamptz; v_new int; v_lock timestamptz;
begin
  select bc.pin_fail_count, bc.pin_locked_until into v_count, v_locked
    from public.board_credentials bc where bc.email = lower(p_email) for update;
  if not found then return query select false, null::int, null::timestamptz; return; end if;
  if v_locked is not null and v_locked > now() then return query select false, v_count, v_locked; return; end if;
  v_new := (case when v_locked is not null then 0 else v_count end) + 1;
  v_lock := case when v_new >= 5 then now() + interval '15 minutes' else null end;
  update public.board_credentials set pin_fail_count = v_new, pin_locked_until = v_lock, updated_at = now()
   where email = lower(p_email);
  return query select true, v_new, v_lock;
end $$;

create or replace function public.reset_board_pin_attempts(p_email text)
returns void language sql security definer set search_path = public as $$
  update public.board_credentials set pin_fail_count = 0, pin_locked_until = null, updated_at = now()
   where email = lower(p_email);
$$;

revoke execute on function public.reserve_board_pin_attempt(text) from public;
revoke execute on function public.reset_board_pin_attempts(text) from public;
revoke all on function public.reserve_board_pin_attempt(text) from anon, authenticated;
revoke all on function public.reset_board_pin_attempts(text) from anon, authenticated;

-- S-6 account list (no hashes, no fail counts).
create or replace function public.board_member_status()
returns table (email text, display_name text, board_role text, company text, cadet_id uuid,
               active boolean, has_pin boolean, pin_locked_until timestamptz)
language sql stable security definer set search_path = public as $$
  select m.email, m.display_name, m.board_role, m.company, m.cadet_id, m.active,
         bc.email is not null, bc.pin_locked_until
    from public.board_members m left join public.board_credentials bc on bc.email = m.email
   where coalesce(public.is_s6(), false)
   order by m.company nulls last, m.board_role
$$;
revoke all on function public.board_member_status() from public, anon;
grant execute on function public.board_member_status() to authenticated;


-- ── SECTION 10 — /portal tile ──────────────────────────────────────────────
create or replace function public.my_portals()
returns table (key text, label text, description text, path text)
language sql stable security definer set search_path = public as $$
  select 'email_review'::text, 'Email Review'::text,
         'Approve or deny outgoing DISPATCH email'::text, '/review'::text
  where public.is_email_reviewer()
  union all
  select 'ball_ops'::text, 'Ball Payments'::text,
         'Track Military Ball cash + field-trip forms'::text, '/ball/ops'::text
  where public.is_ball_ops_reviewer()
  union all
  select 'rifle_signups'::text, 'Rifle Signups'::text,
         'View rifle team interest signups'::text, '/rifle/signup-review'::text
  where public.is_rifle_signups_reviewer()
  union all
  select 'ball_dress', 'Ball — Dress Approval',
         'Approve female cadet & guest attire photos', '/ball/dress'
  where public.is_ball_dress()
  union all
  select 'ball_attire', 'Ball — Male Guest Attire',
         'Approve male guest attire photos', '/ball/attire'
  where public.is_ball_attire()
  union all
  select 'rifle_portal'::text,
         case when ra.must_change_password then 'Rifle Team Admin — finish setup'
              else 'Rifle Team Admin' end,
         case when ra.must_change_password then 'Sign in to set your password and finish account setup'
              else 'Manage the rifle team roster' end,
         '/rifle/portal'::text
  from public.rifle_admins ra
  where lower(ra.email) = lower(auth.jwt() ->> 'email') and ra.active
  union all
  select 'boards'::text,
         case m.board_role when 'sai' then 'Boards — SAI Review'
                           when 'viewer' then 'Boards — Results'
                           else 'Company Boards — ' || initcap(m.company) end,
         case m.board_role when 'sai' then 'Review and sign off every company''s promotion boards'
                           when 'viewer' then 'View and export promotion board results'
                           else 'Run promotion boards for your company' end,
         '/boards'::text
  from public.board_members m
  where m.email = public.board_jwt_email() and m.active;
$$;
revoke all     on function public.my_portals() from public, anon;
grant  execute on function public.my_portals() to authenticated;


-- ── SECTION 11 — seed accounts (no PINs — S-6 sets them in DISPATCH) ───────
-- Chief = SAI. Company seats link to their cadet_consent row so they are
-- excluded from their own company's board list.
insert into public.board_members (email, display_name, board_role, company, cadet_id)
values ('thrasher_michael@hcde.org', 'Chief Michael Thrasher', 'sai', null, null)
on conflict (email) do nothing;

insert into public.board_members (email, display_name, board_role, company, cadet_id)
select lower(c.school_email), c.name, s.board_role, c.company, c.id
  from (values
    ('Chase Otto','co'), ('Cooper Higginbotham','xo'), ('Suzanne Perry','1sg'),
    ('Aryanna Dane Shirey','co'), ('Lachlan Redlin','xo'), ('Isabella Myers','1sg'),
    ('Zoe McCollum','co'), ('William Baker','xo'), ('Brayden Gray','1sg'),
    ('Aiden Clifton','co'), ('Jennie Howard','xo'), ('William Boyd','1sg')
  ) as s(name, board_role)
  join public.cadet_consent c on c.name = s.name and c.company <> 'staff' and c.school_email is not null
on conflict (email) do nothing;

-- verify:
--   select board_role, company, display_name, email from public.board_members order by company, board_role;
--   select name, company, role, cadet_rank from public.cadet_consent where cadet_rank is not null;
-- ============================================================================
