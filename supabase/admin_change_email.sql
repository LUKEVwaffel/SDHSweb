-- ============================================================================
-- ADMIN LOGIN-EMAIL CHANGE — one-off migration helper (Luke, 2026-09-02).
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- CONTEXT: two S-5 accounts move off school addresses (access going away) onto
-- personal Gmail:
--     dz37204@students.hcde.org  → daniellezonato9@gmail.com   (Danielle, Assistant S-5)
--     aj49377@students.hcde.org  → aaronpatj23@gmail.com        (Aaron, S-5)
--
-- admin_roles.email is the PRIMARY KEY and the join key for PIN/passkey creds,
-- DISPATCH chat, presence, and AAR ownership — so this is a coordinated move,
-- not a field edit. This file provides admin_change_email_migrate(old,new),
-- which does the DB half atomically. The auth.users.email half is done by the
-- `admin-change-email` edge function (svc.auth.admin.updateUserById with
-- email_confirm:true — no verification email, password preserved) which calls
-- this function right after.
--
-- WHY email_confirm:true matters: a normal email-change flow mails confirm
-- links to BOTH the old and new addresses and stalls until clicked — the old
-- school inboxes are being lost, so that path would strand the accounts.
--
-- must_change_password is NOT re-armed: the on_admin_password_changed trigger
-- (admin_password_gate.sql) fires on encrypted_password only; changing the
-- email never touches it. Both rows are already must_change_password=false and
-- stay that way — no forced reset, confirmed with Luke.
--
-- SECURITY: SECURITY DEFINER + caller-supplied emails, so it must NOT be
-- reachable from PostgREST. Execute is revoked from anon/authenticated/public;
-- only the service-role edge function calls it.
-- ============================================================================

create or replace function public.admin_change_email_migrate(p_old text, p_new text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text := lower(trim(p_old));
  v_new text := lower(trim(p_new));
begin
  if v_old = '' or v_new = '' or v_old = v_new then
    raise exception 'old and new emails are required and must differ';
  end if;

  -- Already migrated (new row present, old gone) → no-op so a re-run is safe.
  if exists (select 1 from public.admin_roles where lower(email) = v_new)
     and not exists (select 1 from public.admin_roles where lower(email) = v_old) then
    return 'noop: already migrated';
  end if;

  if not exists (select 1 from public.admin_roles where lower(email) = v_old) then
    raise exception 'no admin_roles row for %', v_old;
  end if;
  if exists (select 1 from public.admin_roles where lower(email) = v_new) then
    raise exception 'an admin_roles row already exists for %', v_new;
  end if;

  -- 1. New role row — copy every profile/gate column off the old one.
  insert into public.admin_roles
    (email, role, created_at, display_name, photo_url, title,
     must_change_password, can_override_review)
  select v_new, role, now(), display_name, photo_url, title,
         must_change_password, can_override_review
  from public.admin_roles where lower(email) = v_old;

  -- 2. Re-point PIN + passkey credentials (FK to admin_roles(email)).
  update public.account_credentials  set email = v_new         where lower(email) = v_old;
  update public.webauthn_credentials set account_email = v_new where lower(account_email) = v_old;

  -- 3. DISPATCH chat + presence + AAR ownership (plain text columns, no FK
  --    except admin_presence which now has its new parent row from step 1).
  update public.conversation_participants set email = v_new        where lower(email) = v_old;
  update public.messages                  set sender_email = v_new where lower(sender_email) = v_old;
  update public.conversations             set created_by = v_new   where lower(created_by) = v_old;
  update public.admin_presence            set email = v_new        where lower(email) = v_old;
  update public.aars                      set created_by = v_new   where lower(created_by) = v_old;
  update public.aars                      set archived_by = v_new  where lower(archived_by) = v_old;

  -- 4. Drop the old role row last (its FK children are all re-pointed now, so
  --    the ON DELETE CASCADE has nothing left to take).
  delete from public.admin_roles where lower(email) = v_old;

  return 'migrated ' || v_old || ' -> ' || v_new;
end $$;

revoke all on function public.admin_change_email_migrate(text, text) from public, anon, authenticated;

-- ============================================================================
-- VERIFY AFTER THE EDGE FUNCTION RUNS:
--   select email, role, display_name, title from public.admin_roles
--     where email in ('daniellezonato9@gmail.com','aaronpatj23@gmail.com');   -- both, role=s5
--   select email from public.admin_roles
--     where email in ('dz37204@students.hcde.org','aj49377@students.hcde.org'); -- 0 rows
--   select count(*) from public.messages
--     where sender_email in ('dz37204@students.hcde.org','aj49377@students.hcde.org'); -- 0
--   -- confirm auth side (Supabase dashboard → Authentication → Users): both
--   -- Gmail addresses show as the login email, "Email confirmed" = yes.
-- ============================================================================
