-- ============================================================================
-- Photo blur editor — undo support.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: photos_blur_update_grant.sql.
--
-- Blurring uploads a new storage object and deletes the old one, so without
-- tracking there's nothing left to revert to. These columns hold the
-- pre-blur storage_path/photo_url/thumb_url, set the FIRST time a photo is
-- blurred (never overwritten by a second blur pass, so they always point at
-- the true original) and cleared once the blur is removed.
-- ============================================================================

alter table public.photos
  add column if not exists orig_photo_url    text,
  add column if not exists orig_thumb_url    text,
  add column if not exists orig_storage_path text;

grant update (photo_url, thumb_url, storage_path, orig_photo_url, orig_thumb_url, orig_storage_path)
  on public.photos to authenticated;
