-- Exposes ball_guests.verified_at on ball_guests_dress_view so
-- BallDressPortal.jsx can lock out a guest row (no phone reveal, no
-- approve toggle) until the guest has actually verified via the email link
-- (ball-guest-verify sets verified_at + flips ball_signups.status to
-- 'fully_verified'). Before this, dress staff could see and approve a guest
-- who never confirmed they're really coming.
--
-- Run after ball_dress_phone.sql.

drop view if exists public.ball_guests_dress_view;
create view public.ball_guests_dress_view
with (security_barrier = true) as
  select id, signup_id, name, gender, guest_phone as phone, verified_at,
         dress_approved, dress_approved_by
  from public.ball_guests
  where public.is_ball_dress();
grant select on public.ball_guests_dress_view to authenticated;
