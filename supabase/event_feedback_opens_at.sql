-- ============================================================================
-- Event feedback lock: cadets can submit feedback right after an event ends,
-- before staff wants it open (e.g. wanting a cooling-off period, or wanting
-- reviews to land after a specific debrief). `feedback_opens_at` is an
-- optional per-event timestamp — null means "open immediately" (unchanged
-- behavior), set means the public form and public picker both stay locked
-- until that instant. Run in the Supabase SQL editor after event_feedback.sql.
-- Idempotent.
-- ============================================================================

alter table public.events
  add column if not exists feedback_opens_at timestamptz;

-- Public insert policy: was "feedback_enabled = true", now also requires the
-- open time (if set) to have passed. Client already hides the form before
-- feedback_opens_at, this is the server-side backstop against a direct/curl
-- insert during the lock window.
drop policy if exists event_feedback_insert_public on public.event_feedback;
create policy event_feedback_insert_public on public.event_feedback
  for insert to anon, authenticated
  with check (
    event_id in (
      select id from public.events
      where feedback_enabled = true
        and (feedback_opens_at is null or feedback_opens_at <= now())
    )
  );

-- ============================================================================
-- Example — lock the Battalion Rafting Trip's feedback until Monday 7:15 AM
-- Eastern (adjust the offset if the event's local tz differs):
--   update public.events set feedback_opens_at = '2026-09-07 07:15:00-04'
--   where title = 'Battalion Rafting Trip';
--
-- Verify: select id, title, feedback_enabled, feedback_opens_at from public.events
--         where feedback_enabled;
-- ============================================================================
