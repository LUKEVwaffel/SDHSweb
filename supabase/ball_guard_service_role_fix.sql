-- ============================================================================
-- MILITARY BALL — HOTFIX: column guards block the signup / guest-verify /
-- allergy edge functions. Run in the Supabase SQL editor (project
-- bjgyvmdzcymruunzavni). Idempotent, re-runnable.
--
-- SYMPTOM: the guest's "Finish Your Ball Invite" page (and other flows) fail
-- with "Edge Function returned a non-2xx status code". Server log shows
-- ball-guest-verify raising `not authorized to update ball_signups` /
-- `... ball_guests`.
--
-- CAUSE: ball_signups_column_guard() / ball_guests_column_guard() are BEFORE
-- UPDATE triggers that allow s6 / reviewer / dress / attire / s5 and RAISE for
-- everyone else. They only look at auth.jwt() role helpers (is_s6() etc).
-- The public edge functions (ball-guest-verify, ball-submit-signup rollback,
-- send-allergy-email, notify-ball-status-update) use the SERVICE-ROLE key —
-- no user JWT — so every one of those helpers is false and the trigger hits
-- its final `raise`. Service-role callers bypass RLS but NOT triggers, so the
-- guard fires and the whole UPDATE rolls back.
--
-- FIX: let the service role through at the top of each guard, same as s6.
-- Trusted server code (the edge functions) is already the authority on these
-- rows — the guard exists to stop a logged-in reviewer/dress/s5 session from
-- writing columns outside its lane, not to stop our own backend. A plain
-- unauthenticated PostgREST caller is `anon` (not `service_role`) and is
-- already stopped by RLS before the trigger, so this does not widen anything.
--
-- Also bumps ball_guard_version() to 5 so the legacy in-file guard copies in
-- ball_signup.sql / ball_finalize.sql / ball_guest_model.sql keep skipping.
-- ball_guards.sql carries this same definition going forward.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.ball_signups_column_guard()') is null then
    raise exception 'run ball_signup.sql (and the rest of the ball chain) first';
  end if;
end $$;

create or replace function public.ball_guard_version()
returns int language sql immutable as $$ select 5 $$;


-- ── ball_signups_column_guard() ─────────────────────────────────────────
create or replace function public.ball_signups_column_guard()
returns trigger language plpgsql as $$
begin
  -- Trusted backend (edge functions using the service-role key). No user JWT.
  if auth.role() = 'service_role' then
    return new;
  end if;

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


-- ── ball_guests_column_guard() ─────────────────────────────────────────
create or replace function public.ball_guests_column_guard()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

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


-- Triggers are unchanged (already bound in ball_signup.sql / ball_guards.sql),
-- but re-bind defensively in case only an older chain ran.
drop trigger if exists ball_signups_column_guard_trg on public.ball_signups;
create trigger ball_signups_column_guard_trg
  before update on public.ball_signups
  for each row execute function public.ball_signups_column_guard();

drop trigger if exists ball_guests_column_guard_trg on public.ball_guests;
create trigger ball_guests_column_guard_trg
  before update on public.ball_guests
  for each row execute function public.ball_guests_column_guard();

-- ============================================================================
-- VERIFY:
--   select public.ball_guard_version();   -- 5
--   -- then re-test the guest "Finish Your Ball Invite" page — CONFIRM should
--   -- 2xx and flip the signup to fully_verified.
-- ============================================================================
