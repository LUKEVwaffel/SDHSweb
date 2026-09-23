-- ============================================================================
-- HALLOWEEN BASH MOVIE POLL — public "what should we watch at the bash?"
-- Run in the Supabase SQL editor (idempotent, safe to re-run).
--
-- Replaces the old yes/no "do you want a bash" poll + idea-comments tables
-- below with a single question: movie suggestions for the bash. Rating is
-- restricted to PG / PG-13 at submission (src/components/HalloweenMoviePoll.jsx,
-- route /halloweenmovie) via a required dropdown and a DB check constraint.
--
-- Anonymous — no name captured, so public SELECT is safe (movie + rating +
-- timestamp only) and the page can show the running suggestion list.
-- ============================================================================

drop table if exists public.halloween_poll_comments;
drop table if exists public.halloween_poll_votes;

create table if not exists public.halloween_movie_suggestions (
  id          uuid primary key default gen_random_uuid(),
  movie       text not null check (char_length(btrim(movie)) between 1 and 120),
  rating      text not null check (rating in ('PG', 'PG-13')),
  device_fp   text not null,
  created_at  timestamptz not null default now(),
  unique (device_fp)
);

alter table public.halloween_movie_suggestions enable row level security;
select public._drop_all_policies('halloween_movie_suggestions');

-- No PII on this table (just movie + rating + timestamp), so public read is
-- safe and lets the poll page show the running suggestion list.
create policy halloween_movie_suggestions_read on public.halloween_movie_suggestions
  for select to anon, authenticated using (true);
create policy halloween_movie_suggestions_insert_public on public.halloween_movie_suggestions
  for insert to anon, authenticated with check (true);
create policy halloween_movie_suggestions_delete_admin on public.halloween_movie_suggestions
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- Verify:
--   select movie, rating, created_at from public.halloween_movie_suggestions order by created_at desc;
-- ============================================================================
