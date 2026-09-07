-- ============================================================================
-- RAFTING TRIP PHOTOS — flat public gallery for the rafting trip, uploaded
-- from DISPATCH → Rafting Trip and shown at /rafting (grid + lightbox).
-- Run in the Supabase SQL editor (idempotent).
--
-- Deliberately its own tiny table, NOT beta_event_spotlight and NOT
-- public.events: this is a standalone one-off photo set, any s6 admin can
-- fill it, no calendar entry, no sub-events. Mirrors the RLS + storage
-- shape of supabase/beta_event_spotlight.sql so the anon read / is_admin()
-- write split is identical to every other gallery-feeding table here.
-- ============================================================================

create table if not exists public.rafting_photos (
  id           uuid primary key default gen_random_uuid(),
  path         text not null,
  url          text not null,
  caption      text not null default '',
  sort_order   integer not null default 0,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);

create index if not exists rafting_photos_order_idx
  on public.rafting_photos (sort_order, created_at);

alter table public.rafting_photos enable row level security;

drop policy if exists rafting_photos_read  on public.rafting_photos;
drop policy if exists rafting_photos_write on public.rafting_photos;

-- /rafting reads with the anon key, same as every other public carousel /
-- gallery table in this codebase.
create policy rafting_photos_read on public.rafting_photos
  for select to anon, authenticated using (true);

create policy rafting_photos_write on public.rafting_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.rafting_photos to anon, authenticated;
grant insert, update, delete on public.rafting_photos to authenticated;

-- ── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('rafting-photos', 'rafting-photos', true) on conflict (id) do nothing;

drop policy if exists rafting_photos_obj_read   on storage.objects;
drop policy if exists rafting_photos_obj_insert on storage.objects;
drop policy if exists rafting_photos_obj_delete on storage.objects;

create policy rafting_photos_obj_read on storage.objects
  for select using (bucket_id = 'rafting-photos');

create policy rafting_photos_obj_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'rafting-photos' and public.is_admin());

create policy rafting_photos_obj_delete on storage.objects
  for delete to authenticated using (bucket_id = 'rafting-photos' and public.is_admin());

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select count(*) from public.rafting_photos;
--   select * from storage.buckets where id = 'rafting-photos';
-- ============================================================================
