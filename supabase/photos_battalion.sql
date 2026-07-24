-- ============================================================================
-- Allow general BATTALION photos in the photos table.
-- Run in the Supabase SQL editor. Idempotent.
--
-- WHY: most photos are general battalion photos, not tied to a specialty team.
-- The photos.team CHECK previously allowed only ('raiders','rifle','academic',
-- 'drill'), so a battalion submission was rejected. This widens it to include
-- 'battalion'. event_id stays nullable (only raider event photos attach to a
-- poll), so battalion photos simply carry team='battalion', event_id=NULL.
-- ============================================================================
alter table public.photos
  drop constraint if exists photos_team_check;

alter table public.photos
  add constraint photos_team_check
  check (team in ('battalion','raiders','rifle','academic','drill'));
