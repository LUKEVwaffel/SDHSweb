-- ============================================================================
-- FIX, part A — events_uniform_khaki_polo_merge.sql rebuilt two constraints
-- and dropped exemptions that events_ironclad.sql had:
--   1. events_posted_requires_fields_check lost (category = 'UNIFORM_DAY' or
--      event_time is not null) — posting any Uniform Day event now fails
--      ("...violates check constraint events_posted_requires_fields_check").
--   2. events_posted_requires_fields_check AND events_uniform_type_check both
--      lost (team = 'raiders' or ...) — inserting/posting a Raiders event
--      with uniform_required left false/uniform null now fails
--      ("...violates check constraint events_uniform_type_check").
--
-- FIX, part B — separate, pre-existing bug surfaced by the same repro:
-- EventsPanel.jsx force-sets uniform_required=true the instant UNIFORM_DAY
-- category is picked (missingCore()'s client gate only blocks the POST
-- button, not Save Draft), so saving a brand-new Uniform Day event as a
-- DRAFT — before a uniform type is chosen — sends uniform_required=true,
-- uniform=null. events_uniform_type_check has no draft exemption (unlike
-- events_posted_requires_fields_check), so it rejects the draft too:
-- "new row for relation events violates check constraint
-- events_uniform_type_check". Same latent bug applies to
-- events_transportation_check / events_permission_slip_check if a user
-- toggles YES then saves a draft before filling the detail. All three
-- field-level checks should only bite on post, matching the ironclad gate's
-- intent — draft exemption added to each below.
--
-- Run in Supabase SQL editor. Idempotent.
-- ============================================================================

alter table public.events drop constraint if exists events_uniform_type_check;
alter table public.events
  add constraint events_uniform_type_check
  check (status = 'draft' or team = 'raiders' or uniform_required = false or uniform in ('Class A', 'Class B', 'Khaki and Polo')) not valid;

alter table public.events drop constraint if exists events_transportation_check;
alter table public.events
  add constraint events_transportation_check
  check (status = 'draft' or transportation_required = false or (transportation is not null and transportation <> '')) not valid;

alter table public.events drop constraint if exists events_permission_slip_check;
alter table public.events
  add constraint events_permission_slip_check
  check (status = 'draft' or permission_slip_required = false or permission_slip_url is not null) not valid;

alter table public.events drop constraint if exists events_posted_requires_fields_check;
alter table public.events
  add constraint events_posted_requires_fields_check
  check (
    status = 'draft' or (
      title is not null and title <> '' and
      date is not null and
      category is not null and
      (category = 'UNIFORM_DAY' or event_time is not null) and
      (team = 'raiders' or uniform_required = false or uniform in ('Class A', 'Class B', 'Khaki and Polo')) and
      (transportation_required = false or (transportation is not null and transportation <> '')) and
      (permission_slip_required = false or permission_slip_url is not null)
    )
  ) not valid;

-- ============================================================================
-- Verify: \d public.events
--   events_uniform_type_check         → status='draft' or team='raiders' or ...
--   events_transportation_check       → status='draft' or ...
--   events_permission_slip_check      → status='draft' or ...
--   events_posted_requires_fields_check → (category='UNIFORM_DAY' or event_time...) and (team='raiders' or ...)
-- ============================================================================
