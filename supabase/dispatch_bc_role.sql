-- ============================================================================
-- DISPATCH - "BC" role: Range TV control ONLY.
-- Run in the Supabase SQL editor. Idempotent. Run AFTER admin_roles.sql,
-- tv_notices.sql, tv_broadcast.sql, and admin_password_gate.sql.
--
-- The Battalion Commander (Aiden O'Brien) gets a DISPATCH login that can do
-- EVERYTHING inside the TV Remote panel - daily schedule, featured team,
-- widget, photo source, shoutout, Range schedule / slideshow / notices, bell
-- schedule, and Emergency Push - and NOTHING else. No People/PII, no Email,
-- no Events, no guard rosters, no DISPATCH chat, no Advanced.
--
-- SCOPING MECHANISM:
--   • is_admin() / is_s6() / is_s5() are deliberately NOT widened. Every PII
--     and admin surface in this codebase gates on one of those three, so
--     leaving them untouched locks the BC role out of all of them by default.
--   • Only the two server-side gates that actually block full TV Remote use
--     are widened to also accept is_bc():
--       1. tv_notices write policy   (Announcements / Staff Notes CRUD)
--       2. tv_daily_settings_guard   (Emergency Push emergency_* columns)
--     Everything else the panel writes lands in tv_daily_settings - whose
--     UPDATE policy is already open (tv_control_center.sql / tv_screens.sql)
--     - or the tv-daily-photos storage bucket, also already open.
--   • admin_role() returns NULL while must_change_password is true
--     (admin_password_gate.sql), so a BC account still on its temp password
--     has NO write access anywhere until the holder sets their own password.
-- ============================================================================


-- ── SECTION 1 - allow 'bc' in admin_roles.role ─────────────────────────────
alter table public.admin_roles
  drop constraint if exists admin_roles_role_check;
alter table public.admin_roles
  add constraint admin_roles_role_check check (role in ('s6','s5','bc'));


-- ── SECTION 2 - is_bc() helper ────────────────────────────────────────────
-- Same shape as is_s6() / is_s5() (admin_roles.sql SECTION 2).
create or replace function public.is_bc()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() = 'bc';
$$;


-- ── SECTION 3 - widen the two TV gates to accept is_bc() ──────────────────

-- 3a. tv_notices - Announcements + Staff Notes CRUD (Range Notices tab).
--     Original policy: tv_notices.sql -> tv_notices_write_admin = is_admin().
drop policy if exists tv_notices_write_admin on public.tv_notices;
create policy tv_notices_write_admin on public.tv_notices
  for all to authenticated
  using      (public.is_admin() or public.is_bc())
  with check (public.is_admin() or public.is_bc());

-- 3b. tv_daily_settings_guard - the BEFORE UPDATE trigger from tv_broadcast.sql
--     that column-guards the singleton row. Re-created here verbatim EXCEPT
--     the emergency-field check also accepts is_bc(). Spotlight fields stay
--     service-role-only (unchanged).
create or replace function public.tv_daily_settings_guard()
returns trigger language plpgsql as $$
begin
  if (new.spotlight_photo_url is distinct from old.spotlight_photo_url
      or new.spotlight_active  is distinct from old.spotlight_active
      or new.spotlight_set_at  is distinct from old.spotlight_set_at
      or new.spotlight_set_by  is distinct from old.spotlight_set_by)
     and auth.role() <> 'service_role' then
    raise exception 'spotlight fields are service-role only (push-tv-spotlight edge function)';
  end if;

  if (new.emergency_active    is distinct from old.emergency_active
      or new.emergency_text      is distinct from old.emergency_text
      or new.emergency_header    is distinct from old.emergency_header
      or new.emergency_photo_url is distinct from old.emergency_photo_url
      or new.emergency_text_size is distinct from old.emergency_text_size)
     and not (auth.role() = 'service_role' or public.is_admin() or public.is_bc()) then
    raise exception 'emergency fields require an authenticated DISPATCH admin';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tv_daily_settings_guard on public.tv_daily_settings;
create trigger trg_tv_daily_settings_guard
  before update on public.tv_daily_settings
  for each row execute function public.tv_daily_settings_guard();


-- ── SECTION 4 - seed the BC account row ───────────────────────────────────
-- STEP 1 (do this in the dashboard FIRST): Auth -> Users -> Add user
--   email:    ao34967@student.hcde.org
--   password: <pick one, hand it to Aiden directly>
--   Auto Confirm User: ON
--
-- STEP 2: run this.
--
-- must_change_password is seeded FALSE. The forced-first-reset flow
-- (admin_password_gate.sql + complete-admin-first-login edge fn) proved
-- unreliable for this account - the re-arm trigger stuck the flag true and
-- Aiden got the reset screen on every login. bc_no_forced_reset.sql gives
-- this one low-privilege account a permanent exemption; keep the seed false
-- here so a re-run of this file doesn't undo that.
insert into public.admin_roles (email, role, must_change_password)
values ('ao34967@student.hcde.org', 'bc', false)
on conflict (email) do update
  set role = excluded.role,
      must_change_password = excluded.must_change_password;

-- Picker card fields - only if account_picker.sql has been run (adds the cols).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_roles'
      and column_name = 'display_name'
  ) then
    update public.admin_roles
      set display_name = 'Aiden O''Brien',
          title        = 'Battalion Commander',
          photo_url    = 'https://bjgyvmdzcymruunzavni.supabase.co/storage/v1/object/public/staff-photos/Aiden%20O%20Brein.png'
      where email = 'ao34967@student.hcde.org';
  end if;
end $$;

-- ============================================================================
-- VERIFY:
--   select email, role, must_change_password from public.admin_roles
--     where email = 'ao34967@student.hcde.org';   -- expect 'bc' / false
--   -- run AS that account:
--   select public.admin_role(), public.is_bc();   -- expect 'bc' / true
-- ============================================================================
