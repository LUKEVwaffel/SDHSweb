-- ============================================================================
-- DISPATCH ADMIN — forced password change on first login / after any reset.
-- Run in the Supabase SQL editor. Idempotent.
--
-- Port of the email-reviewer forced-password-change feature (see
-- email_reviewer_first_login.sql + email_reviewer_password_gate_fix.sql) onto
-- the main admin_roles population (Kaiden, Aaron, Danielle, Michael, Luke).
-- That port was planned when the reviewer version shipped but never actually
-- built — this file is that missing piece.
--
-- WHAT THIS ADDS:
--   • admin_roles.must_change_password — true means the account is on a
--     dashboard-set temp password and must set its own before doing anything
--     else. Cleared server-side (never by the client) by the
--     complete-admin-first-login edge function once
--     supabase.auth.updateUser({ password }) has succeeded.
--   • admin_role() (the function every admin RLS policy derives from via
--     is_s6()/is_s5()/is_admin()) now returns NULL — i.e. "no role" — for a
--     gated account. This is the single choke point: every RLS-protected
--     DISPATCH table locks out automatically the instant the flag is true,
--     with no per-table policy edits needed.
--   • An auth.users trigger re-arms the flag on ANY password change for an
--     admin_roles email, so a future dashboard reset can never silently leave
--     the gate disabled again (the exact failure mode fixed for the reviewer
--     population in email_reviewer_password_gate_fix.sql).
--   • login_accounts view gains must_change_password so the picker can hide
--     the PIN/passkey buttons for a gated account and go straight to
--     password — a UX nicety layered on top of the real server-side block in
--     pin-login / passkey-login / set-pin / passkey-register (edited
--     separately, not in this file).
--
-- PERMANENT EXEMPTION: lukevetsch77@gmail.com only. Hardcoded, matching this
-- codebase's existing convention for the one-off admin seed
-- (admin_roles.sql SECTION 1) and the one-off reviewer backfill
-- (email_reviewer_first_login.sql). Both the backfill below and the trigger
-- exclude this email explicitly — belt and suspenders, not just relying on
-- the trigger never touching it.
-- ============================================================================


-- ── SECTION 1 — the column + backfill ───────────────────────────────────────
alter table public.admin_roles
  add column if not exists must_change_password boolean not null default true;

-- Luke's account: never gated. Explicit false, independent of the trigger's
-- exclusion below — if the trigger is ever missing/broken, this row still
-- reads correctly.
update public.admin_roles set must_change_password = false
  where email = 'lukevetsch77@gmail.com';

-- The 4 DISPATCH admin accounts just had their passwords reset to fresh temp
-- values (2026-07-28) with no login yet on the new password. The column
-- default (true) already covers them, but the reset happened BEFORE this
-- column/trigger existed, so no trigger ever ran for it — explicit backfill
-- so this doesn't depend on default-value timing.
update public.admin_roles set must_change_password = true
  where email in (
    'kg36247@students.hcde.org',  -- Kaiden Gray
    'aj49377@students.hcde.org',  -- Aaron
    'dz37204@students.hcde.org',  -- Danielle
    'mm25867@students.hcde.org'   -- Michael McCauley
  );

-- ── SECTION 2 — enforce the gate at the RLS layer ───────────────────────────
-- SECURITY: is_s6() / is_s5() / is_admin() (admin_roles.sql SECTION 2) all
-- derive from admin_role(), and every RLS-protected admin table in this
-- codebase gates on one of those three. Redefining admin_role() to return
-- NULL for a gated account cascades the block DISPATCH-wide in one place —
-- the same pattern used for is_reviewer() in
-- email_reviewer_first_login.sql SECTION 2, but here it's even broader
-- because admin_role() is the shared root of all three gate functions.
create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admin_roles
  where lower(email) = lower(auth.jwt() ->> 'email')
    and not must_change_password
  limit 1;
$$;

-- ── SECTION 3 — auto re-arm the gate on any password change ────────────────
-- Same trigger shape as reviewer_password_changed() in
-- email_reviewer_password_gate_fix.sql: ANY change to an admin_roles email's
-- Supabase Auth password (dashboard reset, future self-service reset flow)
-- re-arms must_change_password automatically. No manual runbook step to
-- forget — that's precisely how this gap went unnoticed for the 4 accounts.
-- lukevetsch77@gmail.com is excluded here too (permanent exemption).
create or replace function public.admin_password_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and lower(new.email) <> 'lukevetsch77@gmail.com' then
    update public.admin_roles
      set must_change_password = true
      where lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_admin_password_changed on auth.users;
create trigger on_admin_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.admin_password_changed();

-- ── SECTION 4 — expose the flag on the public picker view ──────────────────
-- Not a secret (same exposure class as the existing has_pin/has_passkey
-- booleans) — lets AccountAuth.jsx suppress PIN/passkey login buttons and
-- jump straight to password for a gated account, before any auth attempt.
-- The real control is server-side (pin-login / passkey-login / set-pin /
-- passkey-register); this only makes the UI stop offering a method the
-- server will reject anyway.
create or replace view public.login_accounts
with (security_invoker = false) as
  select
    a.email,
    a.display_name,
    a.photo_url,
    a.title,
    (c.pin_hash is not null)                                as has_pin,
    exists (select 1 from public.webauthn_credentials w
            where w.account_email = a.email)               as has_passkey,
    a.must_change_password
  from public.admin_roles a
  left join public.account_credentials c on c.email = a.email;

grant select on public.login_accounts to anon, authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select email, must_change_password from public.admin_roles order by email;
--     -- expect: lukevetsch77@gmail.com = false, the other 4 = true
--   select tgname from pg_trigger where tgname = 'on_admin_password_changed';
--   -- gated account should read no role (run as that account, expect null):
--   select public.admin_role();
-- ============================================================================
