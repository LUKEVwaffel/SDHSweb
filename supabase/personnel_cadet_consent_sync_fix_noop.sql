-- ============================================================================
-- FIX: personnel_sync_rank_let fired on every autosave, not just real changes.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- Bug: PeoplePanel.jsx's autosave (persist()) always sends the FULL staff
-- record on every edit, including rank/let_level even when untouched.
-- Postgres `AFTER UPDATE OF rank, let_level` fires whenever those columns
-- are named in the UPDATE's SET list — regardless of whether the value
-- actually changed. Result: editing ANY field on a linked commander/CSM's
-- Staff record (bio, photo, whatever) silently re-pushed their stale
-- rank/let_level into cadet_consent, clobbering a LET LEVEL just edited
-- directly in the Cadet Database.
--
-- Fix: add a WHEN clause so the trigger body only runs on an actual change
-- (or a fresh link), same trigger/function otherwise.
--
-- TG_OP is a PL/pgSQL variable, not visible inside a trigger WHEN clause
-- (that's plain SQL) — first attempt at this fix used it and failed with
-- 42703 "column tg_op does not exist". OLD is also undefined for INSERT
-- events, so a single combined INSERT-OR-UPDATE trigger can't reference
-- OLD in its WHEN clause either. Split into two triggers instead: INSERT
-- always fires (matches original behavior, no OLD to compare against),
-- UPDATE only fires on an actual rank/let_level/link change.
-- ============================================================================

drop trigger if exists personnel_sync_rank_let on public.personnel;
drop trigger if exists personnel_sync_rank_let_ins on public.personnel;
drop trigger if exists personnel_sync_rank_let_upd on public.personnel;

create trigger personnel_sync_rank_let_ins
  after insert on public.personnel
  for each row
  execute function public.sync_personnel_rank_let_to_cadet_consent();

create trigger personnel_sync_rank_let_upd
  after update of rank, let_level, cadet_consent_id on public.personnel
  for each row
  when (
    new.rank             is distinct from old.rank
    or new.let_level        is distinct from old.let_level
    or new.cadet_consent_id is distinct from old.cadet_consent_id
  )
  execute function public.sync_personnel_rank_let_to_cadet_consent();
