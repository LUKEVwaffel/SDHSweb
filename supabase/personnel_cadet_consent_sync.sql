-- ============================================================================
-- PERSONNEL ↔ CADET_CONSENT LINK + AUTO-SYNC (rank, let_level)
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- Problem: `personnel` (STAFF/COMMAND directory — rank, let_level, bio) and
-- `cadet_consent` (Cadet Database — birthdate, consent, its own role/let_level)
-- are separate tables (see cadet_consent.sql header) with no FK between them.
-- Editing a commander/CSM's rank or LET level in STAFF never reached their
-- Cadet Database row.
--
-- Fix: explicit `personnel.cadet_consent_id` link + a trigger that pushes
-- rank → cadet_consent.role and let_level → cadet_consent.let_level whenever
-- a linked personnel row's rank/let_level/link changes. One-way sync
-- (STAFF/COMMAND is the source of truth); Cadet Database's role/let_level on
-- a linked cadet becomes effectively read-only going forward.
-- ============================================================================

-- 1. link column ---------------------------------------------------------
alter table public.personnel
  add column if not exists cadet_consent_id uuid references public.cadet_consent(id) on delete set null;

create index if not exists personnel_cadet_consent_idx
  on public.personnel (cadet_consent_id);

-- 2. backfill existing commanders/CSMs by exact case-insensitive name match
--    (only when the match is unambiguous — exactly one cadet_consent row
--    with that name). Re-run-safe: only fills rows currently unlinked.
with match_counts as (
  select p.id as personnel_id, cc.id as cadet_consent_id,
         count(*) over (partition by p.id) as name_matches
  from public.personnel p
  join public.cadet_consent cc
    on lower(trim(cc.name)) = lower(trim(p.name))
  where p.cadet_consent_id is null
),
matches as (
  select personnel_id, cadet_consent_id from match_counts where name_matches = 1
)
update public.personnel p
set cadet_consent_id = m.cadet_consent_id
from matches m
where p.id = m.personnel_id;

-- Diagnostic: linked-eligible personnel rows still unmatched (name mismatch,
-- no cadet_consent row yet, or ambiguous — multiple cadet_consent rows share
-- that name). Link these manually:
--   update public.personnel set cadet_consent_id = '<cadet_consent.id>' where id = '<personnel.id>';
select p.id as personnel_id, p.name, p.section, p.rank
from public.personnel p
where p.cadet_consent_id is null
order by p.name;

-- 3. sync trigger ---------------------------------------------------------
-- SECURITY DEFINER: personnel is written under the app's anon-key admin
-- session (no per-user Supabase Auth), but cadet_consent writes are
-- s6-authenticated-only (admin_roles.sql SECTION 3d / is_s6()). Without
-- DEFINER rights, this trigger's UPDATE would be blocked by cadet_consent's
-- own RLS and roll back the personnel save that triggered it.
create or replace function public.sync_personnel_rank_let_to_cadet_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cadet_consent_id is not null then
    update public.cadet_consent
    set role       = coalesce(new.rank, role),
        let_level  = coalesce(new.let_level, let_level),
        updated_at = now()
    where id = new.cadet_consent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists personnel_sync_rank_let on public.personnel;
create trigger personnel_sync_rank_let
  after insert or update of rank, let_level, cadet_consent_id on public.personnel
  for each row
  execute function public.sync_personnel_rank_let_to_cadet_consent();

-- 4. one-time sync for already-linked rows, so existing drift is fixed the
--    moment this migration runs (not just on the next edit). `UPDATE OF`
--    fires whenever a column is named in SET, even to its own value — this
--    re-sets rank/let_level to themselves purely to trigger the sync above.
update public.personnel p
set rank = p.rank, let_level = p.let_level
where p.cadet_consent_id is not null;
