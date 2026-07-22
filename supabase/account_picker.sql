-- ============================================================================
-- PHASE 0 — ACCOUNT PICKER login feature. Schema + RLS + storage.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: admin_roles.sql (admin_roles table, is_s6() helper) already run.
--
-- WHAT THIS SETS UP:
--   • admin_roles gains display_name + photo_url (picker card fields).
--   • account_credentials  — 4-digit PIN hash + LOCKOUT state. SERVICE-ROLE ONLY.
--   • webauthn_credentials — passkey public keys. SERVICE-ROLE ONLY.
--   • login_accounts       — PUBLIC-READ view for the pre-auth picker. Exposes
--                            ONLY name/photo/email/has_pin/has_passkey. No secrets.
--   • admin-avatars bucket — public-read avatar storage.
--
-- SECURITY MODEL (read before editing):
--   PIN is 4 digits (10,000 combos) by product decision. That is only safe
--   because pin-login enforces a HARD LOCKOUT: 5 consecutive failures locks the
--   account for 15 minutes. The lockout is NOT optional polish — it is the
--   primary control that makes a 4-digit PIN acceptable. account_credentials
--   carries the counters (pin_fail_count, pin_locked_until); the pin-login edge
--   function MUST check + update them on every attempt. Never store the PIN in
--   plaintext; never expose pin_hash or the webauthn public keys to the client.
--   Only the service_role key (used inside edge functions) can read those two
--   tables — they have RLS enabled with NO client policies.
-- ============================================================================


-- ── SECTION 1 — admin_roles picker fields ───────────────────────────────────
alter table public.admin_roles
  add column if not exists display_name text,
  add column if not exists photo_url    text,
  add column if not exists title        text;   -- picker rank/position label (e.g. 'S-6', 'Deputy S-5')

-- Let the S-6 set display names / avatars from the in-app Accounts panel —
-- including for the S-5 students / Kaiden, who have no personnel row.
-- (Role is still managed in the dashboard / SQL by convention.)
--
-- SECURITY: RLS filters ROWS, not COLUMNS. `is_s6()` checks the caller, not the
-- target row, so this policy alone would let an s6 session UPDATE *any* column
-- of any row — including `role`, minting a rogue s6 backdoor. We pair the row
-- policy with a COLUMN-LEVEL GRANT so the ONLY columns an authenticated caller
-- can write are display_name + photo_url. `role` can never be changed this way.
drop policy if exists admin_roles_write_s6 on public.admin_roles;
create policy admin_roles_write_s6 on public.admin_roles
  for update to authenticated
  using (public.is_s6()) with check (public.is_s6());

revoke update on public.admin_roles from authenticated;
grant  update (display_name, photo_url, title) on public.admin_roles to authenticated;


-- ── SECTION 2 — PIN credentials + LOCKOUT state (service-role only) ──────────
-- No SELECT/INSERT/UPDATE policies for anon or authenticated on purpose: the
-- client can NEVER read a pin_hash or the lockout counters. Only edge functions
-- (service_role, which bypasses RLS) touch this table.
create table if not exists public.account_credentials (
  email            text primary key
                     references public.admin_roles(email) on delete cascade,
  pin_hash         text,                       -- bcrypt hash of the 4-digit PIN
  pin_fail_count   integer     not null default 0 check (pin_fail_count >= 0),
  pin_locked_until timestamptz,                -- non-null + future => locked
  updated_at       timestamptz not null default now()
);
alter table public.account_credentials enable row level security;
-- (intentionally no policies — service_role only)
-- Defense in depth: RLS blocks ROWS, but Supabase auto-GRANTs select/insert/etc
-- on new public-schema tables to anon/authenticated. For a table holding PIN
-- hashes + lockout state that grant must not exist — revoke it so the secret is
-- protected by BOTH the missing grant and RLS, not RLS alone.
revoke all on public.account_credentials from anon, authenticated;

