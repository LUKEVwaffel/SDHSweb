-- ============================================================================
-- MILITARY BALL — /balltv roster view. Independent add-on, run any time after
-- ball_signup.sql. Idempotent. Run in the Supabase SQL editor (project
-- bjgyvmdzcymruunzavni).
--
-- /balltv is the anon hallway-TV kiosk (same security posture as /ball
-- itself — no login). ball_signups has NO anon policy at all (see
-- ball_signup.sql SECURITY MODEL) so the kiosk needs a deliberate, narrow
-- crack to let a cadet glance at the screen and see their own company's
-- status. This view is that crack — keep the column list tight:
--   • cadet_name, cadet_company, status, cash_received only.
--   • NO email, NO LET level, NO age/gender, NO allergies, NO dollar
--     amounts, NO guest/POC info — all of that stays reviewer/dress/S-6
--     only, same as today.
-- Default (non-invoker) view runs owner-privileged, same reasoning as
-- ball_ops_dress_views_fix.sql: `security_invoker=true` would return 0 rows
-- for anon (it has no SELECT policy on the base table at all). No `where`
-- clause — unlike the ops/dress views, this one is meant to show every row
-- to everyone, so there is no caller-identity gate to apply.
-- ============================================================================

do $$
begin
  if to_regclass('public.ball_signups') is null then
    raise exception 'ball_tv_roster_view.sql: run ball_signup.sql first (ball_signups missing)';
  end if;
end $$;

drop view if exists public.ball_signups_tv_view;
create view public.ball_signups_tv_view
with (security_barrier = true) as
  select cadet_name, cadet_company, status, cash_received
  from public.ball_signups;
grant select on public.ball_signups_tv_view to anon, authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select has_table_privilege('anon','ball_signups_tv_view','select');  -- true
--   select has_table_privilege('anon','ball_signups','select');         -- true (grant) but RLS blocks all rows — unaffected by this file
--   select * from public.ball_signups_tv_view limit 5;                  -- cadet_name/cadet_company/status/cash_received only, no other columns
-- ============================================================================
