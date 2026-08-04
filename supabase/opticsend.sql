-- ============================================================================
-- OPTICSEND — Raiders-only automated photo-reminder pipeline (beta).
-- Run in the Supabase SQL editor. Idempotent.
-- Depends on: admin_roles.sql (is_s6/is_s5), events_calendar.sql (events),
-- cadet_consent_contact.sql (cadet_consent.school_email/parent_email),
-- email_review.sql + email_builder.sql (email_messages), photo_hub_v2.sql
-- (pg_cron already enabled by that migration).
--
-- WHAT THIS ADDS:
--   • voting_topics / event_voting_topics — reusable suggested-topic catalog
--     for photo-event voting, picked per-event instead of freeform text.
--     Metadata only this round — does NOT rewire the existing hardcoded
--     Funny/Aura/Team-Leading vote-casting engine (photos.votes_*, cast_vote
--     RPC). Making voting itself topic-driven is a separate, larger phase.
--   • personnel_teams — directory-only team tag on `personnel` (the ~50-100
--     person leadership directory). Cosmetic; does not feed OpticSend.
--   • cadet_teams — the REAL team-membership table, on `cadet_consent` (the
--     actual full cadet roster + staff contact rows). This is what
--     generate_opticsend_drafts() reads for recipients — team-membership and
--     school_email/parent_email live on the same row, so no name-matching is
--     needed at send time (a deliberate deviation from spec wording — see
--     conversation).
--   • opticsend_drafts — idempotency marker (one row per event ever drafted),
--     so a cron re-run or retry can never double-draft the same event.
--   • email_messages.source / .recipient_emails — `source` flags an
--     OpticSend-origin draft for the Overview badge; `recipient_emails`, when
--     non-null/non-empty, makes send-email target that exact list instead of
--     broadcasting to every email_subscribers row (see send-email code change,
--     tracked separately — this migration only adds the column).
--   • generate_opticsend_drafts() + daily cron — the automated trigger.
--   • events RLS amendment — S-5 (previously battalion-only, team IS NULL)
--     may now also insert/update events where team = 'raiders' specifically.
--     Delete stays battalion-only for S-5 (spec only asked for create/edit).
--     Every other team (rifle/academic/drill) stays out of S-5's reach.
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;


-- ── SECTION 1 — voting topics catalog + per-event selection ─────────────────
create table if not exists public.voting_topics (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.event_voting_topics (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  topic_id   uuid not null references public.voting_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, topic_id)
);
create index if not exists event_voting_topics_event_idx on public.event_voting_topics(event_id);

insert into public.voting_topics (slug, label, sort_order) values
  ('mvp-of-the-day',      'MVP of the Day',        1),
  ('most-improved',       'Most Improved',         2),
  ('best-squad-energy',   'Best Squad Energy',     3),
  ('toughest-grind',      'Toughest Grind',        4),
  ('clutch-moment',       'Clutch Moment',         5),
  ('best-vibes',          'Best Vibes',            6),
  ('biggest-glow-up',     'Biggest Glow-Up',       7),
  ('most-photogenic',     'Most Photogenic',       8)
on conflict (slug) do nothing;


-- ── SECTION 2 — team-membership: personnel (directory tag, cosmetic) ────────
create table if not exists public.personnel_teams (
  id            uuid primary key default gen_random_uuid(),
  personnel_id  text not null references public.personnel(id) on delete cascade,
  team          text not null check (team in ('raiders','rifle','academic','drill')),
  created_at    timestamptz not null default now(),
  unique (personnel_id, team)
);
create index if not exists personnel_teams_personnel_idx on public.personnel_teams(personnel_id);


