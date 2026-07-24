-- ============================================================================
-- ITEM 1 — RLS RETIGHTEN (companion to real Supabase Auth).
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- BACKGROUND: every table currently ships `using(true) with check(true)`, which
-- means the PUBLIC anon key can read AND write everything — the passcode gated
-- only the UI. This migration replaces those blanket policies with role-scoped
-- ones now that the admin authenticates via Supabase Auth:
--
--   role `anon`          = unauthenticated visitor using the public anon key
--   role `authenticated` = a signed-in admin (Luke / Kaiden)
--
-- CLASSIFICATION (derived from actual reads/writes in src/):
--   PUBLIC-READ    keep anon SELECT, writes → authenticated only
--   PUBLIC-INSERT  anon may INSERT (signup / photo submit), rest authenticated
--   LOCKED         authenticated for ALL ops — anon loses read too (PII/admin)
--
-- HOW TO RUN SAFELY: run ONE section at a time, then reload the PUBLIC site and
-- confirm it still renders (Staff, Companies, Raiders, gallery, newsletter,
-- voting). Sections are ordered lowest-risk first. Each section fully replaces
-- any prior policies on its table via a dynamic DROP, so re-running is safe and
-- prior policy names don't matter.
--
-- NOT COVERED HERE: Supabase Storage bucket policies (team-photos,
-- personnel-photos, site-assets) are separate RLS and still anon-open so public
-- images keep loading. Lock those in a follow-up once tested — flagged, not an
-- oversight.
-- ============================================================================

-- Helper: drop every existing policy on a table so we can recreate cleanly.
create or replace function public._drop_all_policies(tbl text)
returns void language plpgsql as $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = tbl
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
  end loop;
end $$;


-- ============================================================================
-- SECTION A — PUBLIC-READ tables. anon SELECT; writes authenticated-only.
--   personnel, page_content, events, photo_bulletin, polls, team_stats, votes
-- (votes: public writes go through the cast_vote RPC, not direct INSERT — see
--  SECTION D note. Direct writes here are admin-only.)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'personnel','page_content','events','photo_bulletin','polls','team_stats','votes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    perform public._drop_all_policies(t);
    -- public read
    execute format($p$create policy %I on public.%I for select to anon, authenticated using (true)$p$,
      t||'_read_public', t);
    -- admin-only writes
    execute format($p$create policy %I on public.%I for insert to authenticated with check (true)$p$,
      t||'_insert_auth', t);
    execute format($p$create policy %I on public.%I for update to authenticated using (true) with check (true)$p$,
      t||'_update_auth', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (true)$p$,
      t||'_delete_auth', t);
  end loop;
end $$;


-- ============================================================================
-- SECTION B — PUBLIC-INSERT tables. anon may INSERT; reads/edits vary.
-- ============================================================================

-- photos: public gallery read (anon SELECT) + public submit (anon INSERT);
-- edit/delete admin-only.
alter table public.photos enable row level security;
select public._drop_all_policies('photos');
create policy photos_read_public   on public.photos for select to anon, authenticated using (true);
create policy photos_insert_public on public.photos for insert to anon, authenticated with check (true);
create policy photos_update_auth   on public.photos for update to authenticated using (true) with check (true);
create policy photos_delete_auth   on public.photos for delete to authenticated using (true);

-- email_subscribers: newsletter signup is anon INSERT ONLY. The subscriber list
-- must NOT be anon-readable (was leaking every email under the anon key) — SELECT
-- and all edits are authenticated-only now.
alter table public.email_subscribers enable row level security;
select public._drop_all_policies('email_subscribers');
create policy email_subscribers_insert_public on public.email_subscribers for insert to anon, authenticated with check (true);
create policy email_subscribers_read_auth     on public.email_subscribers for select to authenticated using (true);
create policy email_subscribers_update_auth   on public.email_subscribers for update to authenticated using (true) with check (true);
create policy email_subscribers_delete_auth   on public.email_subscribers for delete to authenticated using (true);


-- ============================================================================
-- SECTION C — LOCKED tables. authenticated for ALL ops. anon loses read+write.
--   cadet_consent (PII), change_log, admin_settings, dispatch_pages,
--   dispatch_registry, dispatch_widgets, element_styles, email_messages,
--   gallery, upcoming_events
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'cadet_consent','change_log','admin_settings','dispatch_pages','dispatch_registry',
    'dispatch_widgets','element_styles','email_messages','gallery','upcoming_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    perform public._drop_all_policies(t);
    execute format($p$create policy %I on public.%I for all to authenticated using (true) with check (true)$p$,
      t||'_all_auth', t);
  end loop;
end $$;


-- ============================================================================
-- SECTION D — cast_vote RPC check (voting must survive the votes lockdown).
--
-- Public voting calls SB.rpc('cast_vote', ...). For anon to vote after SECTION A
-- (votes now has NO anon INSERT policy), cast_vote MUST be SECURITY DEFINER so it
-- runs as its owner and bypasses RLS. Verify:
--
--   select proname, prosecdef from pg_proc where proname = 'cast_vote';
--   -- prosecdef must be TRUE.
--
-- If prosecdef is FALSE, either make it definer:
--   alter function public.cast_vote(uuid, uuid, text, text) security definer;
-- (adjust arg types to match your signature) OR add an anon INSERT policy on
-- votes. Prefer SECURITY DEFINER so the vote path stays server-controlled.
-- ============================================================================

-- Cleanup helper (optional): drop public._drop_all_policies once migration done.
-- drop function if exists public._drop_all_policies(text);
