-- ============================================================================
-- RIFLE ADMIN PORTAL — Makaio Roos's standalone portal at /rifle/portal.
-- Run in the Supabase SQL editor. Idempotent.
--
-- WHAT THIS ADDS:
--   • rifle_admins            — separate population from admin_roles (DISPATCH
--     staff) and email_reviewers (Kaz/Chief). Deliberately its own table, NOT
--     a new admin_roles.role value — a bug in this feature must never be able
--     to touch admin_role()/is_s6()/is_s5() or show up in the DISPATCH login
--     picker (login_accounts). Same isolation posture as ball_dress_staff.
--   • rifle_account_credentials — 4-digit PIN hash + lockout state, own table
--     (account_credentials FKs to admin_roles, so it can't be reused here).
--     SERVICE-ROLE ONLY, same shape as account_credentials.
--   • is_rifle_admin()         — RLS gate for the rifle domain tables below.
--     Bakes in "not must_change_password" from day one (the email_reviewers
--     population needed a follow-up security fix for this — see
--     email_reviewer_first_login.sql SECTION 2 — so it starts correct here).
--   • rifle_shooters / rifle_matches / rifle_scores — public-read (site +
--     SNIPED display), rifle-admin-or-s6 write.
--   • rifle_comp_uploads      — Kaz's raw CSV dump + the AI-parsed draft +
--     review status. Rifle-admin-or-s6 only, no public read (holds an AI
--     draft that may be wrong until Makaio reviews it).
--
-- Auth flow (mirrors admin_password_gate.sql / email_reviewer_first_login.sql):
--   Luke creates Makaio's Supabase Auth user by hand (dashboard) with a temp
--   password, then inserts his row here with must_change_password = true
--   (the default). Makaio signs in with the temp password once, is forced to
--   set his own, and after that just uses password (or PIN, once set) like
--   any account — must_change_password is never re-armed except by an actual
--   password change (SECTION 3 trigger), so he is never asked to reset it on
--   every login.
-- ============================================================================


-- ── SECTION 1 — rifle_admins + RLS ──────────────────────────────────────────
create table if not exists public.rifle_admins (
  email                text primary key,
  display_name         text,
  active               boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now()
);

alter table public.rifle_admins enable row level security;

drop policy if exists rifle_admins_read_self on public.rifle_admins;
create policy rifle_admins_read_self on public.rifle_admins
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
-- No anon/authenticated writes — manage rows in the SQL editor / dashboard,
-- same convention as admin_roles / email_reviewers / ball_dress_staff.

-- Makaio's row — fill in his real school email, then run. Left commented so
-- this file stays idempotent-safe without a placeholder row landing in prod.
-- insert into public.rifle_admins (email, display_name) values
--   ('mroos_____@students.hcde.org', 'Makaio Roos')
-- on conflict (email) do nothing;

create or replace function public.is_rifle_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rifle_admins
    where lower(email) = lower(auth.jwt() ->> 'email') and active and not must_change_password
  );
$$;


-- ── SECTION 2 — PIN credentials + lockout (service-role only) ──────────────
create table if not exists public.rifle_account_credentials (
  email            text primary key
                     references public.rifle_admins(email) on delete cascade,
  pin_hash         text,
  pin_fail_count   integer     not null default 0 check (pin_fail_count >= 0),
  pin_locked_until timestamptz,
  updated_at       timestamptz not null default now()
);
alter table public.rifle_account_credentials enable row level security;
revoke all on public.rifle_account_credentials from anon, authenticated;

-- Same reserve-before-verify shape as reserve_pin_attempt/reset_pin_attempts
-- in account_picker.sql — see that file's comments for why the reservation
-- must happen BEFORE the PIN is verified (concurrency-proof lockout).
create or replace function public.reserve_rifle_pin_attempt(p_email text)
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
    from public.rifle_account_credentials ac
    where lower(ac.email) = lower(p_email)
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

  update public.rifle_account_credentials
    set pin_fail_count = v_new, pin_locked_until = v_lock, updated_at = now()
    where lower(email) = lower(p_email);

  return query select true, v_new, v_lock;
end $$;

create or replace function public.reset_rifle_pin_attempts(p_email text)
returns void language sql security definer set search_path = public as $$
  update public.rifle_account_credentials
    set pin_fail_count = 0, pin_locked_until = null, updated_at = now()
    where lower(email) = lower(p_email);
$$;