-- ── SECTION 3 — team-membership: cadet_consent (the real roster — drives
-- OpticSend recipients) ──────────────────────────────────────────────────────
create table if not exists public.cadet_teams (
  id                 uuid primary key default gen_random_uuid(),
  cadet_consent_id   uuid not null references public.cadet_consent(id) on delete cascade,
  team               text not null check (team in ('raiders','rifle','academic','drill')),
  created_at         timestamptz not null default now(),
  unique (cadet_consent_id, team)
);
create index if not exists cadet_teams_consent_idx on public.cadet_teams(cadet_consent_id);
create index if not exists cadet_teams_team_idx     on public.cadet_teams(team);


-- ── SECTION 4 — OpticSend idempotency marker ─────────────────────────────────
create table if not exists public.opticsend_drafts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null unique references public.events(id) on delete cascade,
  message_id uuid references public.email_messages(id) on delete set null,
  created_at timestamptz not null default now()
);


-- ── SECTION 5 — email_messages columns ───────────────────────────────────────
alter table public.email_messages
  add column if not exists source           text not null default 'admin' check (source in ('admin','opticsend')),
  add column if not exists recipient_emails  text[];


-- ── SECTION 6 — generate_opticsend_drafts() ──────────────────────────────────
-- Runs daily via cron (SECTION 8). SECURITY DEFINER so it can write
-- email_messages/opticsend_drafts regardless of the calling role's RLS —
-- cron fires as `postgres`, which already bypasses RLS, but SECURITY DEFINER
-- + a pinned search_path keeps this consistent with every other RPC in this
-- codebase (cast_vote, finalize_poll, etc.) and safe if ever invoked another way.
--
-- Site origin: hardcoded below, NOT read from an env var — plpgsql has no
-- access to Supabase Edge Function secrets (WEBAUTHN_ORIGIN, used the same
-- way by supabase/functions/_shared/http.ts's siteOrigin()). If the production
-- domain ever changes, update the literal below to match.
create or replace function public.generate_opticsend_drafts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_origin  constant text := 'https://www.sdhsjrotc.com';
  v_admin_email  constant text := 'nositenoproblem12@gmail.com'; -- seeded S-6, admin_roles.sql SECTION 1
  v_enabled      boolean;
  v_recipients   text[];
  r              record;
  v_subject      text;
  v_body         text;
  v_submit_url   text;
  v_content      jsonb;
  v_msg_id       uuid;
  n              int := 0;
begin
  -- Kill switch (Advanced → Settings). to_jsonb(...) normalizes whatever type
  -- admin_settings.value actually is (boolean or jsonb) before extracting —
  -- defensive against a column-type assumption this migration doesn't control.
  select coalesce((to_jsonb(value) #>> '{}')::boolean, true) into v_enabled
    from public.admin_settings where key = 'opticsend_auto_enabled';
  if v_enabled is null then v_enabled := true; end if;
  if not v_enabled then return 0; end if;

  -- Static for this run: every Raiders cadet's school + parent email, deduped.
  -- Team-membership and the emails live on the same cadet_consent row, so no
  -- cross-table name-matching is needed here (see file header).
  select array_agg(email) into v_recipients from (
    select lower(cc.school_email) as email
      from public.cadet_teams ct join public.cadet_consent cc on cc.id = ct.cadet_consent_id
     where ct.team = 'raiders' and cc.school_email is not null and cc.school_email <> ''
    union
    select lower(cc.parent_email)
      from public.cadet_teams ct join public.cadet_consent cc on cc.id = ct.cadet_consent_id
     where ct.team = 'raiders' and cc.parent_email is not null and cc.parent_email <> ''
  ) recips;

  for r in
    select e.id, e.title, e.date
      from public.events e
     where e.team = 'raiders'
       and e.will_have_pictures = true
       and e.status = 'posted'
       and e.date = (current_date - 1)
       and not exists (select 1 from public.opticsend_drafts d where d.event_id = e.id)
  loop
    v_subject    := format('OpticSend reminder: upload photos from "%s"', r.title);
    v_submit_url := format('%s/submit?event=%s', v_site_origin, r.id);

    -- Plaintext fallback (used verbatim if content_json/body_html are ever
    -- unavailable at send time — see email_builder.sql's documented fallback).
    v_body := format(
      $body$Reminder: upload photos from %s (%s) to OPTIC.

Submit here: %s$body$,
      r.title, to_char(r.date, 'FMMonth DD, YYYY'), v_submit_url
    );

    -- Real block structure — same shape EmailBuilder.jsx/blocks.js produces
    -- (heading { text, level }, text { text }, button { label, href }) so
    -- this renders exactly like a hand-built branded email, not a single
    -- wall-of-text block. `id` just needs to be a stable unique string for
    -- the builder's dnd-kit keys — format doesn't need to match the client's
    -- newId() exactly.
    v_content := jsonb_build_array(
      jsonb_build_object(
        'id', 'blk_' || replace(gen_random_uuid()::text, '-', ''),
        'type', 'heading', 'level', 1,
        'text', format('Photos Needed: %s', r.title)
      ),
      jsonb_build_object(
        'id', 'blk_' || replace(gen_random_uuid()::text, '-', ''),
        'type', 'text',
        'text', format(
          $txt$This is a reminder to upload photos from %s (%s) to OPTIC.

Every photo submitted goes into the event's photo vote. Tap the button below to get started.$txt$,
          r.title, to_char(r.date, 'FMMonth DD, YYYY')
        )
      ),
      jsonb_build_object(
        'id', 'blk_' || replace(gen_random_uuid()::text, '-', ''),
        'type', 'button',
        'label', 'SUBMIT PHOTOS →',
        'href', v_submit_url
      )
    );

    -- recipient_emails stays NULL if no Raiders contacts are on file yet —
    -- the draft still lands so S-6 sees it (via the Overview badge) and can
    -- fix the roster before submitting for review; send-email would then
    -- need recipient_emails populated before it could actually send.
    insert into public.email_messages (subject, body, content_json, status, created_by, source, recipient_emails)
    values (v_subject, v_body, v_content, 'draft', v_admin_email, 'opticsend',
            case when v_recipients is not null and array_length(v_recipients, 1) > 0 then v_recipients else null end)
    returning id into v_msg_id;

    insert into public.opticsend_drafts (event_id, message_id) values (r.id, v_msg_id);
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on every newly created
-- function — SECURITY DEFINER does NOT change that. Without this revoke,
-- any anon caller could invoke this via PostgREST (supabase.rpc(...)) ahead
-- of the cron schedule. Same posture as account_picker.sql / reviewer_pin.sql.
revoke execute on function public.generate_opticsend_drafts() from public;
revoke all     on function public.generate_opticsend_drafts() from anon, authenticated;


-- ── SECTION 7 — Row Level Security ───────────────────────────────────────────
alter table public.voting_topics        enable row level security;
alter table public.event_voting_topics  enable row level security;
alter table public.personnel_teams      enable row level security;
alter table public.cadet_teams          enable row level security;
alter table public.opticsend_drafts     enable row level security;

-- voting_topics: public-read catalog (same posture as achievements), s6-write.
select public._drop_all_policies('voting_topics');
create policy voting_topics_read_public on public.voting_topics for select to anon, authenticated using (true);
create policy voting_topics_ins_s6      on public.voting_topics for insert to authenticated with check (public.is_s6());
create policy voting_topics_upd_s6      on public.voting_topics for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy voting_topics_del_s6      on public.voting_topics for delete to authenticated using (public.is_s6());

-- event_voting_topics: public-read (non-sensitive, mirrors events' own
-- public-read posture). Write: s6 anywhere, s5 ONLY on events they can
-- already touch under the amended events RLS (battalion or team='raiders') —
-- mirrors events_ins_admin/events_upd_admin below exactly, so this table's
-- write scope can never exceed what S-5 can already do to the parent event.
select public._drop_all_policies('event_voting_topics');
create policy event_voting_topics_read_public on public.event_voting_topics
  for select to anon, authenticated using (true);
create policy event_voting_topics_write_admin on public.event_voting_topics
  for all to authenticated
  using (
    public.is_s6() or (
      public.is_s5() and exists (
        select 1 from public.events e
         where e.id = event_voting_topics.event_id and (e.team is null or e.team = 'raiders')
      )
    )
  )
  with check (
    public.is_s6() or (
      public.is_s5() and exists (
        select 1 from public.events e
         where e.id = event_voting_topics.event_id and (e.team is null or e.team = 'raiders')
      )
    )
  );

-- personnel_teams: mirrors personnel itself (public-read, s6-write only —
-- directory metadata, not team-scoped for s5 since it's cosmetic, not tied to
-- the events S-5 can edit).
select public._drop_all_policies('personnel_teams');
create policy personnel_teams_read_public on public.personnel_teams for select to anon, authenticated using (true);
create policy personnel_teams_ins_s6      on public.personnel_teams for insert to authenticated with check (public.is_s6());
create policy personnel_teams_upd_s6      on public.personnel_teams for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy personnel_teams_del_s6      on public.personnel_teams for delete to authenticated using (public.is_s6());

-- cadet_teams: mirrors cadet_consent's own lockdown (s6-only, no anon/s5
-- read or write at all) — this table sits on top of cadet_consent, which is
-- already in admin_roles.sql SECTION 3d's LOCKED set. S-5's new Raiders-event
-- access does NOT extend here; only S-6 manages cadet team-membership.
select public._drop_all_policies('cadet_teams');
create policy cadet_teams_all_s6 on public.cadet_teams
  for all to authenticated using (public.is_s6()) with check (public.is_s6());

-- opticsend_drafts: internal bookkeeping, s6-read-only visibility (cron writes
-- via SECURITY DEFINER, bypassing RLS regardless).
select public._drop_all_policies('opticsend_drafts');
create policy opticsend_drafts_read_s6 on public.opticsend_drafts
  for select to authenticated using (public.is_s6());


-- ── SECTION 8 — cron: generate drafts daily ─────────────────────────────────
-- 13:00 UTC ≈ 8-9am Eastern depending on DST (America/New_York is UTC-5/-4).
-- Supabase Postgres runs in UTC; adjust the hour below if the drift across
-- DST transitions ever matters for this use case (it currently doesn't — a
-- few hours' slip in "the day after" notification timing is harmless).
do $$ begin perform cron.unschedule('opticsend-daily'); exception when others then null; end $$;
select cron.schedule('opticsend-daily', '0 13 * * *', $$select public.generate_opticsend_drafts()$$);


-- ── SECTION 9 — events RLS amendment: S-5 gains team='raiders' ──────────────
-- Replaces the events_ins_admin/events_upd_admin policies from admin_roles.sql
-- SECTION 3b. Re-running admin_roles.sql SECTION 3 after this file would
-- revert S-5 back to battalion-only — if that file is ever re-run, re-run
-- this SECTION 9 afterward to restore the Raiders grant.
drop policy if exists events_ins_admin on public.events;
drop policy if exists events_upd_admin on public.events;
create policy events_ins_admin on public.events for insert to authenticated
  with check (public.is_s6() or (public.is_s5() and (team is null or team = 'raiders')));
create policy events_upd_admin on public.events for update to authenticated
  using      (public.is_s6() or (public.is_s5() and (team is null or team = 'raiders')))
  with check (public.is_s6() or (public.is_s5() and (team is null or team = 'raiders')));
-- events_del_admin is intentionally UNCHANGED — S-5 deletion stays
-- battalion-only. Spec asked for create/edit, not delete.


-- ============================================================================
-- Done. Verify:
--   select * from cron.job where jobname = 'opticsend-daily';
--   select public.generate_opticsend_drafts();  -- manual dry run, returns count
-- ============================================================================
