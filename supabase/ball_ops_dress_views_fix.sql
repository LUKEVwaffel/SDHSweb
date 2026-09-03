-- ============================================================================
-- MILITARY BALL — FIX: ops / dress portals see ZERO signups. Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent, re-runnable.
-- Run AFTER ball_signup.sql + ball_finalize.sql + ball_guest_model.sql.
--
-- BUG: ball_signups_ops_view / ball_guests_ops_view / ball_signups_dress_view /
-- ball_guests_dress_view were all created `WITH (security_invoker = true)`.
-- An invoker view runs the underlying SELECT as the CALLER. The caller is an
-- `email_reviewers` / `ball_dress_staff` session — the `authenticated` role,
-- NOT s6. ball_signups / ball_guests have RLS enabled and the ONLY SELECT
-- policy is `*_all_s6` (is_s6()). There is no SELECT policy for a reviewer or
-- dress-staff caller, so RLS filters every row → the view returns 0 rows and
-- Kaz / Chief / the dress approvers see an empty portal even with real signups.
--
-- FIX: recreate the four views as SECURITY DEFINER (the default — just drop the
-- `security_invoker = true` reloption). A definer view executes as its owner
-- (`postgres`, which has BYPASSRLS), so base-table RLS no longer blanks it. The
-- `WHERE public.is_reviewer()` / `WHERE public.is_ball_dress()` clause INSIDE
-- each view is the real access gate — a non-reviewer / non-dress caller still
-- gets 0 rows. The column list in each view is the field-scoping (ops never
-- sees dress columns, dress never sees payment columns, neither sees POC
-- contact or allergies). `security_barrier = true` pins the gate predicate so
-- it can't be reordered behind a leaky user predicate.
--
-- This is exactly the fallback the ball_signup.sql SECTION 4 header calls out
-- ("replace the view pairs with SECURITY DEFINER ..."), and matches how
-- ball_finalize.sql already did ball_allergy_list() / ball_attire_guest_list().
--
-- NB: is_reviewer() also requires `not must_change_password`. If a reviewer is
-- still on a dashboard temp password this view stays empty for them BY DESIGN —
-- that is a separate data fix (clear the flag / complete first-login), not this.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_signups' and column_name = 'amount_due') then
    raise exception 'ball_ops_dress_views_fix.sql: run ball_guest_model.sql first (ball_signups.amount_due missing)';
  end if;
end $$;


-- ── ops views (Kaz / Chief) — is_reviewer() gate ─────────────────────────
drop view if exists public.ball_signups_ops_view;
create view public.ball_signups_ops_view
with (security_barrier = true) as
  select id, cadet_name, cadet_let_level, cadet_company, status,
         cash_received, field_trip_form_received, field_trip_form_required,
         amount_due, created_at
  from public.ball_signups
  where public.is_reviewer();
grant select on public.ball_signups_ops_view to authenticated;

drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_barrier = true) as
  select id, signup_id, name, age, guest_type, is_sdhs_jrotc, school_attended,
         friend_payment_method, friend_amount_due
  from public.ball_guests
  where public.is_reviewer();
grant select on public.ball_guests_ops_view to authenticated;


-- ── dress views (female-attire approvers) — is_ball_dress() gate ─────────
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


-- ============================================================================
-- VERIFY AFTER RUNNING:
--   -- views are no longer invoker:
--   select relname, reloptions from pg_class
--     where relname in ('ball_signups_ops_view','ball_guests_ops_view',
--                       'ball_signups_dress_view','ball_guests_dress_view');
--     -- reloptions shows {security_barrier=true}, NOT security_invoker=true
--   -- as a seeded reviewer session (must_change_password = false):
--   select count(*) from public.ball_signups_ops_view;   -- > 0 when signups exist
--   -- as a non-reviewer authenticated session: 0 rows.
-- ============================================================================
