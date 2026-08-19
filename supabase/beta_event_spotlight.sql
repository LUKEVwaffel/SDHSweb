-- ============================================================================
-- BETA EVENT SPOTLIGHT — one-off, not-on-the-calendar event write-up + up to
-- 10 photos, shown on the homepage and as a Range TV slideshow slide.
-- Run in the Supabase SQL editor (idempotent).
--
-- Singleton table: exactly one row, edited from DISPATCH → Beta Features.
-- `active` toggles visibility on both the homepage band and the TV slide
-- without deleting the content — the beta can be switched off after the day
-- without losing the write-up or photos. Distinct from public.events (this
-- is explicitly NOT a calendar event — see BetaFeaturesPanel.jsx) and from
-- tv_photos (that table is folder-scoped team photos, Luke-only; this is a
-- single freeform spotlight, any s6/s5 admin).
-- ============================================================================

create table if not exists public.beta_event_spotlight (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default '',
  description  text not null default '',
  people       text not null default '',
  event_date   date,
  photos       jsonb not null default '[]'::jsonb check (jsonb_array_length(photos) <= 10),
  active       boolean not null default true,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Added after the table's initial ship — plain ALTER instead of the
-- create-table default so this stays idempotent whether this file runs
-- once (fresh install, column already there) or twice (already-live table).
alter table public.beta_event_spotlight add column if not exists event_date date;

alter table public.beta_event_spotlight enable row level security;

drop policy if exists beta_event_spotlight_read   on public.beta_event_spotlight;
drop policy if exists beta_event_spotlight_write  on public.beta_event_spotlight;

-- Homepage + the /tv/range kiosk both read with the anon key, same as every
-- other carousel/slide-feeding table in this codebase.
create policy beta_event_spotlight_read on public.beta_event_spotlight
  for select to anon, authenticated using (true);

create policy beta_event_spotlight_write on public.beta_event_spotlight
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.beta_event_spotlight to anon, authenticated;
grant insert, update, delete on public.beta_event_spotlight to authenticated;

-- ── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('beta-event-photos', 'beta-event-photos', true) on conflict (id) do nothing;

drop policy if exists beta_event_photos_obj_read   on storage.objects;
drop policy if exists beta_event_photos_obj_insert on storage.objects;
drop policy if exists beta_event_photos_obj_delete on storage.objects;

create policy beta_event_photos_obj_read on storage.objects
  for select using (bucket_id = 'beta-event-photos');

create policy beta_event_photos_obj_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'beta-event-photos' and public.is_admin());

create policy beta_event_photos_obj_delete on storage.objects
  for delete to authenticated using (bucket_id = 'beta-event-photos' and public.is_admin());

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select * from public.beta_event_spotlight;
--   select * from storage.buckets where id = 'beta-event-photos';
-- ============================================================================
