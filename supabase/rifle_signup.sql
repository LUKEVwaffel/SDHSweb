-- Rifle team interest signup — 2026-27 season. Public, pre-auth form at
-- /rifle/signup, open to EVERY cadet who wants in — new, JV, and returning
-- varsity alike. A returning shooter is recognized automatically: if their
-- school_email matches an active row in rifle_shooters (last season's
-- roster, backfilled with emails via the admin Roster tab), the signup is
-- flagged is_varsity on insert (see rifle-submit-signup). No manual
-- self-report, no "don't sign up" carve-out.
--
-- Deliberately just an identifier + contact info, nothing else: the cadet's
-- name/age/grade/company already live in DISPATCH's own roster data, keyed
-- off school_email, so there's no reason to make them retype it here. One
-- signup per cadet (unique lower(school_email)).
--
-- Same posture as ball_vip_signups (see ball_vip_signup.sql): no anon RLS
-- policy at all, writes go through the service-role edge function
-- (rifle-submit-signup) only. Reads: S-6 gets everything, and the two email
-- reviewers (Chief/SAI, Sgt Kaz — see email_review.sql's is_reviewer()) get a
-- read-only view so Kaz can work the signup list from the same reviewer
-- portal he already uses for email review / ball ops.
--
-- Defensive re-declare: admin_role()/is_s6() (admin_roles.sql) and
-- is_reviewer() (email_review.sql) SHOULD already exist in prod — every ball/
-- aars/email feature depends on them. CREATE OR REPLACE below is a safe no-op
-- if they're already there with this exact body, and unblocks this file if
-- this session's DB is somehow missing them.
create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admin_roles
  where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
$$;

create or replace function public.is_s6()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() = 's6';
$$;

create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.email_reviewers
    where lower(email) = lower(auth.jwt() ->> 'email') and active
  );
$$;

create table if not exists public.rifle_signups (
  id              uuid primary key default gen_random_uuid(),
  school_email    text not null unique,
  personal_email  text not null,
  parent_email    text not null,
  phone           text not null,
  is_varsity      boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Idempotent add for installs where the table already existed pre-varsity-flag.
alter table public.rifle_signups add column if not exists is_varsity boolean not null default false;

-- Lets rifle-submit-signup recognize a returning shooter by school_email.
-- rifle_shooters (rifle_admin_portal.sql) predates this column and holds no
-- email for past rosters until Makaio/Kaz backfill them via the Roster tab —
-- until then, nobody matches and every signup lands as non-varsity, which is
-- the safe default.
alter table public.rifle_shooters add column if not exists school_email text;
create unique index if not exists rifle_shooters_school_email_idx
  on public.rifle_shooters (lower(school_email)) where school_email is not null;

alter table public.rifle_signups enable row level security;

drop policy if exists rifle_signups_all_s6 on public.rifle_signups;
create policy rifle_signups_all_s6 on public.rifle_signups
  for all to authenticated using (public.is_s6()) with check (public.is_s6());
revoke all on public.rifle_signups from anon;

-- Read-only scoped view for the reviewer portal (RifleSignupsPortal.jsx) —
-- same security_barrier SECURITY DEFINER shape as ball_vip_signups_dress_view:
-- the WHERE clause is the entire access gate, since the base table carries no
-- SELECT policy for a plain reviewer session at all.
drop view if exists public.rifle_signups_review_view;
create view public.rifle_signups_review_view
with (security_barrier = true) as
  select id, school_email, personal_email, parent_email, phone, is_varsity, created_at
  from public.rifle_signups
  where public.is_reviewer() or public.is_s6();
grant select on public.rifle_signups_review_view to authenticated;
