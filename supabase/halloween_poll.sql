-- ============================================================================
-- HALLOWEEN BASH POLL — public yes/no poll for all cadets.
-- Run in the Supabase SQL editor (idempotent, safe to re-run).
--
-- Single question: "Do you want a Halloween Bash this year? (costume party)"
-- One row per device (src/components/HalloweenPoll.jsx, route /halloween).
-- Anonymous — no name captured, so public SELECT is safe (choice + timestamp
-- only) and the page can show a live yes/no tally after voting.
--
-- Access mirrors optic_survey.sql: anon insert allowed, device-fingerprint
-- unique constraint caps one vote per device, delete restricted to admins.
-- ============================================================================

create table if not exists public.halloween_poll_votes (
  id          uuid primary key default gen_random_uuid(),
  choice      text not null check (choice in ('yes', 'no')),
  device_fp   text not null,
  created_at  timestamptz not null default now(),
  unique (device_fp)
);

alter table public.halloween_poll_votes enable row level security;
select public._drop_all_policies('halloween_poll_votes');

-- No PII on this table (just choice + timestamp), so public read is safe
-- and lets the poll page show a live tally right after voting.
create policy halloween_poll_votes_read on public.halloween_poll_votes
  for select to anon, authenticated using (true);
create policy halloween_poll_votes_insert_public on public.halloween_poll_votes
  for insert to anon, authenticated with check (true);
create policy halloween_poll_votes_delete_admin on public.halloween_poll_votes
  for delete to authenticated using (public.is_admin());

-- ── Comments — "what do you want to see at the bash?" ──────────────────────
-- Separate table from the votes: free text is not safe to expose via public
-- SELECT the way a bare choice/count is, so this stays admin-only to read.
-- One comment per device (unique device_fp), same insert-then-done shape.
create table if not exists public.halloween_poll_comments (
  id          uuid primary key default gen_random_uuid(),
  comment     text not null check (char_length(btrim(comment)) between 1 and 500),
  device_fp   text not null,
  created_at  timestamptz not null default now(),
  unique (device_fp)
);

alter table public.halloween_poll_comments enable row level security;
select public._drop_all_policies('halloween_poll_comments');

create policy halloween_poll_comments_insert_public on public.halloween_poll_comments
  for insert to anon, authenticated with check (true);
create policy halloween_poll_comments_read_admin on public.halloween_poll_comments
  for select to authenticated using (public.is_admin());
create policy halloween_poll_comments_delete_admin on public.halloween_poll_comments
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- Verify:
--   select choice, count(*) from public.halloween_poll_votes group by 1;
--   select comment, created_at from public.halloween_poll_comments order by created_at desc;
-- ============================================================================
