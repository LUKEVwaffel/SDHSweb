-- Run manually in Supabase SQL editor.
-- VIP-only signup deadline. Visiting XO/BC/CSM + past King/Queen signups
-- (/ball/vip, ball-submit-vip-signup) close on vip_signup_deadline when set,
-- falling back to the shared cadet signup_deadline when null. Lets S-6 reopen
-- VIP signups without reopening cadet signups. Editable afterwards in
-- DISPATCH > Military Ball > Settings.
alter table public.ball_config add column if not exists vip_signup_deadline date;

-- 2026 ball: cadet signups closed Nov 1; VIP signups reopened through Nov 15.
update public.ball_config set vip_signup_deadline = '2026-11-15';

select signup_deadline, vip_signup_deadline from public.ball_config;
-- Expected: 2026-11-01 | 2026-11-15
