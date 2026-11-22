-- ============================================================================
-- BALL FEEDBACK — short public form at /ballfeedback (QR code at the Ball).
-- Run in the Supabase SQL editor. Idempotent. Requires admin_roles.sql
-- (public.is_s5() / public.is_s6()) and auth_rls.sql (_drop_all_policies).
--
--   • Anyone (cadet, guest, parent, staff) can submit — no login, name optional.
--   • Two ratings: the night itself, and the online reservation/setup process.
--   • S-5 + S-6 read responses in DISPATCH → Ball → FEEDBACK. Writes are S-6.
-- ============================================================================

create table if not exists public.ball_feedback (
  id                 uuid primary key default gen_random_uuid(),
  attendee_type      text not null check (attendee_type in ('cadet', 'guest', 'parent', 'staff')),
  ball_rating        int  not null check (ball_rating between 1 and 5),
  setup_rating       int  check (setup_rating between 1 and 5),
  setup_issues       text[] not null default '{}',
  best_part          text check (length(best_part) <= 2000),
  improve            text check (length(improve) <= 2000),
  submitter_name     text check (length(submitter_name) <= 120),
  submitter_fp       text,
  created_at         timestamptz not null default now()
);

create index if not exists ball_feedback_created_idx on public.ball_feedback(created_at desc);

alter table public.ball_feedback enable row level security;
select public._drop_all_policies('ball_feedback');

create policy ball_feedback_insert_public on public.ball_feedback
  for insert to anon, authenticated with check (true);

create policy ball_feedback_all_s6 on public.ball_feedback
  for all to authenticated using (public.is_s6()) with check (public.is_s6());

create policy ball_feedback_select_s5 on public.ball_feedback
  for select to authenticated using (public.is_s5());

-- Backstop against spam: max 3 submissions per device fingerprint per hour.
create or replace function public.ball_feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.submitter_fp is not null and (
    select count(*) from public.ball_feedback
    where submitter_fp = new.submitter_fp and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'Too many submissions — try again later.';
  end if;
  return new;
end $$;

drop trigger if exists ball_feedback_rate_limit on public.ball_feedback;
create trigger ball_feedback_rate_limit before insert on public.ball_feedback
  for each row execute function public.ball_feedback_rate_limit();
