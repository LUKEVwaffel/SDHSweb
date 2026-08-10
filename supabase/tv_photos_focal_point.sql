-- ============================================================================
-- TV PHOTOS — focal point columns + update policy.
-- Run in the Supabase SQL editor (idempotent). Extends tv_photos.sql.
--
-- WHY: TvPhotoCarousel.jsx renders every photo with a hardcoded
-- object-position: center, but the carousel box (68% width, full height
-- minus the top strip — see src/lib/tvCarouselAspect.js) is much squarer
-- than people assume, so a full-body/portrait photo center-cropped there
-- routinely loses the top or bottom of the subject. focal_x/focal_y let an
-- admin click "the important part of this photo" once at upload/edit time;
-- the carousel then biases object-position toward that point instead of the
-- geometric center.
--
-- Normalized 0..1, image-space (0,0 = top-left, 1,1 = bottom-right), default
-- 0.5/0.5 (center) so every existing row keeps today's behavior until
-- someone deliberately edits its crop.
-- ============================================================================

alter table public.tv_photos
  add column if not exists focal_x numeric not null default 0.5,
  add column if not exists focal_y numeric not null default 0.5;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tv_photos_focal_x_range'
  ) then
    alter table public.tv_photos
      add constraint tv_photos_focal_x_range check (focal_x >= 0 and focal_x <= 1);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tv_photos_focal_y_range'
  ) then
    alter table public.tv_photos
      add constraint tv_photos_focal_y_range check (focal_y >= 0 and focal_y <= 1);
  end if;
end $$;

-- tv_photos.sql shipped with no UPDATE policy at all — its workflow was
-- delete + re-upload only. Editing just the crop on an already-assigned
-- photo shouldn't force a full delete/reupload cycle, so this adds a
-- narrow update policy scoped the same way as insert/delete (Luke-only).
drop policy if exists tv_photos_update on public.tv_photos;

create policy tv_photos_update on public.tv_photos
  for update to authenticated
  using (public.is_luke())
  with check (public.is_luke());

grant update on public.tv_photos to authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select focal_x, focal_y from public.tv_photos limit 1; -- expect 0.5, 0.5 on existing rows
--   select * from pg_policies where tablename = 'tv_photos' and policyname = 'tv_photos_update';
-- ============================================================================
