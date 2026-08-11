-- ============================================================================
-- Moves the /tv bell-schedule choice (Normal vs T2) into the shared
-- tv_daily_settings singleton row. Run in the Supabase SQL editor (idempotent).
--
-- Previously per-kiosk browser localStorage (see original tv_control_center.sql
-- comment) on the theory that different physical TVs might run different
-- schedules simultaneously — confirmed false in practice: every kiosk in the
-- building always runs the same schedule, so keeping it per-device only meant
-- someone had to walk up to every single screen and set it by hand each
-- morning, with no way to do it from DISPATCH. Folding it into the row already
-- broadcast to every kiosk (see tv_control_center.sql) makes it remote like
-- everything else in TV Remote.
-- ============================================================================

alter table public.tv_daily_settings
  add column if not exists bell_schedule text not null default 'normal'
    check (bell_schedule in ('normal', 't2'));
