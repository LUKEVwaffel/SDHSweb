-- ============================================================================
-- MILITARY BALL — ops portal (Kaz / Chief) can now see guest POC + contact
-- info. Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni).
-- Idempotent, re-runnable. Run AFTER ball_signup.sql + ball_finalize.sql +
-- ball_guest_model.sql + ball_ops_dress_views_fix.sql.
--
-- WHY: the ops views were originally scoped to payment logistics only —
-- "neither sees POC contact or allergies" (ball_ops_dress_views_fix.sql).
-- Kaz / Chief now need to reach the guest's point of contact directly to
-- chase down cash + field-trip forms, so this widens BOTH ops views with the
-- contact columns. Allergies stay OUT — those remain S-5 territory
-- (ball_allergy_list()), not payment tracking.
--
-- READ-ONLY CHANGE. This only adds columns to two SECURITY DEFINER views
-- gated by `where public.is_reviewer()`. The write path is unchanged: the
-- ball_signups / ball_guests column-guard triggers still let ops staff
-- change nothing but cash_received / field_trip_form_received.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_guests' and column_name = 'poc_name') then
    raise exception 'ball_ops_poc_fields.sql: run ball_signup.sql first (ball_guests.poc_name missing)';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_signups' and column_name = 'amount_due') then
    raise exception 'ball_ops_poc_fields.sql: run ball_guest_model.sql first (ball_signups.amount_due missing)';
  end if;
end $$;


-- ── ops views (Kaz / Chief) — is_reviewer() gate ────────────────────────
-- Signup side gains the cadet-side contact points collected at signup:
-- cadet_school_email (roster identity) + notification_email (where status
-- updates already go).
drop view if exists public.ball_signups_ops_view;
create view public.ball_signups_ops_view
with (security_barrier = true) as
  select id, cadet_name, cadet_let_level, cadet_company, status,
         cash_received, field_trip_form_received, field_trip_form_required,
         amount_due, created_at,
         cadet_school_email, notification_email
  from public.ball_signups
  where public.is_reviewer();
grant select on public.ball_signups_ops_view to authenticated;

-- Guest side gains the point-of-contact block + the guest's own email.
drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_barrier = true) as
  select id, signup_id, name, age, guest_type, is_sdhs_jrotc, school_attended,
         friend_payment_method, friend_amount_due,
         poc_name, poc_email, poc_phone, personal_email
  from public.ball_guests
  where public.is_reviewer();
grant select on public.ball_guests_ops_view to authenticated;


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select column_name from information_schema.columns
--     where table_name = 'ball_signups_ops_view'
--       and column_name in ('cadet_school_email','notification_email');   -- 2 rows
--   select column_name from information_schema.columns
--     where table_name = 'ball_guests_ops_view'
--       and column_name in ('poc_name','poc_email','poc_phone','personal_email'); -- 4 rows
--   -- as a seeded reviewer session (must_change_password = false):
--   select poc_name, poc_phone from public.ball_guests_ops_view limit 1;  -- visible
--   -- as a non-reviewer authenticated session: 0 rows.
-- ============================================================================
