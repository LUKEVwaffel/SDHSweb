-- ============================================================================
-- CREED LEADERBOARD — WIPE. One-time reset for the switch to dispatch-
-- verified entries (see creed_leaderboard_dispatch_verify.sql) — clears
-- scores that were added under the old honor-system gate. Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni) AFTER
-- creed_leaderboard_dispatch_verify.sql is deployed, so nothing new lands
-- unverified in the gap. Irreversible — no backup table, matches how this
-- board treats submitted scores as permanent (creed_leaderboard.sql: "no
-- public update").
-- ============================================================================

delete from public.creed_leaderboard;
