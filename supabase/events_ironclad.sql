-- ============================================================================
-- EVENTS IRONCLAD — required-field enforcement before an event can go
-- status='posted' (public). Run in the Supabase SQL editor. Idempotent.
--
-- BACKGROUND: `uniform` and `transportation` were freeform text (see
-- events_calendar.sql). No seeded row ever populated them, so repurposing
-- them into constrained Yes/No + structured-value fields here is safe — no
-- data loss. `time_label` stays as a legacy freeform column (unused by new
-- UI going forward, not dropped) since some old rows may still reference it
-- elsewhere; `event_time` is the new structured AM/PM-capable column.
--
-- DESIGN: client-side (EventsPanel.jsx missingCore()) is the primary UX gate
-- — it disables the POST button. Every constraint below is the DB backstop,
-- added `not valid` so it only applies to future inserts/updates and never
-- retroactively breaks already-posted historical rows (the AY2025-26 seed
-- has no event_time / uniform / transportation / permission slip data).
-- Depends on: events_calendar.sql (adds category/uniform/transportation/
-- status columns), admin_roles.sql (is_s5()/is_s6() for the storage policies).
-- ============================================================================

-- ── 1. New columns ───────────────────────────────────────────────────────
alter table public.events
  add column if not exists event_time              time,
  add column if not exists uniform_required         boolean not null default false,
  add column if not exists transportation_required  boolean not null default false,
  add column if not exists permission_slip_required boolean not null default false,
  add column if not exists permission_slip_url      text;

-- ── 2. Field-level backstops ─────────────────────────────────────────────
-- Multi-day / date-range (end_date) only valid for the Break category —
-- every other category is forced to a single date.
alter table public.events drop constraint if exists events_end_date_break_only_check;
alter table public.events
  add constraint events_end_date_break_only_check
  check (end_date is null or category = 'BREAK') not valid;

-- Uniform type constrained to the 4 options, only enforced when required=true.
alter table public.events drop constraint if exists events_uniform_type_check;
alter table public.events
  add constraint events_uniform_type_check
  check (uniform_required = false or uniform in ('Class A', 'Class B', 'Khaki', 'Polo')) not valid;

-- Transportation detail text required when flagged yes.
alter table public.events drop constraint if exists events_transportation_check;
alter table public.events
  add constraint events_transportation_check
  check (transportation_required = false or (transportation is not null and transportation <> '')) not valid;

-- Permission slip PDF required when flagged yes.
alter table public.events drop constraint if exists events_permission_slip_check;
alter table public.events
  add constraint events_permission_slip_check
  check (permission_slip_required = false or permission_slip_url is not null) not valid;

-- ── 3. THE iron-clad gate — cannot be 'posted' without every required
-- field actually filled in, no matter what path the row was written
-- through (UI bug, direct API call, etc). Drafts are unaffected.
alter table public.events drop constraint if exists events_posted_requires_fields_check;
alter table public.events
  add constraint events_posted_requires_fields_check
  check (
    status = 'draft' or (
      title is not null and title <> '' and
      date is not null and
      category is not null and
      event_time is not null and
      (uniform_required = false or uniform in ('Class A', 'Class B', 'Khaki', 'Polo')) and
      (transportation_required = false or (transportation is not null and transportation <> '')) and
      (permission_slip_required = false or permission_slip_url is not null)
    )
  ) not valid;

-- ── 4. Storage bucket for permission slip PDFs ──────────────────────────
-- PUBLIC (not the private `documents` pattern — see documents.sql) because
-- parents must be able to view/print the slip directly from /events with no
-- login. Write access mirrors the events table RLS in admin_roles.sql
-- SECTION 3b: s6 writes anything, s5 (battalion-only calendar) may also
-- write here since it only ever attaches slips to its own battalion events.
insert into storage.buckets (id, name, public)
  values ('permission-slips', 'permission-slips', true)
  on conflict (id) do update set public = true;

drop policy if exists permission_slips_obj_insert on storage.objects;
drop policy if exists permission_slips_obj_update on storage.objects;
drop policy if exists permission_slips_obj_delete on storage.objects;
create policy permission_slips_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'permission-slips' and (public.is_s6() or public.is_s5()));
create policy permission_slips_obj_update on storage.objects for update to authenticated
  using      (bucket_id = 'permission-slips' and (public.is_s6() or public.is_s5()))
  with check (bucket_id = 'permission-slips' and (public.is_s6() or public.is_s5()));
create policy permission_slips_obj_delete on storage.objects for delete to authenticated
  using      (bucket_id = 'permission-slips' and (public.is_s6() or public.is_s5()));

-- ============================================================================
-- Verify: select * from storage.buckets where id = 'permission-slips';
--         \d public.events   -- confirm new columns + constraints
-- ============================================================================
