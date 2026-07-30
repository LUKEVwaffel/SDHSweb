-- ============================================================================
-- EVENTS STATUS DEFAULT FIX — new events default to 'draft', not 'posted'.
-- Run in the Supabase SQL editor. Idempotent.
--
-- BACKGROUND: events_calendar.sql set `status default 'posted'` and force-
-- backfilled every existing row to 'posted' when the column was added. That
-- was fine for the one-time seed/migration, but leaving the column default
-- at 'posted' means any future insert that omits status (direct API call,
-- new code path) silently goes public. EventsPanel.jsx's own emptyForm()
-- already defaults new events to 'draft' — this makes the DB match.
--
-- Does NOT touch existing row values — only the default applied on new
-- inserts. Admins must still manually review/UNPOST any already-posted
-- events that should actually be drafts (see EventsPanel UNPOST button).
-- ============================================================================

alter table public.events
  alter column status set default 'draft';
