-- ============================================================================
-- MILITARY BALL — MISSING SELECT-POLICY FIX. Run in the Supabase SQL editor
-- (project bjgyvmdzcymruunzavni). Idempotent, safe to re-run.
--
-- ROOT CAUSE of "approve/mark received does nothing" for every non-S6
-- approver (Kaz, Chief, Aubry, Kylie, Weston — everyone except Luke):
-- ball_signups / ball_guests / ball_vip_signups / ball_vip_dates each have an
-- RLS **UPDATE** policy for ops/dress/attire/S-5 (e.g.
-- ball_signups_update_ops_dress), but NO **SELECT** policy for those roles.
-- Postgres requires a row to be visible via a SELECT-applicable policy
-- before UPDATE can target it at all — the UPDATE policy's own USING clause
-- controls whether the WRITE is allowed, but does not by itself make the row
-- visible to select. Only public.ball_guard_version()-adjacent S-6 accounts
-- had a SELECT-applicable policy (ball_*_all_s6, cmd = ALL), so their writes
-- worked; everyone else's UPDATE always silently matched 0 rows — verified
-- by reproducing the exact failure against the live DB via
-- `set local role authenticated` + real JWT claims, and confirming a
-- matching SELECT policy fixes it. Reads never surfaced this because every
-- portal reads through *_ops_view / *_dress_view, whose own WHERE clause
-- (is_ball_ops_reviewer() / is_ball_dress()) is evaluated with the view
-- owner's privileges, bypassing base-table RLS entirely — only the direct
-- writes in BallOpsPortal.jsx / BallDressPortal.jsx / BallAttirePortal.jsx
-- ever hit this gap.
--
-- THE FIX: one SELECT policy per table, mirroring the OR-condition of the
-- existing UPDATE policy on that table, so the same roles that are allowed
-- to write a row are also allowed to see it.
-- ============================================================================

do $$
begin
  if to_regclass('public.ball_signups') is null then
    raise exception 'ball_rw_select_policy_fix.sql: run ball_signup.sql first (ball_signups missing)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'is_ball_ops_reviewer') then
    raise exception 'ball_rw_select_policy_fix.sql: run email_reviewer_capability_split.sql first (is_ball_ops_reviewer missing)';
  end if;
end $$;

-- ── ball_signups — mirrors ball_signups_update_ops_dress + ball_signups_update_s5 ──
drop policy if exists ball_signups_select_ops_dress_s5 on public.ball_signups;
create policy ball_signups_select_ops_dress_s5 on public.ball_signups
  for select to authenticated
  using (is_ball_ops_reviewer() or is_ball_dress() or is_s5());

-- ── ball_guests — mirrors ball_guests_update_ops + _update_dress + _update_attire ──
drop policy if exists ball_guests_select_ops_dress_attire on public.ball_guests;
create policy ball_guests_select_ops_dress_attire on public.ball_guests
  for select to authenticated
  using (is_ball_ops_reviewer() or is_ball_dress() or is_ball_attire());

-- ── ball_vip_signups — mirrors ball_vip_signups_update_dress ──
drop policy if exists ball_vip_signups_select_dress on public.ball_vip_signups;
create policy ball_vip_signups_select_dress on public.ball_vip_signups
  for select to authenticated
  using (is_ball_dress());

-- ── ball_vip_dates — mirrors ball_vip_dates_update_dress ──
drop policy if exists ball_vip_dates_select_dress on public.ball_vip_dates;
create policy ball_vip_dates_select_dress on public.ball_vip_dates
  for select to authenticated
  using (is_ball_dress());

-- ============================================================================
-- VERIFY AFTER RUNNING (as a real ops/dress/attire session, not the SQL
-- editor's superuser role — the editor bypasses RLS entirely, so it cannot
-- confirm this):
--   update ball_signups set cash_received = true where id = '<a real row>';
--   -- should now report 1 row updated instead of 0.
-- ============================================================================