-- PUBLIC-revoke is the load-bearing part — see account_picker.sql's comment
-- on record_pin_attempt for why the implicit PUBLIC grant must be stripped,
-- not just the per-role ones.
revoke execute on function public.reserve_rifle_pin_attempt(text) from public;
revoke execute on function public.reset_rifle_pin_attempts(text) from public;
revoke all     on function public.reserve_rifle_pin_attempt(text) from anon, authenticated;
revoke all     on function public.reset_rifle_pin_attempts(text) from anon, authenticated;


-- ── SECTION 3 — auto re-arm the gate on any password change ────────────────
create or replace function public.rifle_admin_password_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.rifle_admins
      set must_change_password = true
      where lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_rifle_admin_password_changed on auth.users;
create trigger on_rifle_admin_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.rifle_admin_password_changed();


-- ── SECTION 4 — rifle domain data (public read, rifle-admin-or-s6 write) ───
create table if not exists public.rifle_shooters (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  rifle_no   integer,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rifle_matches (
  id         uuid primary key default gen_random_uuid(),
  week       integer not null,
  dates      text,
  opponent   text,
  location   text,
  created_at timestamptz not null default now(),
  unique (week)
);

create table if not exists public.rifle_scores (
  id          uuid primary key default gen_random_uuid(),
  shooter_id  uuid not null references public.rifle_shooters(id) on delete cascade,
  match_id    uuid not null references public.rifle_matches(id) on delete cascade,
  prone       numeric,
  standing    numeric,
  kneeling    numeric,
  total       numeric,
  bulls       integer,
  upload_id   uuid,   -- FK added in SECTION 5, after rifle_comp_uploads exists
  created_at  timestamptz not null default now(),
  unique (shooter_id, match_id)
);

do $$
declare t text;
begin
  foreach t in array array['rifle_shooters', 'rifle_matches', 'rifle_scores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_read_public', t);
    execute format($p$create policy %I on public.%I for select to anon, authenticated using (true)$p$, t||'_read_public', t);
    execute format('drop policy if exists %I on public.%I', t||'_write_admin', t);
    execute format($p$create policy %I on public.%I for all to authenticated using (public.is_rifle_admin() or public.is_s6()) with check (public.is_rifle_admin() or public.is_s6())$p$, t||'_write_admin', t);
  end loop;
end $$;


-- ── SECTION 5 — comp upload audit trail (rifle-admin-or-s6 only) ───────────
create table if not exists public.rifle_comp_uploads (
  id             uuid primary key default gen_random_uuid(),
  uploaded_by    text not null,
  raw_csv        text not null,
  draft          jsonb,             -- AI-parsed rows, pending Makaio's review
  status         text not null default 'pending_review'
                   check (status in ('pending_review', 'published', 'discarded')),
  created_at     timestamptz not null default now(),
  published_at   timestamptz
);

alter table public.rifle_comp_uploads enable row level security;
drop policy if exists rifle_comp_uploads_all_admin on public.rifle_comp_uploads;
create policy rifle_comp_uploads_all_admin on public.rifle_comp_uploads
  for all to authenticated
  using (public.is_rifle_admin() or public.is_s6())
  with check (public.is_rifle_admin() or public.is_s6());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rifle_scores_upload_id_fkey'
  ) then
    alter table public.rifle_scores
      add constraint rifle_scores_upload_id_fkey
      foreign key (upload_id) references public.rifle_comp_uploads(id) on delete set null;
  end if;
end $$;

-- ── SECTION 6 — self-only view exposing has_pin ─────────────────────────────
-- rifle_account_credentials carries NO client policies at all (service-role
-- only), so Makaio's own portal can't just query it to draw a "PIN set ✓"
-- label. Same trick as login_accounts: the view owner bypasses RLS on the
-- locked table, and the WHERE clause (not a grant) is the entire access
-- gate — self only, never another admin's row.
create or replace view public.rifle_admin_self
with (security_barrier = true) as
  select
    a.email, a.display_name, a.active, a.must_change_password,
    (c.pin_hash is not null) as has_pin
  from public.rifle_admins a
  left join public.rifle_account_credentials c on c.email = a.email
  where lower(a.email) = lower(auth.jwt() ->> 'email');

grant select on public.rifle_admin_self to authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select * from public.rifle_admins;                     -- Makaio's row, must_change_password = true
--   select has_table_privilege('anon','rifle_account_credentials','select'); -- false
--   select has_table_privilege('anon','rifle_comp_uploads','select');       -- false
--   select has_function_privilege('anon','public.reserve_rifle_pin_attempt(text)','execute'); -- false
-- ============================================================================
