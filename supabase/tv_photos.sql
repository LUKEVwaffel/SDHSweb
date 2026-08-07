-- ============================================================================
-- TV PHOTOS — admin-curated folders that feed the /tv kiosk carousel.
-- Run in the Supabase SQL editor (idempotent).
--
-- 5 folders: one per team in src/lib/teams.js (raiders/rifle/academic/drill)
-- plus 'battalion' for the overall/whole-battalion folder. Distinct from
-- public.photos (photo_hub_v2.sql) — that table is the crowd-sourced,
-- moderated-by-status submission/poll pool; this one is admin-only, direct,
-- no moderation queue, no attribution/voting metadata. Mixing the two would
-- put unvetted public submissions on the kiosk, which is exactly what this
-- table exists to stop.
--
-- RECONCILIATION: this supersedes useTvCarouselPhotos.js's 'team' mode, which
-- previously queried public.photos filtered by team. See src/hooks/useTvCarouselPhotos.js
-- for the client-side repoint — 'team' mode now queries this table instead,
-- scoped to (featured team(s) ∪ battalion), per product decision (Battalion
-- always mixes in alongside whichever team is featured; the existing Featured
-- Team step stays the single source of truth for team scoping — this tab is
-- upload/organize only, not a second selection point).
--
-- WRITE ACCESS: restricted to Luke specifically (is_luke()), not all s6 —
-- per product decision, the TV Photos tab is Luke-only end to end, not just
-- UI-hidden for other admins. Render-gating in the UI hides the tab; this RLS
-- is the actual enforcement (same split the rest of DISPATCH uses — see
-- admin/index.jsx's comment on render-gating vs RLS).
-- ============================================================================

-- Single choke-point for "is this the Luke account" — reused by trusted_devices
-- and the push-tv-spotlight / register-tv-terminal edge functions (Phase 4).
-- A plain email check, not a role: Luke is also 's6' via admin_roles, but this
-- specific surface is intentionally scoped to one person, not the s6 role, per
-- explicit product decision (not a generalized "current owner" abstraction —
-- if this needs to open up to another admin later, that's a deliberate future
-- change to this function, not a role add).
create or replace function public.is_luke()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(auth.jwt() ->> 'email') = 'lukevetsch77@gmail.com';
$$;

create table if not exists public.tv_photos (
  id            uuid primary key default gen_random_uuid(),
  folder        text not null check (folder in ('raiders','rifle','academic','drill','battalion')),
  storage_path  text not null,
  photo_url     text not null,
  uploaded_by   text,
  created_at    timestamptz not null default now()
);
create index if not exists tv_photos_folder_time_idx on public.tv_photos(folder, created_at desc);

alter table public.tv_photos enable row level security;

drop policy if exists tv_photos_read   on public.tv_photos;
drop policy if exists tv_photos_insert on public.tv_photos;
drop policy if exists tv_photos_delete on public.tv_photos;

-- Kiosk reads via the anon key — same public-read shape as every other
-- carousel-feeding table in this codebase.
create policy tv_photos_read on public.tv_photos
  for select to anon, authenticated using (true);

create policy tv_photos_insert on public.tv_photos
  for insert to authenticated with check (public.is_luke());

create policy tv_photos_delete on public.tv_photos
  for delete to authenticated using (public.is_luke());
-- No update policy — the panel's workflow is delete + re-upload, matching
-- MediaPanel.jsx's existing pattern for the generic bucket browser.

grant select on public.tv_photos to anon, authenticated;
grant insert, delete on public.tv_photos to authenticated;

-- ── Storage bucket ───────────────────────────────────────────────────────────
-- Objects are stored at `{folder}/{filename}` so the folder is visible in the
-- path itself. Separate bucket from team-photos (public submissions) and
-- tv-daily-photos (ephemeral upload-mode batch) — keeps the three photo
-- pipelines from ever colliding on a filename or a policy.
insert into storage.buckets (id, name, public)
  values ('tv-team-photos', 'tv-team-photos', true) on conflict (id) do nothing;

drop policy if exists tv_team_photos_obj_read   on storage.objects;
drop policy if exists tv_team_photos_obj_insert on storage.objects;
drop policy if exists tv_team_photos_obj_delete on storage.objects;

create policy tv_team_photos_obj_read on storage.objects
  for select using (bucket_id = 'tv-team-photos');

create policy tv_team_photos_obj_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'tv-team-photos' and public.is_luke());

create policy tv_team_photos_obj_delete on storage.objects
  for delete to authenticated using (bucket_id = 'tv-team-photos' and public.is_luke());

-- ── Realtime publication ─────────────────────────────────────────────────────
-- REQUIRED or postgres_changes streams nothing for this table, no matter how
-- correct the RLS/channel/handler code is — a table's rows are invisible to
-- Realtime until explicitly added here (see dispatch_chat.sql SECTION 5 for
-- the only other place this codebase does it correctly). Wrapped in an
-- existence check (unlike dispatch_chat.sql's bare ALTER) so this file stays
-- truly idempotent — a bare ALTER PUBLICATION ADD TABLE errors on a re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tv_photos'
  ) then
    alter publication supabase_realtime add table public.tv_photos;
  end if;
end $$;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select public.is_luke(); -- run as lukevetsch77@gmail.com, expect true
--   select * from public.tv_photos limit 1;
--   select * from pg_publication_tables where pubname='supabase_realtime' and tablename='tv_photos';
-- ============================================================================
