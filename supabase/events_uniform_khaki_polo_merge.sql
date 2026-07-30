-- ============================================================================
-- EVENTS UNIFORM MERGE — collapse 'Khaki' and 'Polo' into one option
-- 'Khaki and Polo'. Run in the Supabase SQL editor. Idempotent.
--
-- Depends on: events_calendar.sql (uniform column), events_ironclad.sql
-- (events_uniform_type_check, events_posted_requires_fields_check — both
-- constrain `uniform` to the old 4-value list and must be redefined here).
-- ============================================================================

-- ── 1. Migrate existing data before tightening the constraints ─────────────
update public.events
  set uniform = 'Khaki and Polo'
  where uniform in ('Khaki', 'Polo');

-- ── 2. Uniform type constrained to the 3 options, only enforced when
-- required=true.
alter table public.events drop constraint if exists events_uniform_type_check;
alter table public.events
  add constraint events_uniform_type_check
  check (uniform_required = false or uniform in ('Class A', 'Class B', 'Khaki and Polo')) not valid;

-- ── 3. Re-create the iron-clad posted-fields gate with the same 3-value list.
alter table public.events drop constraint if exists events_posted_requires_fields_check;
alter table public.events
  add constraint events_posted_requires_fields_check
  check (
    status = 'draft' or (
      title is not null and title <> '' and
      date is not null and
      category is not null and
      event_time is not null and
      (uniform_required = false or uniform in ('Class A', 'Class B', 'Khaki and Polo')) and
      (transportation_required = false or (transportation is not null and transportation <> '')) and
      (permission_slip_required = false or permission_slip_url is not null)
    )
  ) not valid;

-- ============================================================================
-- Verify: select distinct uniform from public.events;
--         \d public.events   -- confirm both constraints show the 3-value list
-- ============================================================================
