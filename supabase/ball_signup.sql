-- ============================================================================
-- MILITARY BALL SIGNUP SYSTEM — schema / RLS / storage. Run in the Supabase
-- SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: admin_roles.sql (admin_roles, is_s6(), _drop_all_policies),
-- email_review.sql (is_reviewer(), email_reviewers — Backend #1 reuses this
-- population directly per product decision, see plan doc), cadet_consent.sql
-- + cadet_consent_contact.sql + cadet_consent_birthdates.sql +
-- cadet_consent_grade_let.sql (school_email, birthdate, gender, let_level).
--
-- SHIPS UNLINKED: no nav/homepage wiring yet — ball_date/ticket_price are
-- null until Luke fills in ball_config from the new admin panel. Public
-- routes exist at /ball/* regardless; the landing page shows a "details
-- coming soon" state while ball_config is empty.
--
-- POPULATIONS (3, each scoped to only what their job needs):
--   • S-6            — full read/write on everything (config, signups,
--                       guests, gallery, dress staff roster).
--   • Ops (Kaz/Chief) — the EXISTING email_reviewers population/PIN, reused
--                       as-is. Read via ball_*_ops_view (name/LET/company,
--                       status, cash_received, field_trip_form_received —
--                       NO dress fields, NO allergies). Write ONLY
--                       cash_received + field_trip_form_received via a
--                       column-scoped grant on the base table.
--   • Dress staff (3 new people) — new `ball_dress_staff` table + PIN,
--                       mirrors email_reviewers/reviewer_credentials shape
--                       exactly. Read via ball_*_dress_view (name/LET/
--                       company/gender, dress_approved — NO payment fields,
--                       NO guest POC contact info, NO allergies). Write
--                       ONLY dress_approved + dress_approved_by via a
--                       column-scoped grant.
-- Allergies/food logistics and full-row visibility are S-6-only — neither
-- staff population needs or gets them (Luke's review of the original draft
-- plan, which had accepted full-row SELECT for both as a simplification).
--
-- SECURITY MODEL:
--   • ball_signups / ball_guests have NO anon policies at all, and
--     authenticated SELECT on the base tables is revoked outright (S-6 only,
--     via is_s6()). Every public-facing write is a service-role edge
--     function — cadet identity is proven by an email-roster lookup, not a
--     Supabase session, so RLS can't gate it directly anyway.
--   • Views use security_invoker so they run under the CALLER's role/RLS,
--     not the view owner's (opposite of login_accounts in account_picker.sql,
--     which deliberately runs owner-privileged to read locked tables for an
--     anon audience). Requires Postgres 15+ — verify with `select version()`
--     before relying on this; if the project predates 15, replace the two
--     view pairs with SECURITY DEFINER functions returning the same columns.
--   • ball_dress_staff is fully locked (service-role only) — same posture as
--     account_credentials/reviewer_credentials. is_ball_dress() reads it via
--     SECURITY DEFINER, same shape as is_reviewer().
-- ============================================================================


-- ── SECTION 0 — guard-version bootstrap ───────────────────────────────────
-- public.ball_guard_version() is owned by ball_guards.sql — the single source
-- of truth for ball_signups_column_guard() / ball_guests_column_guard() /
-- is_ball_dress() / is_ball_attire(). It may not exist yet on a first-ever
-- deploy, so stub it at 0 here; ball_guards.sql bumps it. The guard
-- definitions further down in THIS file are wrapped in a version check so a
-- stray re-run of ball_signup.sql after ball_guards.sql cannot silently
-- downgrade them. See BALL_DEPLOY_ORDER.md.
do $$
begin
  if to_regprocedure('public.ball_guard_version()') is null then
    execute 'create function public.ball_guard_version() returns int language sql immutable as $b$ select 0 $b$';
  elsif public.ball_guard_version() >= 4 then
    raise warning 'ball_signup.sql carries SUPERSEDED guard definitions; ball_guards.sql v% is authoritative. If you just re-ran this file, RE-RUN ball_guards.sql now.', public.ball_guard_version();
  end if;
end $$;


-- ── SECTION 1 — ball_config (single row, admin-editable) ────────────────────
create table if not exists public.ball_config (
  id                    boolean primary key default true check (id),  -- singleton
  ball_date             date,
  ticket_price          numeric(10,2),
  signup_deadline       date,
  field_trip_form_pdf_url text,
  dress_code_text       text,
  dress_approvers       jsonb not null default '[]'::jsonb,  -- [{name,phone,email}] x3
  updated_at            timestamptz not null default now()
);
insert into public.ball_config (id) values (true) on conflict (id) do nothing;

alter table public.ball_config enable row level security;
drop policy if exists ball_config_read_public on public.ball_config;
drop policy if exists ball_config_write_s6     on public.ball_config;
create policy ball_config_read_public on public.ball_config
  for select to anon, authenticated using (true);
create policy ball_config_write_s6 on public.ball_config
  for update to authenticated
  using (public.is_s6()) with check (public.is_s6());
-- No insert/delete policy — the singleton row is seeded once above; S-6
-- always UPDATEs it, never inserts a second row (the `id boolean` PK with a
-- CHECK forces exactly one possible key value anyway).


-- ── SECTION 2 — ball_dress_staff (new population, fully locked) ─────────────
-- Created BEFORE ball_signups/ball_guests below: their column-guard triggers
-- and RLS policies call public.is_ball_dress(), which must already exist at
-- CREATE POLICY / CREATE FUNCTION time (plpgsql validates referenced function
-- calls when check_function_bodies is on, Postgres's default).
create table if not exists public.ball_dress_staff (
  email            text primary key,
  name             text not null,
  active           boolean not null default true,
  pin_hash         text,
  pin_fail_count   integer not null default 0 check (pin_fail_count >= 0),
  pin_locked_until timestamptz,
  updated_at       timestamptz not null default now()
);
alter table public.ball_dress_staff enable row level security;
-- (intentionally no policies — service_role only, same posture as
-- account_credentials/reviewer_credentials)
revoke all on public.ball_dress_staff from anon, authenticated;

-- LEGACY DEFINITION — authoritative copy is in ball_guards.sql (which scopes
-- this to role = 'female_dress'). Wrapped so a re-run after ball_guards.sql
-- does not revert to this pre-role-split version.
do $wrap$
begin
  if public.ball_guard_version() >= 4 then
    raise notice 'ball_guards.sql v% authoritative — skipping legacy is_ball_dress()', public.ball_guard_version();
  else
    execute $sql$
create or replace function public.is_ball_dress()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ball_dress_staff
    where lower(email) = lower(auth.jwt() ->> 'email') and active
  );
$$;
    $sql$;
  end if;
end
$wrap$;

-- Atomic reserve/reset lockout primitives — verbatim copy of
-- account_picker.sql's reserve_pin_attempt/reset_pin_attempts (SECTION 2),
-- renamed and pointed at ball_dress_staff. Same PUBLIC-revoke requirement:
-- SECURITY DEFINER + attacker-suppliable p_email means these must NOT be
-- reachable via PostgREST, or an anon caller could force-lock all 3 dress
-- staff accounts (login DoS) or read back lockout state.
create or replace function public.ball_dress_reserve_pin_attempt(p_email text)
returns table(allowed boolean, fail_count integer, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_count  integer;
  v_locked timestamptz;
  v_base   integer;
  v_new    integer;
  v_lock   timestamptz;
begin
  select ds.pin_fail_count, ds.pin_locked_until into v_count, v_locked
    from public.ball_dress_staff ds
    where lower(ds.email) = lower(p_email)
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

  update public.ball_dress_staff
    set pin_fail_count = v_new, pin_locked_until = v_lock, updated_at = now()
    where lower(email) = lower(p_email);

  return query select true, v_new, v_lock;
end $$;

create or replace function public.ball_dress_reset_pin_attempts(p_email text)
returns void language sql security definer set search_path = public as $$
  update public.ball_dress_staff
    set pin_fail_count = 0, pin_locked_until = null, updated_at = now()
    where lower(email) = lower(p_email);
$$;

revoke execute on function public.ball_dress_reserve_pin_attempt(text) from public;
revoke execute on function public.ball_dress_reset_pin_attempts(text) from public;
revoke all     on function public.ball_dress_reserve_pin_attempt(text) from anon, authenticated;
revoke all     on function public.ball_dress_reset_pin_attempts(text) from anon, authenticated;


-- ── SECTION 3 — ball_signups + ball_guests ──────────────────────────────────
create table if not exists public.ball_signups (
  id                       uuid primary key default gen_random_uuid(),
  cadet_school_email       text not null,
  cadet_name               text not null,   -- snapshot at signup time
  cadet_let_level          text,
  cadet_company            text,
  cadet_age                int,
  cadet_gender             text,
  cadet_allergies          text,
  notification_email       text,
  status                   text not null default 'guest_pending'
                             check (status in ('guest_pending','fully_verified')),
  field_trip_form_received boolean not null default false,
  cash_received            boolean not null default false,
  dress_approved           boolean,
  dress_approved_by        text,
  created_at               timestamptz not null default now()
);
create index if not exists ball_signups_email_idx on public.ball_signups(cadet_school_email);

create table if not exists public.ball_guests (
  id                     uuid primary key default gen_random_uuid(),
  signup_id              uuid not null unique references public.ball_signups(id) on delete cascade,
  name                   text not null,
  age                    int,
  gender                 text,
  is_sdhs_jrotc          boolean not null default false,
  sdhs_matched_cadet_id  uuid,             -- soft reference to cadet_consent.id (no FK: cross-privacy-boundary table, see cadet_consent.sql RLS)
  other_jrotc            boolean not null default false,
  other_jrotc_school     text,
  school_attended        text,
  poc_name               text,
  poc_email              text,
  poc_phone              text,
  personal_email         text not null,
  verification_token     text not null unique,
  allergies              text,
  dress_code_accepted_at timestamptz,
  dress_approved         boolean,
  dress_approved_by      text,
  verified_at            timestamptz,
  created_at             timestamptz not null default now()
);
create index if not exists ball_guests_token_idx on public.ball_guests(verification_token);

alter table public.ball_signups enable row level security;
alter table public.ball_guests  enable row level security;

-- No anon policies at all. S-6 full read/write; everyone else reads via the
-- scoped views below and writes via column-scoped grants.
drop policy if exists ball_signups_all_s6 on public.ball_signups;
drop policy if exists ball_guests_all_s6  on public.ball_guests;
create policy ball_signups_all_s6 on public.ball_signups
  for all to authenticated using (public.is_s6()) with check (public.is_s6());
create policy ball_guests_all_s6 on public.ball_guests
  for all to authenticated using (public.is_s6()) with check (public.is_s6());

-- Ops (is_reviewer()) and dress staff (is_ball_dress()) both need UPDATE as
-- the SAME `authenticated` role that S-6 also updates through — a plain
-- column-level GRANT can't tell them apart (grants are per-role, not
-- per-policy), unlike admin_roles.sql's column-grant trick where s6 was the
-- ONLY authenticated writer. So the row gate is an RLS policy (below) and the
-- COLUMN gate is a BEFORE UPDATE trigger that inspects which columns actually
-- changed, per caller identity. is_s6() bypasses the trigger's checks
-- entirely; ops/dress get a hard allow-list — any other column touched in
-- the same UPDATE raises and rolls back the whole statement.
drop policy if exists ball_signups_update_ops_dress on public.ball_signups;
create policy ball_signups_update_ops_dress on public.ball_signups
  for update to authenticated
  using (public.is_reviewer() or public.is_ball_dress())
  with check (public.is_reviewer() or public.is_ball_dress());

-- LEGACY DEFINITION — authoritative copy (with the S-5 branch and the
-- amount_due / field_trip_form_required / allergy freezes) is in
-- ball_guards.sql. Wrapped so a re-run after ball_guards.sql cannot downgrade.
do $wrap$
begin
  if public.ball_guard_version() >= 4 then
    raise notice 'ball_guards.sql v% authoritative — skipping legacy ball_signups_column_guard()', public.ball_guard_version();
  else
    execute $sql$
create or replace function public.ball_signups_column_guard()
returns trigger language plpgsql as $$
begin
  if public.is_s6() then
    return new;
  end if;

  if public.is_reviewer() then
    if new.cadet_school_email is distinct from old.cadet_school_email
       or new.cadet_name        is distinct from old.cadet_name
       or new.cadet_let_level   is distinct from old.cadet_let_level
       or new.cadet_company     is distinct from old.cadet_company
       or new.cadet_age         is distinct from old.cadet_age
       or new.cadet_gender      is distinct from old.cadet_gender
       or new.cadet_allergies   is distinct from old.cadet_allergies
       or new.notification_email is distinct from old.notification_email
       or new.status            is distinct from old.status
       or new.dress_approved    is distinct from old.dress_approved
       or new.dress_approved_by is distinct from old.dress_approved_by
    then
      raise exception 'ops staff may only change cash_received / field_trip_form_received';
    end if;
    return new;
  end if;

  if public.is_ball_dress() then
    if new.cadet_school_email       is distinct from old.cadet_school_email
       or new.cadet_name            is distinct from old.cadet_name
       or new.cadet_let_level       is distinct from old.cadet_let_level
       or new.cadet_company         is distinct from old.cadet_company
       or new.cadet_age             is distinct from old.cadet_age
       or new.cadet_gender          is distinct from old.cadet_gender
       or new.cadet_allergies       is distinct from old.cadet_allergies
       or new.notification_email   is distinct from old.notification_email
       or new.status                is distinct from old.status
       or new.field_trip_form_received is distinct from old.field_trip_form_received
       or new.cash_received         is distinct from old.cash_received
    then
      raise exception 'dress staff may only change dress_approved / dress_approved_by';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update ball_signups';
end $$;
    $sql$;
  end if;
end
$wrap$;

drop trigger if exists ball_signups_column_guard_trg on public.ball_signups;
create trigger ball_signups_column_guard_trg
  before update on public.ball_signups
  for each row execute function public.ball_signups_column_guard();

-- ball_guests: only dress staff write here (ops has no guest-table write per
-- the plan — cash/form are tracked on ball_signups only). Same row+column
-- gate shape as above, one allow-list instead of two branches.
drop policy if exists ball_guests_update_dress on public.ball_guests;
create policy ball_guests_update_dress on public.ball_guests
  for update to authenticated
  using (public.is_ball_dress()) with check (public.is_ball_dress());

-- LEGACY DEFINITION — authoritative copy (is_ball_attire branch +
-- guest_type / friend_* freezes) is in ball_guards.sql. Wrapped so a re-run
-- after ball_guards.sql cannot downgrade.
do $wrap$
begin
  if public.ball_guard_version() >= 4 then
    raise notice 'ball_guards.sql v% authoritative — skipping legacy ball_guests_column_guard()', public.ball_guard_version();
  else
    execute $sql$
create or replace function public.ball_guests_column_guard()
returns trigger language plpgsql as $$
begin
  if public.is_s6() then
    return new;
  end if;

  if public.is_ball_dress() then
    if new.signup_id              is distinct from old.signup_id
       or new.name                is distinct from old.name
       or new.age                 is distinct from old.age
       or new.gender               is distinct from old.gender
       or new.is_sdhs_jrotc        is distinct from old.is_sdhs_jrotc
       or new.sdhs_matched_cadet_id is distinct from old.sdhs_matched_cadet_id
       or new.other_jrotc          is distinct from old.other_jrotc
       or new.other_jrotc_school   is distinct from old.other_jrotc_school
       or new.school_attended      is distinct from old.school_attended
       or new.poc_name             is distinct from old.poc_name
       or new.poc_email            is distinct from old.poc_email
       or new.poc_phone            is distinct from old.poc_phone
       or new.personal_email       is distinct from old.personal_email
       or new.verification_token   is distinct from old.verification_token
       or new.allergies            is distinct from old.allergies
       or new.dress_code_accepted_at is distinct from old.dress_code_accepted_at
       or new.verified_at          is distinct from old.verified_at
    then
      raise exception 'dress staff may only change dress_approved / dress_approved_by';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update ball_guests';
end $$;
    $sql$;
  end if;
end
$wrap$;

drop trigger if exists ball_guests_column_guard_trg on public.ball_guests;
create trigger ball_guests_column_guard_trg
  before update on public.ball_guests
  for each row execute function public.ball_guests_column_guard();


-- ── SECTION 4 — scoped views for ops + dress staff ──────────────────────────
-- SECURITY DEFINER views (the default — no security_invoker reloption). They
-- run as the owner (`postgres`, BYPASSRLS), so base-table RLS does NOT blank
-- them for a non-s6 caller. The `WHERE public.is_reviewer()` /
-- `WHERE public.is_ball_dress()` clause inside each view IS the access gate; a
-- caller who is neither gets 0 rows. The column list is the field-scoping.
-- `security_barrier = true` pins the gate ahead of any user predicate.
--   ⚠ An earlier revision used `WITH (security_invoker = true)` here. That
--   returned 0 rows for ops / dress (they hold no SELECT policy on the base
--   tables) — see ball_ops_dress_views_fix.sql. Do not reintroduce it.

drop view if exists public.ball_signups_ops_view;
create view public.ball_signups_ops_view
with (security_barrier = true) as
  select id, cadet_name, cadet_let_level, cadet_company, status,
         cash_received, field_trip_form_received, created_at
  from public.ball_signups
  where public.is_reviewer();
grant select on public.ball_signups_ops_view to authenticated;

drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_barrier = true) as
  select id, signup_id, name, age
  from public.ball_guests
  where public.is_reviewer();
grant select on public.ball_guests_ops_view to authenticated;

drop view if exists public.ball_signups_dress_view;
create view public.ball_signups_dress_view
with (security_barrier = true) as
  select id, cadet_name, cadet_let_level, cadet_company, cadet_gender,
         dress_approved, dress_approved_by
  from public.ball_signups
  where public.is_ball_dress();
grant select on public.ball_signups_dress_view to authenticated;

drop view if exists public.ball_guests_dress_view;
create view public.ball_guests_dress_view
with (security_barrier = true) as
  select id, signup_id, name, gender, dress_approved, dress_approved_by
  from public.ball_guests
  where public.is_ball_dress();
grant select on public.ball_guests_dress_view to authenticated;


-- ── SECTION 5 — ball_gallery (public-read photo strip for the landing page) ─
create table if not exists public.ball_gallery (
  id           uuid primary key default gen_random_uuid(),
  photo_url    text not null,
  storage_path text not null,
  caption      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.ball_gallery enable row level security;
drop policy if exists ball_gallery_read_public on public.ball_gallery;
drop policy if exists ball_gallery_all_s6       on public.ball_gallery;
create policy ball_gallery_read_public on public.ball_gallery
  for select to anon, authenticated using (true);
create policy ball_gallery_all_s6 on public.ball_gallery
  for all to authenticated using (public.is_s6()) with check (public.is_s6());


-- ── SECTION 6 — ball-assets storage bucket (public read; PDF + gallery) ─────
insert into storage.buckets (id, name, public)
values ('ball-assets', 'ball-assets', true)
on conflict (id) do nothing;

drop policy if exists ball_assets_read   on storage.objects;
drop policy if exists ball_assets_write  on storage.objects;
drop policy if exists ball_assets_update on storage.objects;
drop policy if exists ball_assets_delete on storage.objects;

create policy ball_assets_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'ball-assets');
-- Images + PDF only — same stored-XSS concern as admin-avatars (public-read
-- bucket, so an uploaded SVG could carry inline script served from our
-- origin), plus the field-trip form is explicitly a PDF.
create policy ball_assets_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ball-assets' and public.is_s6()
              and (metadata->>'mimetype') in ('image/png','image/jpeg','image/webp','image/gif','application/pdf'));
create policy ball_assets_update on storage.objects
  for update to authenticated
  using (bucket_id = 'ball-assets' and public.is_s6())
  with check (bucket_id = 'ball-assets' and public.is_s6()
              and (metadata->>'mimetype') in ('image/png','image/jpeg','image/webp','image/gif','application/pdf'));
create policy ball_assets_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ball-assets' and public.is_s6());


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select current_setting('server_version_num')::int >= 150000;             -- true, or replace views w/ functions
--   select has_table_privilege('authenticated','ball_signups','select');     -- false (S-6 gets there via RLS bypass on is_s6(), not a blanket grant — actually Supabase's default authenticated grant is broad; the real gate is RLS, confirm no anon/authenticated SELECT succeeds without is_s6()/is_reviewer()/is_ball_dress() true)
--   select has_table_privilege('anon','ball_signups','select');              -- true (grant) but RLS blocks all rows (no anon policy) — 0 rows returned
--   select has_table_privilege('anon','ball_dress_staff','select');          -- false
--   -- as a seeded dress-staff session: confirm the view hides payment fields
--   --   select * from ball_signups_dress_view limit 1;  -- no cash_received/field_trip_form_received columns at all
--   -- as a seeded reviewer session: confirm the view hides dress fields
--   --   select * from ball_signups_ops_view limit 1;    -- no dress_approved/dress_approved_by columns at all
--   -- confirm the lockout RPCs are not public API reachable:
--   select has_function_privilege('anon','public.ball_dress_reserve_pin_attempt(text)','execute'); -- false
-- ============================================================================
