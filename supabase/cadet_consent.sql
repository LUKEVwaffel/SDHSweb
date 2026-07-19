-- ============================================================================
-- PHOTO CONSENT TRACKING — per-cadet, organized by company.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- This is a SEPARATE roster from `personnel`. `personnel` is the public
-- leadership directory (dozens shown on the site); the full cadet roster
-- (hundreds, sectioned by company) is not in it. Consent lives on its own table
-- so it can receive the full roster later without touching the public directory.
--
-- PRIVACY NOTE: same posture as the rest of the app — anon key + passcode-gated
-- admin, no per-user auth. That means these rows are readable by anyone with the
-- public anon key. Cadet names + consent status are mildly sensitive; if that
-- matters, gate this table (and email_*) behind real Supabase Auth later. Flagged
-- deliberately, not an oversight.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.cadet_consent (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  company        text not null
                   check (company in ('alpha','bravo','charlie','delta','staff')),
  role           text,                         -- optional: 'cadet' | 'staff' | rank, etc.
  consent_status text not null default 'pending'
                   check (consent_status in ('pending','collected','declined')),
  collected_at   timestamptz,
  collected_by   text,                         -- adminId who marked it
  note           text,
  sort_order     int  not null default 0,
  updated_at     timestamptz not null default now()
);

create index if not exists cadet_consent_company_idx
  on public.cadet_consent (company, sort_order, name);

-- RLS — matches the existing anon-key admin pattern (read + write via anon).
alter table public.cadet_consent enable row level security;

drop policy if exists cadet_consent_read  on public.cadet_consent;
drop policy if exists cadet_consent_write on public.cadet_consent;
create policy cadet_consent_read  on public.cadet_consent for select using (true);
create policy cadet_consent_write on public.cadet_consent for all    using (true) with check (true);

-- ============================================================================
-- Roster import later: bulk INSERT sectioned by company, e.g.
--   insert into public.cadet_consent (name, company, sort_order) values
--     ('Smith, A.', 'bravo', 1), ('Jones, B.', 'bravo', 2), ...;
-- Staff already mostly collected — seed those as 'collected':
--   insert into public.cadet_consent (name, company, consent_status, collected_at)
--     values ('Doe, C.', 'staff', 'collected', now());
-- ============================================================================
