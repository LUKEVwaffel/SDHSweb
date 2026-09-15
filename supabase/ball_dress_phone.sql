-- Adds phone number to the dress-approval views (ball_signups_dress_view /
-- ball_guests_dress_view / ball_vip_signups_dress_view /
-- ball_vip_dates_dress_view) so BallDressPortal.jsx can show who a female
-- attendee is by phone, not just name. Approval still happens over text
-- off-platform — this just gets the number in front of the approver.
-- Aliased to a single `phone` column across all four so the frontend
-- doesn't need per-kind branching (cadet_phone / guest_phone / phone).
--
-- Run after ball_ops_dress_views_fix.sql and ball_vip_signup.sql.

do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_name = 'ball_signups' and column_name = 'cadet_phone') then
    raise exception 'ball_dress_phone.sql: run ball_signup.sql first (ball_signups.cadet_phone missing)';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_name = 'ball_guests' and column_name = 'guest_phone') then
    raise exception 'ball_dress_phone.sql: run ball_guest_model.sql first (ball_guests.guest_phone missing)';
  end if;
end $$;

drop view if exists public.ball_signups_dress_view;
create view public.ball_signups_dress_view
with (security_barrier = true) as
  select id, cadet_name, cadet_let_level, cadet_company, cadet_gender,
         cadet_phone as phone, dress_approved, dress_approved_by
  from public.ball_signups
  where public.is_ball_dress();
grant select on public.ball_signups_dress_view to authenticated;

drop view if exists public.ball_guests_dress_view;
create view public.ball_guests_dress_view
with (security_barrier = true) as
  select id, signup_id, name, gender, guest_phone as phone,
         dress_approved, dress_approved_by
  from public.ball_guests
  where public.is_ball_dress();
grant select on public.ball_guests_dress_view to authenticated;

drop view if exists public.ball_vip_signups_dress_view;
create view public.ball_vip_signups_dress_view
with (security_barrier = true) as
  select id, name, role, home_school, gender, phone, dress_approved, dress_approved_by
  from public.ball_vip_signups
  where public.is_ball_dress();
grant select on public.ball_vip_signups_dress_view to authenticated;

drop view if exists public.ball_vip_dates_dress_view;
create view public.ball_vip_dates_dress_view
with (security_barrier = true) as
  select id, vip_signup_id, name, gender, phone, dress_approved, dress_approved_by
  from public.ball_vip_dates
  where public.is_ball_dress();
grant select on public.ball_vip_dates_dress_view to authenticated;