-- Atomic lockout primitive. The 4-digit PIN is only safe because of the hard
-- lockout, so the counter MUST be race-free: a read-then-write in the edge
-- function could let concurrent guesses slip past the 5-try threshold. A single
-- UPDATE ... WHERE email row-locks for the txn, so concurrent calls serialize.
-- pin-login MUST call THIS (never hand-roll the increment). SECURITY DEFINER so
-- the edge function's service_role — or any future caller — hits one safe path.
--   p_success = true  -> reset counter + clear lock (correct PIN)
--   p_success = false -> increment; at 5 fails, lock for 15 minutes
create or replace function public.record_pin_attempt(p_email text, p_success boolean)
returns table(fail_count integer, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_success then
    update public.account_credentials
      set pin_fail_count = 0, pin_locked_until = null, updated_at = now()
      where lower(email) = lower(p_email);
  else
    update public.account_credentials
      set pin_fail_count = pin_fail_count + 1,
          pin_locked_until = case when pin_fail_count + 1 >= 5
                                  then now() + interval '15 minutes'
                                  else pin_locked_until end,
          updated_at = now()
      where lower(email) = lower(p_email);
  end if;
  return query
    select ac.pin_fail_count, ac.pin_locked_until
    from public.account_credentials ac where lower(ac.email) = lower(p_email);
end $$;

-- ── Concurrency-proof lockout: reserve BEFORE verify ────────────────────────
-- record_pin_attempt (below) updates the counter atomically, but pin-login used
-- to CHECK the lock with a separate non-locking SELECT before verifying the PIN.
-- A concurrent burst could all pass that stale check and verify N PINs before
-- the counter serialized — slipping past the 5-guess cap that a 4-digit PIN
-- depends on. The reserve pattern closes this: a single row-locked UPDATE
-- decides "may this attempt proceed" and increments optimistically (as if the
-- attempt fails) BEFORE any PIN is verified. Concurrent callers serialize on the
-- FOR UPDATE row lock, so the 6th sees count=5 and is rejected before verifying.
--   • allowed=false  -> locked (or no credential row) — caller must NOT verify
--   • allowed=true   -> proceed to verify; failure already recorded, success
--                       must call reset_pin_attempts to zero the counter
-- A lock whose window has expired starts a fresh count (base 0) on this attempt.
create or replace function public.reserve_pin_attempt(p_email text)
returns table(allowed boolean, fail_count integer, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_count  integer;
  v_locked timestamptz;
  v_base   integer;
  v_new    integer;
  v_lock   timestamptz;
begin
  select ac.pin_fail_count, ac.pin_locked_until into v_count, v_locked
    from public.account_credentials ac
    where lower(ac.email) = lower(p_email)
    for update;                                   -- serialize concurrent attempts

  if not found then
    return query select false, null::integer, null::timestamptz;   -- no PIN set
    return;
  end if;

  if v_locked is not null and v_locked > now() then
    return query select false, v_count, v_locked;                  -- still locked
    return;
  end if;

  -- Never locked, or the lock has expired (expired → fresh window from 0).
  v_base := case when v_locked is not null then 0 else v_count end;
  v_new  := v_base + 1;
  v_lock := case when v_new >= 5 then now() + interval '15 minutes' else null end;

  update public.account_credentials
    set pin_fail_count = v_new, pin_locked_until = v_lock, updated_at = now()
    where lower(email) = lower(p_email);

  return query select true, v_new, v_lock;
end $$;

-- Called ONLY after a verified-correct PIN, to clear the optimistic increment.
create or replace function public.reset_pin_attempts(p_email text)
returns void language sql security definer set search_path = public as $$
  update public.account_credentials
    set pin_fail_count = 0, pin_locked_until = null, updated_at = now()
    where lower(email) = lower(p_email);
$$;

-- Same PUBLIC-revoke rule as record_pin_attempt: both take an attacker-supplied
-- p_email and are SECURITY DEFINER, so they must NOT be reachable via PostgREST.
revoke execute on function public.reserve_pin_attempt(text) from public;
revoke execute on function public.reset_pin_attempts(text) from public;
revoke all     on function public.reserve_pin_attempt(text) from anon, authenticated;
revoke all     on function public.reset_pin_attempts(text) from anon, authenticated;

-- Not callable by the public API — edge functions invoke it with service_role.
-- CRITICAL: revoking from anon/authenticated ALONE is not enough. CREATE FUNCTION
-- implicitly grants EXECUTE to PUBLIC, and anon/authenticated inherit it through
-- PUBLIC — the per-role revoke below does not touch that PUBLIC grant. Without
-- the PUBLIC revoke, any anon caller could invoke this via PostgREST
-- (/rest/v1/rpc/record_pin_attempt) with an arbitrary p_email and, because it is
-- SECURITY DEFINER, read back the lockout counters, force-lock all 5 admins
-- (login DoS), or reset a lockout mid-attack — defeating the ONLY control that
-- makes a 4-digit PIN acceptable. Revoke from PUBLIC first.
revoke execute on function public.record_pin_attempt(text, boolean) from public;
revoke all    on function public.record_pin_attempt(text, boolean) from anon, authenticated;


-- ── SECTION 3 — WebAuthn / passkey credentials (service-role only) ──────────
create table if not exists public.webauthn_credentials (
  id            uuid primary key default gen_random_uuid(),
  account_email text not null
                  references public.admin_roles(email) on delete cascade,
  credential_id text not null unique,          -- base64url credential id
  public_key    text not null,                 -- base64url COSE public key
  counter       bigint not null default 0,     -- signature counter (clone detect)
  transports    text[],
  label         text,                          -- e.g. "Luke's MacBook"
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists webauthn_credentials_email_idx
  on public.webauthn_credentials(account_email);
alter table public.webauthn_credentials enable row level security;
-- (intentionally no policies — service_role only)
-- Same defense-in-depth revoke: strip the Supabase default grant so the passkey
-- public keys / counters are unreachable at the grant level too, not just RLS.
revoke all on public.webauthn_credentials from anon, authenticated;


-- ── SECTION 4 — public picker view ──────────────────────────────────────────
-- Runs with the view owner's privileges (security_invoker OFF), so it can read
-- the locked tables above and surface ONLY safe fields. Anon reads this to draw
-- the 5 cards before anyone logs in. Deliberately exposes email + display_name
-- (accepted enumeration for a 5-admin set). NEVER add pin_hash / public_key here.
create or replace view public.login_accounts
with (security_invoker = false) as
  select
    a.email,
    a.display_name,
    a.photo_url,
    a.title,
    (c.pin_hash is not null)                                as has_pin,
    exists (select 1 from public.webauthn_credentials w
            where w.account_email = a.email)               as has_passkey
  from public.admin_roles a
  left join public.account_credentials c on c.email = a.email;

grant select on public.login_accounts to anon, authenticated;


-- ── SECTION 5 — avatar storage bucket ───────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('admin-avatars', 'admin-avatars', true)
on conflict (id) do nothing;

-- Public read (bucket is public); only signed-in S-6 may upload/replace/delete.
drop policy if exists admin_avatars_read   on storage.objects;
drop policy if exists admin_avatars_write  on storage.objects;
drop policy if exists admin_avatars_update on storage.objects;
drop policy if exists admin_avatars_delete on storage.objects;

create policy admin_avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'admin-avatars');
-- Images only. The bucket is PUBLIC-READ, so an uploaded SVG (which can carry
-- inline script) would be a stored-XSS vector served from our origin — restrict
-- to raster image mime types at write time.
create policy admin_avatars_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'admin-avatars' and public.is_s6()
              and (metadata->>'mimetype') in ('image/png','image/jpeg','image/webp','image/gif'));
create policy admin_avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'admin-avatars' and public.is_s6())
  with check (bucket_id = 'admin-avatars' and public.is_s6()
              and (metadata->>'mimetype') in ('image/png','image/jpeg','image/webp','image/gif'));
