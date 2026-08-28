-- ============================================================================
-- BC account — force a password reset on next login + roll the password
-- back to a temporary value.
-- Run in the Supabase SQL editor. Idempotent. Run AFTER dispatch_bc_role.sql
-- (and bc_no_forced_reset.sql, if that was already applied).
--
-- Target: ao34967@student.hcde.org  (Aiden O'Brien, TV Remote only)
--
-- AFTER THIS:
--   • His password is TEMP_PASSWORD below again — hand it to him directly.
--   • His next login lands on the "set your password" screen before the
--     TV Remote loads (admin_roles.must_change_password = true).
--   • Any session he currently has is killed, so the change takes effect on
--     his next request, not whenever his old JWT happens to expire.
--
-- To use a different temp password, edit the string in SECTION 2 before running.
--
-- NOTE ON THE LOOP: bc_no_forced_reset.sql (if run) exempted this email from
-- the on_admin_password_changed re-arm trigger. That exemption is LEFT IN
-- PLACE here on purpose — it means this one forced reset happens once and the
-- gate is cleared by the normal first-login flow (complete-admin-first-login
-- edge function) without re-arming every subsequent login. If he somehow gets
-- stuck on the password screen again, re-run SECTION 1 of bc_no_forced_reset.sql
-- (the single UPDATE that sets must_change_password = false).
-- ============================================================================


-- ── SECTION 1 — re-arm the forced-change gate ─────────────────────────────
update public.admin_roles
  set must_change_password = true
  where lower(email) = 'ao34967@student.hcde.org';


-- ── SECTION 2 — roll the Supabase Auth password back to the temp value ────
-- Direct auth.users write using pgcrypto bcrypt (same hash format GoTrue
-- writes). Fine for an admin-set temp password. If you'd rather not touch
-- auth.* directly, skip this section and instead: Dashboard → Authentication
-- → Users → ao34967@student.hcde.org → Edit user → set the password there.
--
-- pgcrypto lives in the `extensions` schema on Supabase. If crypt()/gen_salt()
-- aren't found, run:  create extension if not exists pgcrypto with schema extensions;
update auth.users
  set encrypted_password = extensions.crypt('TrojanRange-4471', extensions.gen_salt('bf')),
      updated_at = now()
  where lower(email) = 'ao34967@student.hcde.org';


-- ── SECTION 3 — kill his existing sessions ────────────────────────────────
-- So the new password + the gate take effect immediately. Safe if there are
-- no rows. (auth.sessions exists on current GoTrue; if your project predates
-- it, this is a no-op / drop it.)
delete from auth.sessions
  where user_id = (
    select id from auth.users where lower(email) = 'ao34967@student.hcde.org'
  );


-- ============================================================================
-- VERIFY:
--   select email, must_change_password from public.admin_roles
--     where lower(email) = 'ao34967@student.hcde.org';        -- expect: true
--   -- then sign in as Aiden with the temp password ->
--   -- "set your password" screen -> then the Range TV Remote.
-- ============================================================================
