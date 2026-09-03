-- ============================================================================
-- BALL PHONE NUMBERS. Run in the Supabase SQL editor (remote). Idempotent.
--
-- Cadet enters their own phone in the signup wizard (step 2); guest enters
-- their own on the /ball/guest/<token> verify page (the cadet may pre-fill a
-- guess in step 3, the guest confirms it). Free text — stored as typed.
-- ============================================================================

alter table public.ball_signups add column if not exists cadet_phone text;
alter table public.ball_guests  add column if not exists guest_phone text;

-- verify:
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name in ('ball_signups','ball_guests')
--     and column_name like '%phone%';
-- ============================================================================
