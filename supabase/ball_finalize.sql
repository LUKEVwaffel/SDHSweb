-- ============================================================================
-- MILITARY BALL — FINALIZE (items 1–3 of Luke's 2026-09-02 planning batch).
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: ball_signup.sql (all of it), admin_roles.sql (is_s6/is_s5),
-- email_review.sql (is_reviewer).
--
-- COVERS:
--   1. ball_config — venue, dinner + flat menu, split pricing (cadet/couple),
--      event time, Weston contact. Drops the retired single ticket_price.
--      Seeds the known Nov 2026 details.
--   2. ball_signups — cadet allergy as a yes/no flag + a REQUIRED non-school
--      email (no details collected in-form; S-5 follows up directly). Plus an
--      allergy_status ladder (pending → contacted) S-5 owns.
--        • S-5 read  → ball_allergy_list()  (SECURITY DEFINER, is_s5()/is_s6())
--        • S-5 write → base UPDATE under a new column-guard branch (only
--          allergy_status / allergy_contacted_at), mirrors ops/dress.
--   3. Dress/attire — ball_dress_staff gains a `role`:
--        • 'female_dress'      = the existing 3 approvers (female cadets +
--          female guests). is_ball_dress() is TIGHTENED to this role.
--        • 'male_guest_attire' = Weston. New is_ball_attire(). Male guests text
--          him an outfit photo; he approves via a 4th queue that sees ONLY
--          male guests. Read → ball_attire_guest_list() (SECURITY DEFINER);
--          write → ball_guests base UPDATE under a new column-guard branch.
--      Male CADET attire is a fixed Class-A requirement — no approval row, no
--      queue; the wizard just shows "contact Weston" copy (weston_* below).
--
-- WHY SECURITY DEFINER FUNCTIONS FOR THE NEW READS (not security_invoker
-- views like ball_signup.sql SECTION 4): those views require the caller to
-- hold a base-table SELECT grant/policy, which would also expose every other
-- column on a direct PostgREST call. A DEFINER function keeps the column
-- projection AND the role gate inside one object — exactly the fallback the
-- SECTION 4 header text calls out. New reads use it; existing views are left
-- untouched.
-- ============================================================================


-- ── SECTION 0 — prerequisite gate + guard-version bootstrap ───────────────
-- HARD GATE: ball_signup.sql must be applied first.
do $$
begin
  if to_regclass('public.ball_signups') is null then
    raise exception 'ball_finalize.sql: run ball_signup.sql first (ball_signups missing)';
  end if;
end $$;

-- ball_guards.sql owns is_ball_dress() / is_ball_attire() / the two column
-- guards. Stub ball_guard_version() at 0 if it does not exist yet; the guard
-- definitions in SECTIONS 3–5 below are wrapped so a re-run of this file after
-- ball_guards.sql cannot downgrade them. See BALL_DEPLOY_ORDER.md.
do $$
begin
  if to_regprocedure('public.ball_guard_version()') is null then
    execute 'create function public.ball_guard_version() returns int language sql immutable as $b$ select 0 $b$';
  elsif public.ball_guard_version() >= 4 then
    raise warning 'ball_finalize.sql carries SUPERSEDED guard definitions; ball_guards.sql v% is authoritative. If you just re-ran this file, RE-RUN ball_guards.sql now.', public.ball_guard_version();
  end if;
end $$;


-- ── SECTION 1 — ball_config: venue / dinner / pricing / time / Weston ───────
alter table public.ball_config
  add column if not exists venue_address   text,
  add column if not exists venue_phone     text,
  add column if not exists event_time_text text,
  add column if not exists dinner_caterer  text,
  add column if not exists dinner_menu     jsonb not null default '[]'::jsonb,  -- flat list: [{ item, note }]
  add column if not exists price_cadet     numeric(10,2),
  add column if not exists price_couple    numeric(10,2),
  add column if not exists weston_name     text,
  add column if not exists weston_phone    text;

-- Retire the single ticket_price (superseded by price_cadet / price_couple).
-- Safe: table has one seeded row and every reader (BallLanding, BallPanel,
-- StepDocumentation) is updated in the same change set. Value is currently NULL.
alter table public.ball_config drop column if exists ticket_price;

-- Seed the known 2026 details (Luke: date/venue/caterer/pricing confirmed
-- 2026-09-02). Menu stays empty until the real P.F. Chang's list lands;
-- weston_phone stays NULL until Luke sets it (copy degrades to "contact
-- Weston" with no number).
update public.ball_config set
  ball_date       = coalesce(ball_date, date '2026-11-21'),
  signup_deadline = coalesce(signup_deadline, date '2026-11-01'),
  event_time_text = coalesce(event_time_text, '5:00-9:00 PM'),
  venue_address   = coalesce(venue_address, '1000 Alhambra Dr, Chattanooga, TN 37421'),
  venue_phone     = coalesce(venue_phone, '(423) 892-0223'),
  dinner_caterer  = coalesce(dinner_caterer, 'P.F. Chang''s'),
  price_cadet     = coalesce(price_cadet, 35),
  price_couple    = coalesce(price_couple, 50),
  weston_name     = coalesce(weston_name, 'Weston'),
  updated_at      = now()
where id = true;


-- ── SECTION 2 — ball_signups: cadet allergy flag + status ladder ────────────
alter table public.ball_signups
  add column if not exists cadet_has_allergy   boolean not null default false,
  add column if not exists cadet_allergy_email text,
  add column if not exists allergy_status      text not null default 'pending',
  add column if not exists allergy_contacted_at timestamptz;

alter table public.ball_signups drop constraint if exists ball_signups_allergy_status_check;
alter table public.ball_signups add constraint ball_signups_allergy_status_check
  check (allergy_status in ('pending','contacted'));

-- Old free-text cadet_allergies column is left in place but is no longer
-- written by the signup flow (item 2: no details collected in-form). Not
-- dropped — keeps any historical value readable to S-6.

create index if not exists ball_signups_allergy_idx
  on public.ball_signups(allergy_status) where cadet_has_allergy;


-- ── SECTION 3 — ball_dress_staff role split ────────────────────────────────
alter table public.ball_dress_staff
  add column if not exists role text not null default 'female_dress';

alter table public.ball_dress_staff drop constraint if exists ball_dress_staff_role_check;
alter table public.ball_dress_staff add constraint ball_dress_staff_role_check
  check (role in ('female_dress','male_guest_attire'));

-- is_ball_dress() TIGHTENED: female-dress role only, so a male_guest_attire
-- row (Weston) can't reach the female approvers' portal, views, or the
-- ball_signups/ball_guests dress column-guard branches.
-- LEGACY DEFINITIONS — authoritative copies are in ball_guards.sql. Wrapped so
-- a re-run after ball_guards.sql cannot downgrade.
do $wrap$
begin
  if public.ball_guard_version() >= 4 then
    raise notice 'ball_guards.sql v% authoritative — skipping legacy is_ball_dress()/is_ball_attire()', public.ball_guard_version();
  else
    execute $sql$
create or replace function public.is_ball_dress()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ball_dress_staff
    where lower(email) = lower(auth.jwt() ->> 'email') and active and role = 'female_dress'
  );
$$;

create or replace function public.is_ball_attire()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ball_dress_staff
    where lower(email) = lower(auth.jwt() ->> 'email') and active and role = 'male_guest_attire'
  );
