-- ============================================================================
-- MILITARY BALL — reminder deadlines. Independent add-on, run any time after
-- ball_finalize.sql. Idempotent. Run in the Supabase SQL editor (project
-- bjgyvmdzcymruunzavni).
--
-- Adds two S-6-editable dates on ball_config (edited on the SETTINGS tab of
-- the DISPATCH Ball panel, same as ball_date / signup_deadline):
--   payment_deadline — cash + field-trip-form due date, surfaced in the
--     manual "Send Reminders" blast (send-ball-reminders edge function).
--   dress_deadline    — the date unapproved dresses get flagged by email.
--     Defaults to 2026-11-20 (today's ask); S-6 can move it without a deploy.
-- Neither is enforced anywhere server-side (unlike signup_deadline, which
-- gates ball-submit-signup) — both are purely reminder-copy inputs.
-- ============================================================================

do $$
begin
  if to_regclass('public.ball_config') is null then
    raise exception 'ball_reminder_deadlines.sql: run ball_signup.sql first (ball_config missing)';
  end if;
end $$;

alter table public.ball_config
  add column if not exists payment_deadline date,
  add column if not exists dress_deadline   date not null default '2026-11-20';

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select payment_deadline, dress_deadline from public.ball_config;
-- ============================================================================
