-- ============================================================================
-- MILITARY BALL — fix field_trip_form_required: give the GUEST their own
-- requirement flag, and correct the host's. Independent add-on, run any time
-- after ball_guest_form_split.sql. Idempotent. Run in the Supabase SQL editor
-- (project bjgyvmdzcymruunzavni).
--
-- BUG THIS FIXES: ball-submit-signup previously computed the cadet's OWN
-- field_trip_form_required as `!hasGuest || guestIsSdhsStudent` — meaning
-- whenever a cadet brought a guest who was NOT an SDHS student (a normal
-- date or friend), the CADET's own requirement got set to false. The cadet
-- is always an SDHS student and always needs to sign the form regardless of
-- who they bring. That's now hardcoded true in the edge function; this file
-- (a) backfills every existing ball_signups row to true, since there is no
-- legitimate case where a cadet host doesn't need one, and (b) adds a
-- guest-scoped field_trip_form_required column so the GUEST's own need (an
-- SDHS student attending as a date/friend) is tracked independently instead
-- of being read off the host's row.
--
-- AFTER RUNNING THIS FILE, RE-RUN ball_guards.sql (bumped to v8 — freezes
-- ball_guests.field_trip_form_required against ops/dress writes, same as the
-- other *_required columns).
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_guests' and column_name = 'field_trip_form_received') then
    raise exception 'ball_guest_form_required_split.sql: run ball_guest_form_split.sql first (ball_guests.field_trip_form_received missing)';
  end if;
end $$;

alter table public.ball_guests
  add column if not exists field_trip_form_required boolean not null default false;

-- The column-guard triggers fire on EVERY UPDATE regardless of who's
-- connected — the SQL editor session has no Supabase auth JWT, so it isn't
-- service_role, isn't S-6, isn't anything the guards recognize, and the
-- backfill UPDATEs below would raise 'not authorized' just like an
-- unprivileged caller. Earlier ball_guest_*_split.sql files never hit this
-- because they were ALTER TABLE only (DDL, no trigger). Disable both guard
-- triggers for just this backfill, then put them back immediately.
alter table public.ball_guests disable trigger ball_guests_column_guard_trg;
alter table public.ball_signups disable trigger ball_signups_column_guard_trg;

-- Backfill existing guest rows: an SDHS student is either the in-program
-- roster tag or a non-cadet who attends Soddy Daisy High School (the literal
-- string ball-submit-signup writes into school_attended for that case).
update public.ball_guests
set field_trip_form_required = true
where field_trip_form_required = false
  and (is_sdhs_jrotc = true or school_attended = 'Soddy Daisy High School');

-- Backfill existing signup rows: the cadet host is always required. This
-- corrects every past signup wrongly zeroed out by the bug above.
update public.ball_signups
set field_trip_form_required = true
where field_trip_form_required = false;

alter table public.ball_guests enable trigger ball_guests_column_guard_trg;
alter table public.ball_signups enable trigger ball_signups_column_guard_trg;

-- Widen the ops view Kaz/Chief read from.
drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_barrier = true) as
  select id, signup_id, name, age, guest_type, is_sdhs_jrotc, school_attended,
         friend_payment_method, friend_amount_due, friend_cash_received,
         field_trip_form_required, field_trip_form_received
  from public.ball_guests
  where public.is_reviewer();
grant select on public.ball_guests_ops_view to authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING (then after re-running ball_guards.sql v8):
--   select column_name from information_schema.columns
--     where table_name='ball_guests' and column_name='field_trip_form_required'; -- 1 row
--   select count(*) from public.ball_signups where field_trip_form_required = false; -- 0
--   select * from public.ball_guests_ops_view limit 1;   -- has field_trip_form_required
--   -- as an ops (reviewer) session, after ball_guards.sql v8:
--   --   update ball_guests set field_trip_form_required = true where id = '<guest row>'; -- raises
-- ============================================================================