$$;
    $sql$;
  end if;
end
$wrap$;


-- ── SECTION 4 — ball_signups column-guard: add the S-5 allergy branch ───────
-- LEGACY DEFINITION — authoritative copy (also freezing amount_due /
-- field_trip_form_required, added by ball_guest_model.sql) is in
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
    if new.cadet_school_email    is distinct from old.cadet_school_email
       or new.cadet_name         is distinct from old.cadet_name
       or new.cadet_let_level    is distinct from old.cadet_let_level
       or new.cadet_company      is distinct from old.cadet_company
       or new.cadet_age          is distinct from old.cadet_age
       or new.cadet_gender       is distinct from old.cadet_gender
       or new.cadet_allergies    is distinct from old.cadet_allergies
       or new.cadet_has_allergy  is distinct from old.cadet_has_allergy
       or new.cadet_allergy_email is distinct from old.cadet_allergy_email
       or new.notification_email is distinct from old.notification_email
       or new.status             is distinct from old.status
       or new.dress_approved     is distinct from old.dress_approved
       or new.dress_approved_by  is distinct from old.dress_approved_by
       or new.allergy_status     is distinct from old.allergy_status
       or new.allergy_contacted_at is distinct from old.allergy_contacted_at
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
       or new.cadet_has_allergy     is distinct from old.cadet_has_allergy
       or new.cadet_allergy_email   is distinct from old.cadet_allergy_email
       or new.notification_email   is distinct from old.notification_email
       or new.status                is distinct from old.status
       or new.field_trip_form_received is distinct from old.field_trip_form_received
       or new.cash_received         is distinct from old.cash_received
       or new.allergy_status        is distinct from old.allergy_status
       or new.allergy_contacted_at  is distinct from old.allergy_contacted_at
    then
      raise exception 'dress staff may only change dress_approved / dress_approved_by';
    end if;
    return new;
  end if;

  if public.is_s5() then
    if new.cadet_school_email       is distinct from old.cadet_school_email
       or new.cadet_name            is distinct from old.cadet_name
       or new.cadet_let_level       is distinct from old.cadet_let_level
       or new.cadet_company         is distinct from old.cadet_company
       or new.cadet_age             is distinct from old.cadet_age
       or new.cadet_gender          is distinct from old.cadet_gender
       or new.cadet_allergies       is distinct from old.cadet_allergies
       or new.cadet_has_allergy     is distinct from old.cadet_has_allergy
       or new.cadet_allergy_email   is distinct from old.cadet_allergy_email
       or new.notification_email    is distinct from old.notification_email
       or new.status                is distinct from old.status
       or new.field_trip_form_received is distinct from old.field_trip_form_received
       or new.cash_received         is distinct from old.cash_received
       or new.dress_approved        is distinct from old.dress_approved
       or new.dress_approved_by     is distinct from old.dress_approved_by
    then
      raise exception 'S-5 may only change allergy_status / allergy_contacted_at';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update ball_signups';
