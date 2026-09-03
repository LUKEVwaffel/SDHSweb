-- ============================================================================
-- MILITARY BALL — GUEST MODEL (date vs friend). Layered on top of
-- ball_signup.sql + ball_finalize.sql. Run those FIRST, then this. Idempotent.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni).
--
-- NEW GUEST MODEL:
--   • guest_type = 'date'   — couple rate. Host pays price_couple ($50) for
--     both; no separate charge for the date. The date may be an in-program
--     SDHS cadet (added via the roster tag) OR an out-of-program person
--     (manual entry). Field trip form is required whenever the date is an
--     SDHS student — in-program roster cadet OR a Soddy Daisy non-cadet.
--     (Rule widened 2026-09-03: was in-program-cadet-only.)
--   • guest_type = 'friend' — OUT-OF-PROGRAM ONLY. Never an SDHS cadet (a
--     cadet who wants to attend registers on their own). Couple rate does
--     NOT apply: host pays price_cadet ($35) for themselves only; the friend
--     owes their OWN $35, tracked separately (friend_amount_due) and NOT
--     added to the host's amount_due. friend_payment_method records how that
--     $35 is expected to reach the school. Field trip form required only if
--     the friend is a Soddy Daisy student (they are still an SDHS student).
--
-- Amounts are snapshotted onto the rows at submit time (ball-submit-signup
-- reads price_cadet/price_couple off ball_config) so a later price change in
-- ball_config doesn't silently restate what someone already owes.
-- ============================================================================


-- ── SECTION 0 — prerequisite gate + guard-version bootstrap ───────────────
-- HARD GATE: ball_signup.sql + ball_finalize.sql must be applied first.
do $$
begin
  if to_regclass('public.ball_signups') is null then
    raise exception 'ball_guest_model.sql: run ball_signup.sql first (ball_signups missing)';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_signups' and column_name = 'allergy_status') then
    raise exception 'ball_guest_model.sql: run ball_finalize.sql first (ball_signups.allergy_status missing)';
  end if;
end $$;

-- ball_guards.sql owns the two column-guard functions. Stub
-- ball_guard_version() at 0 if absent; SECTION 3 below is wrapped so a re-run
-- of this file after ball_guards.sql cannot downgrade the guards. See
-- BALL_DEPLOY_ORDER.md.
do $$
begin
  if to_regprocedure('public.ball_guard_version()') is null then
    execute 'create function public.ball_guard_version() returns int language sql immutable as $b$ select 0 $b$';
  elsif public.ball_guard_version() >= 4 then
    raise warning 'ball_guest_model.sql carries SUPERSEDED guard definitions; ball_guards.sql v% is authoritative. If you just re-ran this file, RE-RUN ball_guards.sql now.', public.ball_guard_version();
  end if;
end $$;


-- ── SECTION 1 — ball_guests: type + friend payment ────────────────────────
alter table public.ball_guests
  add column if not exists guest_type            text not null default 'date',
  add column if not exists friend_payment_method text,
  add column if not exists friend_amount_due     numeric(10,2);

alter table public.ball_guests drop constraint if exists ball_guests_guest_type_check;
alter table public.ball_guests add constraint ball_guests_guest_type_check
  check (guest_type in ('date','friend'));

alter table public.ball_guests drop constraint if exists ball_guests_friend_payment_method_check;
alter table public.ball_guests add constraint ball_guests_friend_payment_method_check
  check (friend_payment_method is null or friend_payment_method in ('host_delivers','self_pays'));

-- A friend is out-of-program by definition; an in-program tag (is_sdhs_jrotc +
-- sdhs_matched_cadet_id) can only ever pair with a date. Enforced in
-- ball-submit-signup too — this is the storage-level backstop.
alter table public.ball_guests drop constraint if exists ball_guests_friend_out_of_program_check;
alter table public.ball_guests add constraint ball_guests_friend_out_of_program_check
  check (guest_type <> 'friend' or (is_sdhs_jrotc = false and sdhs_matched_cadet_id is null));

-- friend_payment_method is required exactly when guest_type = 'friend'.
alter table public.ball_guests drop constraint if exists ball_guests_friend_payment_required_check;
alter table public.ball_guests add constraint ball_guests_friend_payment_required_check
  check ((guest_type = 'friend') = (friend_payment_method is not null));


-- ── SECTION 2 — ball_signups: host amount + form-required flag ─────────────
alter table public.ball_signups
  add column if not exists amount_due              numeric(10,2),
  add column if not exists field_trip_form_required boolean not null default true;


-- ── SECTION 3 — column guards: freeze the new columns for non-S6 writers ───
-- Same shape as ball_finalize.sql SECTION 4/5 — ops (is_reviewer) may still
-- only touch cash_received / field_trip_form_received, S-5 only the allergy
-- ladder, dress/attire only dress_approved(_by). Adds the new columns to every
-- non-S6 frozen list so amount_due / field_trip_form_required / guest_type /
-- friend_* can't be rewritten from those surfaces.
-- LEGACY DEFINITIONS — authoritative copies are in ball_guards.sql. Wrapped so
-- a re-run of this file after ball_guards.sql cannot downgrade them.
do $wrap$
begin
  if public.ball_guard_version() >= 4 then
    raise notice 'ball_guards.sql v% authoritative — skipping legacy ball_*_column_guard()', public.ball_guard_version();
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
    $sql$;
  end if;
end
$wrap$;


-- ── SECTION 4 — widen the ops views (Kaz/Chief) ──────────────────────────
-- These security_invoker views are the ONLY thing ops reads. Add the new
-- fields Kaz/Chief need for payment logistics: what the host owes, whether a
-- form is even required, and — for a friend guest — the friend's own $35 and
-- how it's being delivered.
drop view if exists public.ball_signups_ops_view;
create view public.ball_signups_ops_view
with (security_invoker = true) as
  select id, cadet_name, cadet_let_level, cadet_company, status,
         cash_received, field_trip_form_received, field_trip_form_required,
         amount_due, created_at
  from public.ball_signups
  where public.is_reviewer();
grant select on public.ball_signups_ops_view to authenticated;

drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_invoker = true) as
  select id, signup_id, name, age, guest_type, is_sdhs_jrotc, school_attended,
         friend_payment_method, friend_amount_due
  from public.ball_guests
  where public.is_reviewer();
grant select on public.ball_guests_ops_view to authenticated;


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select column_name from information_schema.columns
--     where table_name='ball_guests' and column_name in
--       ('guest_type','friend_payment_method','friend_amount_due');            -- 3 rows
--   select column_name from information_schema.columns
--     where table_name='ball_signups' and column_name in
--       ('amount_due','field_trip_form_required');                            -- 2 rows
--   -- constraint bites a bad friend row:
--   --   insert ball_guests (... guest_type='friend', is_sdhs_jrotc=true ...) -> violates ball_guests_friend_out_of_program_check
--   --   insert ball_guests (... guest_type='friend', friend_payment_method=null ...) -> violates ball_guests_friend_payment_required_check
--   select * from public.ball_signups_ops_view limit 1;   -- has amount_due, field_trip_form_required
--   select * from public.ball_guests_ops_view  limit 1;   -- has guest_type, friend_payment_method, friend_amount_due
-- ============================================================================
