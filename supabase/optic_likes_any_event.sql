-- ============================================================================
-- OPTIC , likes work on every comp, not just Rhea County.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: rhea_photo_likes.sql, rhea_comp_photos.sql (visibility column).
--
-- BUG: rhea_photo_likes_insert only allowed likes on photos whose event_id was
-- the hardcoded Rhea County event (e8a305fe-…). Since OPTIC follows
-- optic_config.active_event_id (SWITCH COMP), every like on any later comp
-- failed RLS; useOpticLikes then rolled the optimistic heart back, so tapping
-- like looked like it did nothing and no count ever moved.
--
-- FIX: allow a like on any photo the public feed can actually see
-- (visibility = 'public' and status = 'live', same filter as useOpticPhotos'
-- public scope), whatever event it belongs to. Staged / hidden photos stay
-- unlikeable, so the anon key still can't write likes against arbitrary ids.
-- ============================================================================

drop policy if exists rhea_photo_likes_insert on public.rhea_photo_likes;
create policy rhea_photo_likes_insert on public.rhea_photo_likes
  for insert with check (
    photo_id in (
      select id from public.photos
      where visibility = 'public' and status = 'live'
    )
  );

-- Re-sync every photo's like_count, not just Rhea's (safe to re-run).
update public.photos p
   set like_count = coalesce((
     select count(*) from public.rhea_photo_likes l where l.photo_id = p.id
   ), 0)
 where p.like_count is distinct from coalesce((
     select count(*) from public.rhea_photo_likes l where l.photo_id = p.id
   ), 0);


-- ============================================================================
-- VERIFY AFTER RUNNING (as anon, or just check the policy text):
--   select polname, pg_get_expr(polwithcheck, polrelid)
--     from pg_policy where polname = 'rhea_photo_likes_insert';
--   -- should mention visibility/status, NOT e8a305fe-…
-- ============================================================================
