-- ============================================================================
-- RAIDER CONGRATS — public-safe (name, company) view over cadet_consent.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- cadet_consent holds the real ~154-cadet roster but is LOCKED to
-- authenticated s6 only (see auth_rls.sql SECTION C) because the table also
-- carries consent status, emails, and birthdates. Range TV's congrats banner
-- (RaiderCongratsBanner.jsx, an unauthenticated public kiosk) only needs
-- name + company to cross-reference against the hardcoded Raider roster in
-- src/lib/raiderRoster.js — so expose exactly those two columns, nothing
-- else, via a view that runs as its owner (security_invoker = false) and
-- reads past the RLS lockdown on the base table. Same pattern as
-- public.login_accounts in account_picker.sql.
-- ============================================================================

create or replace view public.cadet_company_roster
with (security_invoker = false) as
  select name, company
  from public.cadet_consent;

grant select on public.cadet_company_roster to anon, authenticated;
