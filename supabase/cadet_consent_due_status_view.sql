-- ============================================================================
-- CONSENT DUE STATUS — public-safe (name, company, dd3203_status,
-- datasheet_status) view over cadet_consent.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- cadet_consent is LOCKED to authenticated s6 only (see auth_rls.sql
-- SECTION C) because it also carries emails, birthdates, and notes. Range
-- TV's Welcome screen (TvRangeCompanyWelcomeScreen.jsx, an unauthenticated
-- public kiosk) needs to list cadets still missing DD Form 3203 / the JROTC
-- Personal Datasheet (both due Aug 31) — so expose exactly those four
-- columns, nothing else, via a view that runs as its owner
-- (security_invoker = false) and reads past the RLS lockdown on the base
-- table. Same pattern as public.cadet_company_roster in
-- cadet_company_roster_view.sql.
-- ============================================================================

create or replace view public.cadet_consent_due_status
with (security_invoker = false) as
  select name, company, dd3203_status, datasheet_status
  from public.cadet_consent;

grant select on public.cadet_consent_due_status to anon, authenticated;
