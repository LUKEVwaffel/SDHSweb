-- ============================================================================
-- BALL DRESS/ATTIRE APPROVAL — FULL DIAGNOSTIC. Read-only, no writes. Run each
-- section in the Supabase SQL editor (project bjgyvmdzcymruunzavni) and paste
-- back the results. Goal: find why Aubry's approve clicks silently do
-- nothing, and confirm Kylie / Weston / Luke aren't exposed to the same bug.
-- ============================================================================

-- 1) THE ROSTER — every dress/attire account, exactly as the DB sees it.
--    Check: role is 'female_dress' or 'male_guest_attire' (not null/typo'd),
--    active = true for everyone who should be working, email has no stray
--    whitespace or capitalization that wouldn't match a lower()'d JWT claim.
select email, name, role, active, (pin_hash is not null) as has_pin,
       pin_locked_until, updated_at
from public.ball_dress_staff
order by role, name;

-- 2) DOES EACH ACCOUNT HAVE A REAL SUPABASE AUTH USER?
--    ball-dress-set-pin is supposed to create one for every row above. If a
--    row exists here with no matching auth.users row, that account's
--    ball-dress-email-login will fail to mint a session at all (different
--    failure than "click does nothing" — but worth ruling out for all four).
select s.email as staff_email, s.role, s.active,
       u.id as auth_user_id, u.email as auth_email, u.email_confirmed_at,
       u.banned_until, u.created_at as auth_created_at
from public.ball_dress_staff s
left join auth.users u on lower(u.email) = lower(s.email)
order by s.role, s.name;

-- 3) is_ball_dress() / is_ball_attire() — THE ACTUAL LIVE DEFINITION.
--    Compare this against supabase/ball_guards.sql. If it's missing the
--    "and role = 'female_dress'" (or male_guest_attire) clause, or looks like
--    an older/simpler version, an earlier file clobbered the authoritative one.
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_ball_dress', 'is_ball_attire', 'ball_guard_version');

-- 4) WHICH GUARD VERSION IS ACTUALLY LIVE.
--    ball_guards.sql is supposed to be authoritative — this number should
--    match its latest version. If ball_guard_version() doesn't exist at all,
--    ball_guards.sql was never run and every legacy is_ball_dress() definition
--    in ball_signup.sql / ball_finalize.sql is live instead (whichever was
--    pasted into the SQL editor LAST, in whatever order that happened).
select public.ball_guard_version();

-- 5) COLUMN-GUARD TRIGGERS — do they exist and point at the current function?
select event_object_table, trigger_name, action_timing, event_manipulation,
       action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('ball_signups', 'ball_guests', 'ball_vip_signups', 'ball_vip_dates')
order by event_object_table, trigger_name;

-- 6) RLS POLICIES — UPDATE access on every table a dress/attire approver
--    needs to write to. Confirm each has a policy whose USING/WITH CHECK
--    calls is_ball_dress() (or is_ball_attire() for the male-guest table).
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('ball_signups', 'ball_guests', 'ball_vip_signups', 'ball_vip_dates')
order by tablename, policyname;

-- 7) RLS actually enabled? (a table with RLS off + no policy would ALLOW
--    everything, not block it — but worth confirming nothing is misconfigured
--    the other way, e.g. FORCE ROW LEVEL SECURITY blocking the table owner.)
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('ball_signups', 'ball_guests', 'ball_vip_signups', 'ball_vip_dates')
  and relnamespace = 'public'::regnamespace;

-- 8) THE DRESS VIEWS — definitions as they exist right now (catches a stale
--    view from before ball_dress_phone.sql / ball_dress_guest_verified.sql,
--    or a security_invoker view that silently applies the VIEWER's RLS
--    instead of the approver's).
select viewname, definition
from pg_views
where schemaname = 'public'
  and viewname in ('ball_signups_dress_view', 'ball_guests_dress_view',
                    'ball_vip_signups_dress_view', 'ball_vip_dates_dress_view');

select c.relname, c.reloptions
from pg_class c
where c.relname in ('ball_signups_dress_view', 'ball_guests_dress_view',
                     'ball_vip_signups_dress_view', 'ball_vip_dates_dress_view')
  and c.relnamespace = 'public'::regnamespace;

-- 9) SPOT-CHECK: as each specific approver, would is_ball_dress()/is_ball_attire()
--    actually return true? Run these ONE AT A TIME by setting the JWT claim to
--    each email, since is_ball_dress() reads auth.jwt() ->> 'email'. This is
--    the closest a SQL-editor session (which has no real JWT) can get to
--    simulating their session — treat it as a sanity check, not proof, since
--    security definer functions still run as the editor's own DB role.
--    Emails to try: agillott1414@gmail.com (Aubry), kylierocks404@gmail.com
--    (Kylie), westonn1217@gmail.com (Weston), lukevetsch77@gmail.com (Luke).
select set_config('request.jwt.claims', '{"email":"agillott1414@gmail.com"}', true);
select public.is_ball_dress() as aubry_is_ball_dress;

select set_config('request.jwt.claims', '{"email":"kylierocks404@gmail.com"}', true);
select public.is_ball_dress() as kylie_is_ball_dress;

select set_config('request.jwt.claims', '{"email":"westonn1217@gmail.com"}', true);
select public.is_ball_attire() as weston_is_ball_attire;