end $$;
    $sql$;
  end if;
end
$wrap$;

-- RLS: let S-5 UPDATE ball_signups (row gate). The column-guard trigger above
-- is the column gate. Mirrors ball_signups_update_ops_dress.
drop policy if exists ball_signups_update_s5 on public.ball_signups;
create policy ball_signups_update_s5 on public.ball_signups
  for update to authenticated
  using (public.is_s5()) with check (public.is_s5());


-- ── SECTION 5 — ball_guests column-guard: add the attire (Weston) branch ────
-- LEGACY DEFINITION — authoritative copy (also freezing guest_type /
-- friend_*, added by ball_guest_model.sql) is in ball_guards.sql. Wrapped so a
-- re-run after ball_guards.sql cannot downgrade.
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

  if public.is_ball_dress() or public.is_ball_attire() then
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
      raise exception 'dress/attire staff may only change dress_approved / dress_approved_by';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update ball_guests';
end $$;
    $sql$;
  end if;
end
$wrap$;

drop policy if exists ball_guests_update_attire on public.ball_guests;
create policy ball_guests_update_attire on public.ball_guests
  for update to authenticated
  using (public.is_ball_attire()) with check (public.is_ball_attire());


-- ── SECTION 6 — scoped read functions (SECURITY DEFINER, gate inside) ──────
-- S-5 allergy list: flagged cadets only, newest first. Name + contact email +
-- status ONLY — no payment, dress, age, allergy detail (there is none stored).
drop function if exists public.ball_allergy_list();
create function public.ball_allergy_list()
returns table (
  id                   uuid,
  cadet_name           text,
  cadet_allergy_email  text,
  submitted_at         timestamptz,
  allergy_status       text,
  allergy_contacted_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.cadet_name, s.cadet_allergy_email, s.created_at,
         s.allergy_status, s.allergy_contacted_at
  from public.ball_signups s
  where s.cadet_has_allergy
    and (public.is_s5() or public.is_s6())
  order by s.created_at desc
$$;
revoke all     on function public.ball_allergy_list() from public, anon;
grant  execute on function public.ball_allergy_list() to authenticated;

-- Weston's queue: male guests only. Name + approval state.
drop function if exists public.ball_attire_guest_list();
create function public.ball_attire_guest_list()
returns table (
  id               uuid,
  signup_id        uuid,
  guest_name       text,
  cadet_name       text,
  dress_approved   boolean,
  dress_approved_by text
)
language sql stable security definer set search_path = public as $$
  select g.id, g.signup_id, g.name, s.cadet_name, g.dress_approved, g.dress_approved_by
  from public.ball_guests g
  join public.ball_signups s on s.id = g.signup_id
  where g.gender = 'male'
    and (public.is_ball_attire() or public.is_s6())
  order by g.created_at asc
$$;
revoke all     on function public.ball_attire_guest_list() from public, anon;
grant  execute on function public.ball_attire_guest_list() to authenticated;


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select ball_date, signup_deadline, price_cadet, price_couple, venue_address,
--          dinner_caterer, weston_name from public.ball_config;   -- seeded row
--   select column_name from information_schema.columns
--     where table_name='ball_config' and column_name='ticket_price';  -- 0 rows
--   \df public.is_ball_attire
--   -- as a seeded 'male_guest_attire' session: is_ball_dress() = false,
--   --   is_ball_attire() = true, ball_attire_guest_list() returns male guests.
--   -- as an S-5 session: ball_allergy_list() returns flagged cadets; an
--   --   update of ball_signups.cash_received raises the column-guard.
-- ============================================================================
