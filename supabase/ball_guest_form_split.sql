-- ============================================================================
-- MILITARY BALL — separate the GUEST's own field-trip form from the host's.
-- Independent add-on, run any time after ball_guest_cash_split.sql. Idempotent.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni).
--
-- WHY: ball_signups.field_trip_form_required/_received is a single combined
-- flag (ball-submit-signup: `!hasGuest || guestIsSdhsStudent`) — it goes true
-- when the HOST needs a form (no guest) OR the GUEST needs one (an SDHS
-- student attending as a date/friend). When a signup HAS a guest who is an
-- SDHS student, that one checkbox in Ball Payments could mean "host turned
-- theirs in" or "guest turned theirs in" or both — Kaz/Chief had no way to
-- mark the guest's separately from the host's. This adds a second, guest-
-- scoped column so both can be tracked independently whenever a guest exists.
--
-- AFTER RUNNING THIS FILE, RE-RUN ball_guards.sql (bumped to v7 — adds
-- field_trip_form_received to the reviewer-writable list on
-- ball_guests_column_guard(), alongside friend_cash_received).
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_guests' and column_name = 'friend_cash_received') then
    raise exception 'ball_guest_form_split.sql: run ball_guest_cash_split.sql first (ball_guests.friend_cash_received missing)';
  end if;
end $$;

alter table public.ball_guests
  add column if not exists field_trip_form_received boolean not null default false;

-- Widen the ops view Kaz/Chief read from.
drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_barrier = true) as
  select id, signup_id, name, age, guest_type, is_sdhs_jrotc, school_attended,
         friend_payment_method, friend_amount_due, friend_cash_received, field_trip_form_received
  from public.ball_guests
  where public.is_reviewer();
grant select on public.ball_guests_ops_view to authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING (then after re-running ball_guards.sql v7):
--   select column_name from information_schema.columns
--     where table_name='ball_guests' and column_name='field_trip_form_received'; -- 1 row
--   select * from public.ball_guests_ops_view limit 1;   -- has field_trip_form_received
--   -- as an ops (reviewer) session, after ball_guards.sql v7:
--   --   update ball_guests set field_trip_form_received = true where id = '<guest row>'; -- OK
-- ============================================================================