create policy admin_avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'admin-avatars' and public.is_s6());


-- ── SECTION 6 — seed roster: name + title + photo ───────────────────────────
-- Fills the picker cards for the current staff. COALESCE means a re-run only
-- fills BLANK fields — it never clobbers a name/title/photo later edited from
-- the Accounts panel. Photos point at the existing public cadet-photos bucket
-- (project tpracdgjahzmqtzjsiol); swap these URLs if the photos are migrated
-- into this project's admin-avatars bucket. Adjust names/titles as roles change.
do $$
declare r record;
begin
  for r in
    select * from (values
      ('lukevetsch77@gmail.com',    'Luke Vetsch',      'Assistant S-6, Developer', 'https://tpracdgjahzmqtzjsiol.supabase.co/storage/v1/object/public/cadet-photos/53871977-f03b-4b60-925f-6c294aecd702.jpg'),
      ('kg36247@students.hcde.org', 'Kaiden Gray',      'S-6',                      'https://tpracdgjahzmqtzjsiol.supabase.co/storage/v1/object/public/cadet-photos/344a959f-9c28-4a79-9784-03a6d898090e.jpg'),
      ('mm25867@students.hcde.org', 'Michael McCauley', 'Deputy S-5',               'https://tpracdgjahzmqtzjsiol.supabase.co/storage/v1/object/public/cadet-photos/43aae1e5-d379-4d8a-8109-257c159badda.jpg'),
      ('dz37204@students.hcde.org', 'Danielle',         'Assistant S-5',            'https://tpracdgjahzmqtzjsiol.supabase.co/storage/v1/object/public/cadet-photos/8acd93bd-5d82-4f27-92d7-864b08b0f85c.jpg'),
      ('aj49377@students.hcde.org', 'Aaron',            'S-5',                      'https://tpracdgjahzmqtzjsiol.supabase.co/storage/v1/object/public/cadet-photos/4ea5e940-8d4e-41e1-8143-3e0b8eb82400.jpg')
    ) as s(email, display_name, title, photo_url)
  loop
    update public.admin_roles a set
      display_name = coalesce(a.display_name, r.display_name),
      title        = coalesce(a.title,        r.title),
      photo_url    = coalesce(a.photo_url,    r.photo_url)
    where lower(a.email) = lower(r.email);
  end loop;
end $$;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   -- anon can read the picker, but no secrets leak:
--   select * from public.login_accounts;                    -- name/photo/bools
--   select has_table_privilege('anon','account_credentials','select'); -- false
--   select has_table_privilege('anon','webauthn_credentials','select');-- false
--   -- CRITICAL check: the lockout fn must NOT be callable by the public API:
--   select has_function_privilege('anon','public.record_pin_attempt(text,boolean)','execute');          -- false
--   select has_function_privilege('authenticated','public.record_pin_attempt(text,boolean)','execute'); -- false
--   -- the picker view must be owned by a role that bypasses RLS on the locked
--   -- tables (normally 'postgres' when run from the SQL editor); if this ever
--   -- shows a lesser role, has_pin/has_passkey will fail-CLOSED (error), not leak:
--   select viewowner from pg_views where viewname = 'login_accounts';
-- ============================================================================
