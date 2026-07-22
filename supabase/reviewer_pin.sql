-- ============================================================================
-- EMAIL REVIEW PORTAL — optional 4-digit PIN login for reviewers. Run in the
-- Supabase SQL editor. Idempotent. Depends on email_review.sql (email_reviewers,
-- is_reviewer()).
--
-- WHY A SEPARATE TABLE FROM account_credentials: account_credentials.email has
-- a hard FK to admin_roles(email) on delete cascade. Reviewers are a distinct
-- population (email_reviewers), not admin_roles, so the same table can't FK to
-- both. This mirrors account_credentials' shape and EVERY security property
-- exactly (service-role only, zero client policies, atomic reserve-before-verify
-- lockout, PUBLIC execute revoked on the SECURITY DEFINER functions) under a
-- parallel table + parallel functions — a bug in one population's lockout logic
-- can never touch the other's.
--
-- SECURITY MODEL (identical to account_picker.sql — read that file's header
-- too): the PIN is 4 digits (10,000 combos), which is only acceptable because
-- of the HARD LOCKOUT: 5 consecutive failures locks the account for 15
-- minutes. Never store the PIN in plaintext; never expose pin_hash to the
-- client. Only the service_role key (used inside edge functions) can read
-- reviewer_credentials — RLS is enabled with NO client policies.
-- ============================================================================


-- ── SECTION 1 — PIN credentials + lockout state (service-role only) ──────────
create table if not exists public.reviewer_credentials (
  email            text primary key
                     references public.email_reviewers(email) on delete cascade,
  pin_hash         text,
  pin_fail_count   integer     not null default 0 check (pin_fail_count >= 0),
  pin_locked_until timestamptz,
  updated_at       timestamptz not null default now()
);
alter table public.reviewer_credentials enable row level security;
-- (intentionally no policies — service_role only)
revoke all on public.reviewer_credentials from anon, authenticated;


-- Atomic lockout primitive — same reserve-before-verify shape as
-- account_picker.sql's reserve_pin_attempt/reset_pin_attempts, renamed with a
-- reviewer_ prefix so the two populations can never be pointed at each
-- other's table by a copy-paste mistake down the line.
--   • allowed=false  -> locked (or no credential row) — caller must NOT verify
--   • allowed=true   -> proceed to verify; failure already recorded, success
--                       must call reviewer_reset_pin_attempts to zero it
create or replace function public.reviewer_reserve_pin_attempt(p_email text)
returns table(allowed boolean, fail_count integer, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_count  integer;
  v_locked timestamptz;
  v_base   integer;
  v_new    integer;
  v_lock   timestamptz;
begin
  select rc.pin_fail_count, rc.pin_locked_until into v_count, v_locked
    from public.reviewer_credentials rc
    where lower(rc.email) = lower(p_email)
    for update;

  if not found then
    return query select false, null::integer, null::timestamptz;
    return;
  end if;

  if v_locked is not null and v_locked > now() then
    return query select false, v_count, v_locked;
    return;
  end if;

  v_base := case when v_locked is not null then 0 else v_count end;
  v_new  := v_base + 1;
  v_lock := case when v_new >= 5 then now() + interval '15 minutes' else null end;

  update public.reviewer_credentials
    set pin_fail_count = v_new, pin_locked_until = v_lock, updated_at = now()
    where lower(email) = lower(p_email);

  return query select true, v_new, v_lock;
end $$;

create or replace function public.reviewer_reset_pin_attempts(p_email text)
returns void language sql security definer set search_path = public as $$
  update public.reviewer_credentials
    set pin_fail_count = 0, pin_locked_until = null, updated_at = now()
    where lower(email) = lower(p_email);
$$;

-- CRITICAL (same catch the original security review made on the admin
-- version): CREATE FUNCTION implicitly grants EXECUTE to PUBLIC, and
-- anon/authenticated inherit it through PUBLIC — revoking from those two
-- roles alone is NOT enough. Without the PUBLIC revoke, any anon caller could
-- invoke this via PostgREST (/rest/v1/rpc/reviewer_reserve_pin_attempt) with
-- an arbitrary p_email and, being SECURITY DEFINER, read back lockout
-- counters or force-lock all 3 reviewers (login DoS) — defeating the ONLY
-- control that makes a 4-digit PIN acceptable.
revoke execute on function public.reviewer_reserve_pin_attempt(text) from public;
revoke execute on function public.reviewer_reset_pin_attempts(text) from public;
revoke all     on function public.reviewer_reserve_pin_attempt(text) from anon, authenticated;
revoke all     on function public.reviewer_reset_pin_attempts(text) from anon, authenticated;


-- ── SECTION 2 — reviewer_has_pin() — self-only status check ──────────────────
-- Parameterless, reads only the caller's own JWT email — same safety shape as
-- is_reviewer(). Cannot be pointed at another reviewer. Lets the portal's
-- settings panel show "set" vs "none" without ever granting a client SELECT
-- policy on reviewer_credentials.
create or replace function public.reviewer_has_pin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reviewer_credentials
    where lower(email) = lower(auth.jwt() ->> 'email') and pin_hash is not null
  );
$$;

-- ── verify after running ─────────────────────────────────────────────────────
--   select has_table_privilege('anon','reviewer_credentials','select');  -- false
--   select has_table_privilege('authenticated','reviewer_credentials','select'); -- false
--   select has_function_privilege('anon','public.reviewer_reserve_pin_attempt(text)','execute');          -- false
--   select has_function_privilege('authenticated','public.reviewer_reserve_pin_attempt(text)','execute'); -- false
-- ============================================================================
