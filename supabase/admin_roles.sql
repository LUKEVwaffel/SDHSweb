-- ============================================================================
-- ROLE-BASED ACCESS CONTROL for DISPATCH.
-- Run in the Supabase SQL editor (idempotent). READ THE WARNINGS.
--
-- Two roles:
--   s6 = full DISPATCH (Luke). Read/write everything.
--   s5 = scoped account. Read/write ONLY the main battalion calendar
--        (events where team IS NULL). No team calendars, no other panel.
--
-- Enforcement is server-side (RLS below) using the caller's email from the JWT,
-- not just the UI. A crafted request from an s5 token still cannot write team
-- events or any other admin table.
--
-- ⚠ LOCKOUT WARNING: after SECTION 3 runs, writes to admin tables require an
-- admin_roles row with role='s6' matching your Supabase Auth login email. If the
-- seeded email in SECTION 1 does NOT match the email you actually log in with,
-- you will lose write access in the app. Fixes if that happens:
--   • the service_role key (Supabase dashboard) always bypasses RLS — use the
--     SQL editor to correct/add your admin_roles row, then reload the app.
-- RECOMMENDED ORDER: run SECTION 1 + 2, confirm your email is present and
-- correct, THEN run SECTION 3.
-- ============================================================================


-- ── SECTION 1 — roles table + seed ──────────────────────────────────────────
create table if not exists public.admin_roles (
  email      text primary key,
  role       text not null default 's6' check (role in ('s6','s5')),
  created_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

-- An admin may read ONLY their own role row (client reads it to gate the UI).
drop policy if exists admin_roles_read_self on public.admin_roles;
create policy admin_roles_read_self on public.admin_roles
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
-- No anon/authenticated writes — manage roles in the dashboard / service role.

-- Seed the S-6 admin. ⚠ CHANGE this to your real login email if different, and
-- add extra rows if you log in with more than one address.
--
-- CORRECTED 2026-08-06: this line previously read 'nositenoproblem12@gmail.com',
-- which never matched reality — that address has zero rows in auth.users and
-- never signed into DISPATCH. The live admin_roles table was already correctly
-- seeded with lukevetsch77@gmail.com (Luke's actual, actively-used login;
-- confirmed via auth.users.last_sign_in_at) — this file had just drifted out
-- of sync with what was actually run against the database. Fixed here so a
-- fresh environment (or anyone re-running this idempotent seed) reproduces the
-- real seed instead of a dead placeholder address.
insert into public.admin_roles (email, role) values
  ('lukevetsch77@gmail.com', 's6')
on conflict (email) do update set role = excluded.role;

-- The S-5 account: create the user in Supabase Auth → Users first, then add its
-- row here (uncomment and set the email):
-- insert into public.admin_roles (email, role) values
--   ('s5-account@example.com', 's5')
-- on conflict (email) do update set role = excluded.role;


-- ── SECTION 2 — role helper functions ───────────────────────────────────────
-- SECURITY DEFINER so they can read admin_roles regardless of that table's RLS.
create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admin_roles
  where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
$$;

create or replace function public.is_s6()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() = 's6';
$$;

create or replace function public.is_s5()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() = 's5';
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.admin_role() in ('s6','s5');
$$;


-- ── SECTION 3 — role-scoped RLS ─────────────────────────────────────────────
-- Reuses public._drop_all_policies(text) from auth_rls.sql. Each block fully
-- recreates SELECT + write policies so re-running is safe.

-- 3a. PUBLIC-READ tables. Public may read; only s6 may write.
do $$
declare t text;
begin
  foreach t in array array[
    'personnel','page_content','photo_bulletin','polls','team_stats','votes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    perform public._drop_all_policies(t);
    execute format($p$create policy %I on public.%I for select to anon, authenticated using (true)$p$, t||'_read_public', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (public.is_s6())$p$, t||'_ins_s6', t);
    execute format($p$create policy %I on public.%I for update to authenticated using (public.is_s6()) with check (public.is_s6())$p$, t||'_upd_s6', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (public.is_s6())$p$, t||'_del_s6', t);
  end loop;
end $$;

-- 3b. events — the shared calendar. Public read. s6 writes anything; s5 writes
-- ONLY battalion rows (team IS NULL) and cannot move a row into a team calendar.
alter table public.events enable row level security;
select public._drop_all_policies('events');
create policy events_read_public on public.events for select to anon, authenticated using (true);
create policy events_ins_admin on public.events for insert to authenticated
  with check (public.is_s6() or (public.is_s5() and team is null));
create policy events_upd_admin on public.events for update to authenticated
  using      (public.is_s6() or (public.is_s5() and team is null))
  with check (public.is_s6() or (public.is_s5() and team is null));
create policy events_del_admin on public.events for delete to authenticated
  using      (public.is_s6() or (public.is_s5() and team is null));

-- 3c. PUBLIC-INSERT tables. Keep anon insert (public submit/signup); s6-only
-- read/edit where the data is sensitive.
alter table public.photos enable row level security;
select public._drop_all_policies('photos');
create policy photos_read_public   on public.photos for select to anon, authenticated using (true);
create policy photos_insert_public on public.photos for insert to anon, authenticated with check (true);
create policy photos_update_s6     on public.photos for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy photos_delete_s6     on public.photos for delete to authenticated using (public.is_s6());

alter table public.email_subscribers enable row level security;
select public._drop_all_policies('email_subscribers');
create policy email_subscribers_insert_public on public.email_subscribers for insert to anon, authenticated with check (true);
create policy email_subscribers_read_s6       on public.email_subscribers for select to authenticated using (public.is_s6());
create policy email_subscribers_update_s6     on public.email_subscribers for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy email_subscribers_delete_s6     on public.email_subscribers for delete to authenticated using (public.is_s6());

-- 3d. LOCKED tables — s6 only for everything (PII / admin data). s5 cannot read.
--
-- email_messages is handled OUTSIDE this loop on purpose. _drop_all_policies
-- drops EVERY policy on a table regardless of name — fine for the other 7
-- tables here (s6-only is the whole story), but email_messages also carries
-- reviewer-only SELECT policies added later (email_review.sql,
-- email_review_visibility.sql: email_messages_read_reviewer,
-- email_messages_read_reviewer_history). Those files run AFTER this one in
-- the documented SQL order, so a first-time run is fine — but this script is
-- explicitly documented as safe to re-run idempotently (see the file header),
-- and a re-run would silently nuke the reviewer policies along with
-- everything else on the table, blinding the review portal with no error
-- anywhere. Drop ONLY the named s6 policy instead, so a re-run can never
-- collateral-damage a policy this file doesn't own.
do $$
declare t text;
begin
  foreach t in array array[
    'cadet_consent','admin_settings','dispatch_pages','dispatch_registry',
    'dispatch_widgets','element_styles','gallery'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    perform public._drop_all_policies(t);
    execute format($p$create policy %I on public.%I for all to authenticated using (public.is_s6()) with check (public.is_s6())$p$, t||'_all_s6', t);
  end loop;
end $$;

alter table public.email_messages enable row level security;
drop policy if exists email_messages_all_s6 on public.email_messages;
create policy email_messages_all_s6 on public.email_messages
  for all to authenticated
  using (public.is_s6()) with check (public.is_s6());

-- 3e. change_log — ANY admin may INSERT (so s5's calendar edits still log), but
-- only s6 may read/modify the history.
alter table public.change_log enable row level security;
select public._drop_all_policies('change_log');
create policy change_log_insert_admin on public.change_log for insert to authenticated with check (public.is_admin());
create policy change_log_read_s6      on public.change_log for select to authenticated using (public.is_s6());
create policy change_log_update_s6    on public.change_log for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy change_log_delete_s6    on public.change_log for delete to authenticated using (public.is_s6());

-- NOTE: public voting still calls the cast_vote RPC (SECURITY DEFINER), which
-- bypasses the votes write lockdown above — unchanged from auth_rls.sql.
