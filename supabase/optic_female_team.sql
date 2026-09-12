-- ============================================================================
-- OPTIC 2.0 — add 'female' as a raider team category. Run in the Supabase
-- SQL editor. Idempotent, additive.
--
-- The Spring Hill MOI has THREE divisions (Male, Coed, Female), not two —
-- rhea_comp_photos.sql's raider_team/team check constraints only allowed
-- male/coed/both. This widens both to include 'female' so Female-team photos
-- and sub-events can be tagged and filtered correctly. Client side:
-- src/lib/opticComp.js (RAIDER_TEAM_LABEL), src/components/optic/Optic.jsx
-- (TEAM_FILTERS), src/components/optic/LukePwa.jsx (TEAMS) all updated to match.
-- ============================================================================

alter table public.photos drop constraint if exists photos_raider_team_check;
alter table public.photos
  add constraint photos_raider_team_check
  check (raider_team in ('male', 'coed', 'female', 'both'));

alter table public.raider_sub_events drop constraint if exists raider_sub_events_team_check;
alter table public.raider_sub_events
  add constraint raider_sub_events_team_check
  check (team in ('male', 'coed', 'female', 'both'));
