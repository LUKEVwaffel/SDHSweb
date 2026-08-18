-- ============================================================================
-- EVENTS — S-5 FULL PARITY WITH S-6. Run in the Supabase SQL editor
-- (idempotent).
--
-- Supersedes:
--   • admin_roles.sql SECTION 3b (events_ins_admin/events_upd_admin/
--     events_del_admin) — originally battalion-only (team IS NULL) for S-5.
--   • opticsend.sql SECTION 9 — widened insert/update to also cover
--     team = 'raiders', left delete battalion-only.
--
-- S-5 now gets the exact same events write access as S-6: any team,
-- insert/update/delete. events_read_public is untouched — read access was
-- already unrestricted for everyone.
--
-- If admin_roles.sql SECTION 3 or opticsend.sql SECTION 9 is ever re-run
-- after this file, it will revert S-5's events grant back to
-- battalion/Raiders-only — re-run this file afterward to restore full
-- parity.
-- ============================================================================

drop policy if exists events_ins_admin on public.events;
drop policy if exists events_upd_admin on public.events;
drop policy if exists events_del_admin on public.events;

create policy events_ins_admin on public.events for insert to authenticated
  with check (public.is_s6() or public.is_s5());
create policy events_upd_admin on public.events for update to authenticated
  using      (public.is_s6() or public.is_s5())
  with check (public.is_s6() or public.is_s5());
create policy events_del_admin on public.events for delete to authenticated
  using      (public.is_s6() or public.is_s5());

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select polname, polcmd from pg_policy where polrelid = 'public.events'::regclass;
--   -- as an S-5-logged-in session, confirm insert/update/delete succeeds on
--   -- a non-battalion, non-Raiders team event.
-- ============================================================================
