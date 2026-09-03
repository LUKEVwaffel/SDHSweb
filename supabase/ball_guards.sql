-- ============================================================================
-- MILITARY BALL — COLUMN-GUARD SINGLE SOURCE OF TRUTH. Run in the Supabase SQL
-- editor (project bjgyvmdzcymruunzavni). Idempotent, re-runnable any number of
-- times. THIS FILE IS AUTHORITATIVE for:
--   • public.is_ball_dress()              (female-dress approver gate)
--   • public.is_ball_attire()             (Weston / male-guest attire gate)
--   • public.ball_signups_column_guard()  (BEFORE UPDATE column allow-list)
--   • public.ball_guests_column_guard()   (BEFORE UPDATE column allow-list)
--   • the two triggers that bind those guards
--
-- WHY THIS FILE EXISTS: those four objects were previously `create or replace`d
-- in three different files (ball_signup.sql, ball_finalize.sql,
-- ball_guest_model.sql). Because every one of those files advertises itself as
-- "idempotent, safe to re-run", re-pasting an EARLIER file after a later one
-- silently reverted the guard to a version missing newer frozen columns
-- (amount_due / field_trip_form_required / guest_type / friend_*) or a whole
-- role branch (S-5 allergy, Weston attire). That is a privilege-escalation
-- foot-gun for the ops / dress / S-5 staff writers.
--
-- THE FIX:
--   1. public.ball_guard_version() returns an integer that only ever goes up.
--   2. This file bumps it and installs the current guards unconditionally.
--   3. The three legacy files now wrap their historical guard definitions in
--      `if public.ball_guard_version() >= N then <skip> end if`, so re-running
--      any of them after this file is a NO-OP for the guards.
--
-- DEPLOY ORDER (see BALL_DEPLOY_ORDER.md):
--   ball_signup.sql → ball_finalize.sql → ball_guest_model.sql →
--   ball_hardening.sql → ball_guards.sql → (then deploy the edge functions)
--
-- WHEN YOU ADD A NEW COLUMN to ball_signups / ball_guests that a non-S6 writer
-- must NOT be able to change: add it to the relevant frozen list(s) below AND
-- bump GUARD_VERSION. Then raise the `>= N` checks in the three legacy files to
-- match (a lower N there still resolves to "skip", so this is optional
-- tidy-up, not correctness).
-- ============================================================================

-- Prerequisite gate — this file must run AFTER files 1–3 (their columns are
-- referenced in the guard bodies / is_ball_* definitions below).
do $$
begin
  if to_regclass('public.ball_dress_staff') is null then
    raise exception 'ball_guards.sql: run ball_signup.sql first (ball_dress_staff missing)';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_dress_staff' and column_name = 'role') then
    raise exception 'ball_guards.sql: run ball_finalize.sql first (ball_dress_staff.role missing)';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_signups' and column_name = 'amount_due') then
    raise exception 'ball_guards.sql: run ball_guest_model.sql first (ball_signups.amount_due missing)';
  end if;
end $$;

-- Current guard schema version. Bump on every change to the objects below.
create or replace function public.ball_guard_version()
returns int language sql immutable as $$ select 4 $$;


-- ── is_ball_dress() — female-dress approvers ONLY ──────────────────────────
-- role = 'female_dress'. A 'male_guest_attire' row (Weston) must NOT satisfy
-- this — otherwise he could reach the female approvers' portal / views / the
-- ball_signups+ball_guests dress column-guard branch.
create or replace function public.is_ball_dress()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ball_dress_staff
    where lower(email) = lower(auth.jwt() ->> 'email') and active and role = 'female_dress'
  );
$$;

-- ── is_ball_attire() — Weston / male-guest attire ONLY ────────────────────
create or replace function public.is_ball_attire()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ball_dress_staff
    where lower(email) = lower(auth.jwt() ->> 'email') and active and role = 'male_guest_attire'
  );
$$;


-- ── ball_signups_column_guard() ──────────────────────────────────────────
-- S-6           → anything.
-- Ops (reviewer)→ cash_received / field_trip_form_received ONLY.
-- Dress         → dress_approved / dress_approved_by ONLY.
-- S-5           → allergy_status / allergy_contacted_at ONLY.
-- anyone else   → denied.
-- NB: NEW.<field> is resolved at trigger-fire time, not CREATE time, so this
-- may reference columns added by ball_finalize.sql / ball_guest_model.sql even
-- if this file is (wrongly) run before them — but an UPDATE would then fail
-- loudly. Keep the deploy order.
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
       or new.amount_due         is distinct from old.amount_due
       or new.field_trip_form_required is distinct from old.field_trip_form_required
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
       or new.amount_due            is distinct from old.amount_due
       or new.field_trip_form_required is distinct from old.field_trip_form_required
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
       or new.amount_due            is distinct from old.amount_due
       or new.field_trip_form_required is distinct from old.field_trip_form_required
    then
      raise exception 'S-5 may only change allergy_status / allergy_contacted_at';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update ball_signups';
end $$;


-- ── ball_guests_column_guard() ──────────────────────────────────────────
-- S-6                    → anything.
-- Dress OR attire staff  → dress_approved / dress_approved_by ONLY.
-- anyone else            → denied.
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
       or new.guest_type           is distinct from old.guest_type
       or new.friend_payment_method is distinct from old.friend_payment_method
       or new.friend_amount_due    is distinct from old.friend_amount_due
    then
      raise exception 'dress/attire staff may only change dress_approved / dress_approved_by';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update ball_guests';
end $$;


-- ── triggers ────────────────────────────────────────────────────────────
drop trigger if exists ball_signups_column_guard_trg on public.ball_signups;
create trigger ball_signups_column_guard_trg
  before update on public.ball_signups
  for each row execute function public.ball_signups_column_guard();

drop trigger if exists ball_guests_column_guard_trg on public.ball_guests;
create trigger ball_guests_column_guard_trg
  before update on public.ball_guests
  for each row execute function public.ball_guests_column_guard();


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select public.ball_guard_version();                                   -- 4
--   select tgname from pg_trigger where tgrelid = 'public.ball_signups'::regclass; -- includes ball_signups_column_guard_trg
--   -- as a seeded 'male_guest_attire' session:
--   --   select public.is_ball_dress(), public.is_ball_attire();          -- f, t
--   -- as an ops (reviewer) session:
--   --   update ball_signups set cash_received = true where id = '<row>'; -- OK
--   --   update ball_signups set amount_due = 0     where id = '<row>';   -- raises
-- ============================================================================
