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
-- Only female attendees go through dress approval (a male VIP wears his own
-- unit's Class A — nothing to submit). dress_approved / dress_approved_by
-- mirror ball_signups/ball_guests so BallDressPortal.jsx can fold VIPs into
-- the same female-only approval queue Aubrey/Kylie already work from.
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
  dress_approved          boolean,
  dress_approved_by       text,
  created_at              timestamptz not null default now()
);

alter table public.ball_vip_signups enable row level security;

-- No anon policy at all, same posture as ball_signups/ball_guests — writes go
-- through the service-role edge function only. S-6 (Chief) gets full
-- visibility; nobody else needs to read this.
drop policy if exists ball_vip_signups_all_s6 on public.ball_vip_signups;
create policy ball_vip_signups_all_s6 on public.ball_vip_signups
  for all to authenticated using (public.is_s6()) with check (public.is_s6());

-- Dress staff (is_ball_dress()) get the same row+column gate shape as
-- ball_guests_column_guard: row access via RLS, column scope via a BEFORE
-- UPDATE trigger, so a dress approver can flip approval but touch nothing
-- else on the row.
drop policy if exists ball_vip_signups_update_dress on public.ball_vip_signups;
create policy ball_vip_signups_update_dress on public.ball_vip_signups
  for update to authenticated
  using (public.is_ball_dress()) with check (public.is_ball_dress());

create or replace function public.ball_vip_signups_column_guard()
returns trigger language plpgsql as $$
begin
  if public.is_s6() then
    return new;
  end if;

  if public.is_ball_dress() then
    if new.name is distinct from old.name
       or new.role is distinct from old.role
       or new.home_school is distinct from old.home_school
       or new.age is distinct from old.age
       or new.gender is distinct from old.gender
       or new.has_allergy is distinct from old.has_allergy
       or new.allergy_detail is distinct from old.allergy_detail
       or new.personal_email is distinct from old.personal_email
       or new.phone is distinct from old.phone
       or new.dress_code_accepted_at is distinct from old.dress_code_accepted_at
    then
      raise exception 'dress staff may only change dress_approved / dress_approved_by';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update ball_vip_signups';
end $$;

drop trigger if exists ball_vip_signups_column_guard_trg on public.ball_vip_signups;
create trigger ball_vip_signups_column_guard_trg
  before update on public.ball_vip_signups
  for each row execute function public.ball_vip_signups_column_guard();

-- Scoped read for dress staff — same security_barrier SECURITY DEFINER shape
-- as ball_signups_dress_view / ball_guests_dress_view (see ball_signup.sql):
-- the WHERE clause IS the access gate, base-table RLS holds no SELECT policy
-- for dress staff at all.
drop view if exists public.ball_vip_signups_dress_view;
create view public.ball_vip_signups_dress_view
with (security_barrier = true) as
  select id, name, role, home_school, gender, dress_approved, dress_approved_by
  from public.ball_vip_signups
  where public.is_ball_dress();
grant select on public.ball_vip_signups_dress_view to authenticated;
