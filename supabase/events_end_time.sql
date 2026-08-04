-- ============================================================================
-- EVENTS END TIME — optional end_time column alongside event_time. Not part
-- of events_ironclad.sql's posted-required-fields gate: an event can be
-- posted with only a start time, same as before this migration. Run in the
-- Supabase SQL editor. Idempotent.
-- ============================================================================

alter table public.events
  add column if not exists end_time time;

-- ============================================================================
-- Verify: \d public.events   -- confirm end_time column present
-- ============================================================================
