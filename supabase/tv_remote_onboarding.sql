-- ============================================================================
-- TV REMOTE - per-account onboarding + "what's new" tracking.
-- Run in the Supabase SQL editor. Idempotent. Run AFTER admin_roles.sql.
--
-- One row per DISPATCH account that has opened the TV Remote. Tracks:
--   • last_seen_version    - highest changelog version this account has seen
--                            (src/data/tvRemoteChangelog.js). 0 = never opened,
--                            which is what triggers the first-run slide tour.
--   • first_walkthrough_at - set once, when the guided tour is finished/skipped.
--                            Stops the tour re-firing even if last_seen_version
--                            is somehow reset.
--
-- Self-service: an account reads and writes ONLY its own row (email from the
-- JWT). No admin/service path needed - this is per-user UI state, not
-- privileged data.
-- ============================================================================

create table if not exists public.tv_remote_onboarding (
  email                text primary key references public.admin_roles(email) on delete cascade,
  last_seen_version    integer     not null default 0,
  first_walkthrough_at timestamptz,
  updated_at           timestamptz not null default now()
);

alter table public.tv_remote_onboarding enable row level security;

drop policy if exists tv_remote_onboarding_rw_self on public.tv_remote_onboarding;
create policy tv_remote_onboarding_rw_self on public.tv_remote_onboarding
  for all to authenticated
  using      (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

grant select, insert, update on public.tv_remote_onboarding to authenticated;

-- ============================================================================
-- VERIFY (run as the BC account):
--   select * from public.tv_remote_onboarding;
--   -- after finishing the first-run tour: one row, first_walkthrough_at set,
--   -- last_seen_version = the latest version in tvRemoteChangelog.js
-- ============================================================================
