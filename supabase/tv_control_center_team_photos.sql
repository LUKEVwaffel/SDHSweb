-- ============================================================================
-- Follow-up to tv_control_center.sql: adds "Team Photos" as a third photo
-- source (the default — shows whatever's already on file for the featured
-- team, no event pick required) alongside the existing 'event'/'upload'
-- modes, and is the target of the Photo Source tab's "switch back to team
-- photos" action after an upload batch. Run in the Supabase SQL editor
-- (idempotent) — safe whether or not tv_control_center.sql already ran.
-- ============================================================================

alter table public.tv_daily_settings
  drop constraint if exists tv_daily_settings_photo_source_mode_check;

alter table public.tv_daily_settings
  add constraint tv_daily_settings_photo_source_mode_check
  check (photo_source_mode is null or photo_source_mode in ('team', 'event', 'upload'));
