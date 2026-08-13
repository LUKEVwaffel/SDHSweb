-- ============================================================================
-- TV NOTICES — Announcements + Notes from Staff for the Range TV rotation
-- phase (src/components/tv/range/TvRangeRotationLayout.jsx). Run AFTER
-- tv_screens.sql (screen_slug FKs into it) and admin_roles.sql (is_admin()).
-- Run in the Supabase SQL editor. Idempotent.
--
-- One table, not two — Announcements and Staff Notes are the same shape
-- (title + free-text message, staff-typed, persists until manually deleted),
-- differing only by a `category` label. Reusing one table/hook/CRUD component
-- for both avoids duplicating RLS, migrations, and admin UI for identical
-- behavior. screen_slug is included now (not hardcoded to Range) since
-- tv_screens.sql already models multi-screen and every other TV table
-- follows that convention — cheap to add, no new scope.
--
-- No auto-expiration: unlike the manual shoutout field (which goes stale
-- after MANUAL_STALE_DAYS in TvShoutoutsPanel.jsx), these persist until a
-- DISPATCH admin deletes them, per spec.
-- ============================================================================

create table if not exists public.tv_notices (
  id                      uuid primary key default gen_random_uuid(),
  screen_slug             text not null default 'range' references public.tv_screens(slug),
  category                text not null check (category in ('announcement', 'staff_note')),
  title                   text not null,
  message                 text not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by_fingerprint  text
);

create index if not exists tv_notices_screen_category_idx
  on public.tv_notices(screen_slug, category, created_at desc);

create or replace function public.tv_notices_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tv_notices_touch on public.tv_notices;
create trigger trg_tv_notices_touch
  before update on public.tv_notices
  for each row execute function public.tv_notices_touch();

-- RLS: read = anon + authenticated (the /tv kiosk is public, no login, same
-- posture as tv_daily_settings). Write = any authenticated DISPATCH admin
-- (s5 or s6, mirrors the emergency-fields grain in tv_shoutouts.sql) — no PII
-- here, same trust level as the existing manual shoutout/custom message
-- fields, so no S-6-only gate.
alter table public.tv_notices enable row level security;
select public._drop_all_policies('tv_notices');

create policy tv_notices_select on public.tv_notices
  for select to anon, authenticated using (true);

create policy tv_notices_write_admin on public.tv_notices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.tv_notices to anon, authenticated;
grant insert, update, delete on public.tv_notices to authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   insert into public.tv_notices (category, title, message) values
--     ('announcement', 'Test', 'This is a test announcement');
--   select * from public.tv_notices order by created_at desc;
--   -- Confirm anon can read (run over the anon key, not the SQL editor):
--   select id, title from public.tv_notices;
-- ============================================================================
