-- ============================================================================
-- "1SGTnator" daily control center for the /tv kiosk. Run in the Supabase
-- SQL editor (idempotent).
--
-- Singleton row (id = 'default') — one shared control panel across every
-- physical kiosk TV in the building, not per-device like the bell-schedule
-- localStorage choice (that stays as-is; different TVs can legitimately run
-- different bell schedules, but "which team is featured today" is one
-- battalion-wide decision the 1SGT makes once).
--
-- SECURITY NOTE: matches the site's existing low-blast-radius public-write
-- pattern (see team-photos storage policies in photo_hub_v2.sql, and
-- photo_bulletin's `using (true) with check (true)` policy) — anon key can
-- update this row with no login, same as the /tv schedule picker's no-auth
-- gear icon. Every write is stamped with a device fingerprint + timestamp so
-- a bad write is attributable and trivially revertible from the dashboard.
-- Tightened slightly beyond full parity: anon can SELECT and UPDATE the one
-- 'default' row, but cannot INSERT or DELETE — there is never a legitimate
-- reason for the app to create a second row or remove the singleton, so that
-- door is closed at zero cost to the legitimate flow.
-- ============================================================================

create table if not exists public.tv_daily_settings (
  id                    text primary key default 'default',
  featured_teams        text[] not null default '{}',
  photo_source_mode     text check (photo_source_mode is null or photo_source_mode in ('event', 'upload')),
  photo_source_event_id uuid references public.events(id) on delete set null,
  uploaded_photo_urls   text[] not null default '{}',
  bottom_widget_mode    text not null default 'facts' check (bottom_widget_mode in ('facts', 'quote', 'verse', 'custom')),
  custom_message        text,
  custom_signoff        text,
  mode_set_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by_fingerprint text,
  constraint tv_daily_settings_singleton check (id = 'default')
);

insert into public.tv_daily_settings (id) values ('default')
  on conflict (id) do nothing;

-- Bump updated_at on every write, but only bump mode_set_at when the bottom
-- widget's actual content changed — otherwise touching the schedule or
-- featured-team fields would silently reset the idle-fallback clock.
create or replace function public.tv_daily_settings_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if (new.bottom_widget_mode is distinct from old.bottom_widget_mode)
     or (new.custom_message is distinct from old.custom_message)
     or (new.custom_signoff is distinct from old.custom_signoff) then
    new.mode_set_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tv_daily_settings_touch on public.tv_daily_settings;
create trigger trg_tv_daily_settings_touch
  before update on public.tv_daily_settings
  for each row execute function public.tv_daily_settings_touch();

alter table public.tv_daily_settings enable row level security;

drop policy if exists tv_daily_settings_select on public.tv_daily_settings;
drop policy if exists tv_daily_settings_update on public.tv_daily_settings;

create policy tv_daily_settings_select on public.tv_daily_settings
  for select using (true);

create policy tv_daily_settings_update on public.tv_daily_settings
  for update using (id = 'default') with check (id = 'default');

grant select, update on public.tv_daily_settings to anon, authenticated;

-- ── Storage bucket for the 1SGT's direct daily photo uploads ────────────────
-- Deliberately skips the full OPTIC event-photo pipeline (no moderation queue,
-- no attribution metadata) — same open-bucket shape as team-photos in
-- photo_hub_v2.sql, scoped to its own bucket so a bad upload here can't touch
-- the moderated team-photos pool.
insert into storage.buckets (id, name, public)
  values ('tv-daily-photos', 'tv-daily-photos', true) on conflict (id) do nothing;

drop policy if exists tv_daily_photos_obj_read   on storage.objects;
drop policy if exists tv_daily_photos_obj_insert on storage.objects;
drop policy if exists tv_daily_photos_obj_delete on storage.objects;
create policy tv_daily_photos_obj_read   on storage.objects for select using (bucket_id = 'tv-daily-photos');
create policy tv_daily_photos_obj_insert on storage.objects for insert with check (bucket_id = 'tv-daily-photos');
create policy tv_daily_photos_obj_delete on storage.objects for delete using (bucket_id = 'tv-daily-photos');
