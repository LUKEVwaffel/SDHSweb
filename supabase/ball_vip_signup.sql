-- Military Ball "VIP" signup — for the handful of attendees who cannot go
-- through the normal cadet-verify flow (StepCadetVerify.jsx) because they
-- have no SDHS roster record and no @students.hcde.org email at all:
-- visiting XO/BC from another Hamilton County JROTC unit, and past Ball
-- King/Queen. No instructors — those go through Chief directly, off-system.
--
-- Deliberately its OWN table, not a bent-shape row in ball_signups/ball_guests
-- (see ball_signup.sql): those tables hard-require cadet_school_email and a
-- signup_id FK respectively, and are guarded by column-guard triggers tuned
-- for the cadet/date/friend payment flow. A VIP owes nothing, brings no
-- date, and needs none of that — a flat table is simpler and can't interact
-- with the guest/payment guards by accident.
--
-- No pre-approval list: names aren't known ahead of time, so entry is
-- self-reported (honor system) via the public ball-submit-vip-signup edge
-- function. S-6 sees who actually signed up in DISPATCH (BallVipList.jsx).
create table if not exists public.ball_vip_signups (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  role                    text not null check (role in ('visiting_xo_bc', 'past_king_queen')),
  home_school             text not null,
  age                     int,
  gender                  text,
  has_allergy             boolean not null default false,
  allergy_detail          text,
  personal_email          text not null,
  phone                   text,
  dress_code_accepted_at  timestamptz,
  created_at              timestamptz not null default now()
);

alter table public.ball_vip_signups enable row level security;

-- No anon policy at all, same posture as ball_signups/ball_guests — writes go
-- through the service-role edge function only. S-6 (Chief) gets full
-- visibility; nobody else needs to read this.
drop policy if exists ball_vip_signups_all_s6 on public.ball_vip_signups;
create policy ball_vip_signups_all_s6 on public.ball_vip_signups
  for all to authenticated using (public.is_s6()) with check (public.is_s6());
