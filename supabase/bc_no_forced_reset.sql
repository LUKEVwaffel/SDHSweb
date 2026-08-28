-- ============================================================================
-- BC account - stop the forced-password-reset loop.
-- Run in the Supabase SQL editor. Idempotent. Run AFTER admin_password_gate.sql
-- and dispatch_bc_role.sql.
--
-- SYMPTOM: ao34967@student.hcde.org is asked to set a new password on EVERY
-- login, not just the first.
--
-- CAUSE: admin_password_gate.sql adds an auth.users trigger
-- (on_admin_password_changed) that re-arms admin_roles.must_change_password
-- every time an account's password changes - for everyone except
-- lukevetsch77@gmail.com. The first-login flow calls
-- supabase.auth.updateUser({password}) and then a best-effort edge function
-- (complete-admin-first-login) to clear the flag again. If that edge call
-- doesn't land (not deployed / errored - the UI only shows "Continuing
-- anyway"), the re-armed flag sticks and the gate fires again next login.
--
-- FIX: give the BC account the same permanent exemption Luke has, and clear
-- the flag now.
--
-- SECURITY NOTE: this removes the forced-password-change safety for THIS ONE
-- low-privilege account (TV Remote only). The temp password shipped in
-- dispatch_bc_role.sql's comments is therefore still usable - after running
-- this, reset Aiden's password once from Auth -> Users and hand him the new
-- one directly. With the exemption below, that reset will NOT re-trigger the
-- loop.
-- ============================================================================

-- ── 1. Clear the flag now (covers an already-stuck account) ────────────────
update public.admin_roles
  set must_change_password = false
  where lower(email) = 'ao34967@student.hcde.org';

-- ── 2. Permanent exemption from the re-arm trigger ────────────────────────
-- Same shape as admin_password_gate.sql SECTION 3, with the BC email added to
-- the exclusion list so future dashboard password resets never re-arm it.
create or replace function public.admin_password_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and lower(new.email) <> 'lukevetsch77@gmail.com'
     and lower(new.email) <> 'ao34967@student.hcde.org' then
    update public.admin_roles
      set must_change_password = true
      where lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;

-- Trigger definition itself is unchanged (admin_password_gate.sql SECTION 3);
-- re-create it here only so this file stands alone if run on a fresh DB.
drop trigger if exists on_admin_password_changed on auth.users;
create trigger on_admin_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.admin_password_changed();

-- ============================================================================
-- VERIFY:
--   select email, role, must_change_password from public.admin_roles
--     where lower(email) = 'ao34967@student.hcde.org';   -- expect false
--   -- log in as Aiden: straight to the TV Remote, no password screen.
-- ============================================================================
