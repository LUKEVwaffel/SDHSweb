-- ============================================================================
-- MILITARY BALL — WIPE ALL SIGNUPS. One-time cleanup of test data. Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni).
--
-- ⚠ DESTRUCTIVE. Deletes every row from ball_signups + ball_guests (guests
-- cascade from signups, deleted explicitly here too for clarity) and clears
-- the single-use signup-token ledger so the same test emails can sign up
-- again. Does NOT touch ball_config, ball_gallery, ball_dress_staff, or the
-- reviewer accounts.
--
-- Re-runnable (idempotent — a second run just deletes zero rows).
-- ============================================================================

begin;

delete from public.ball_guests;
delete from public.ball_signups;

-- ball_signup_tokens_used only exists once ball_hardening.sql is live.
do $$
begin
  if to_regclass('public.ball_signup_tokens_used') is not null then
    delete from public.ball_signup_tokens_used;
  end if;
end $$;

commit;

-- verify:
--   select count(*) from public.ball_signups;   -- 0
--   select count(*) from public.ball_guests;    -- 0
-- ============================================================================
