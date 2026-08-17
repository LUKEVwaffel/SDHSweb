-- ============================================================================
-- TEMP LOCKDOWN: block Kaiden (kg36247@students.hcde.org) from writing to
-- cadet_consent ONLY. Read stays open to any s6. No other s6-locked table
-- (admin_settings, dispatch_pages, dispatch_registry, dispatch_widgets,
-- element_styles, gallery) is touched — those still use the blanket
-- is_s6() policy from admin_roles.sql SECTION 3d, Kaiden keeps full access
-- there.
--
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- TO REVERT: re-run admin_roles.sql SECTION 3d (the `do $$ ... foreach t in
-- array [...] loop` block) — it drops every policy on cadet_consent and
-- restores the blanket `cadet_consent_all_s6` (any s6 = full read/write).
-- ============================================================================

drop policy if exists cadet_consent_all_s6                 on public.cadet_consent;
drop policy if exists cadet_consent_read_s6                 on public.cadet_consent;
drop policy if exists cadet_consent_ins_s6_not_kaiden       on public.cadet_consent;
drop policy if exists cadet_consent_upd_s6_not_kaiden       on public.cadet_consent;
drop policy if exists cadet_consent_del_s6_not_kaiden       on public.cadet_consent;

create policy cadet_consent_read_s6 on public.cadet_consent
  for select to authenticated
  using (public.is_s6());

create policy cadet_consent_ins_s6_not_kaiden on public.cadet_consent
  for insert to authenticated
  with check (public.is_s6() and lower(auth.jwt() ->> 'email') <> 'kg36247@students.hcde.org');

create policy cadet_consent_upd_s6_not_kaiden on public.cadet_consent
  for update to authenticated
  using      (public.is_s6() and lower(auth.jwt() ->> 'email') <> 'kg36247@students.hcde.org')
  with check (public.is_s6() and lower(auth.jwt() ->> 'email') <> 'kg36247@students.hcde.org');

create policy cadet_consent_del_s6_not_kaiden on public.cadet_consent
  for delete to authenticated
  using (public.is_s6() and lower(auth.jwt() ->> 'email') <> 'kg36247@students.hcde.org');

-- VERIFY: run as Kaiden's session (or check pg_policies) —
--   select * from pg_policies where tablename = 'cadet_consent';
-- Kaiden's own UPDATE/INSERT/DELETE against cadet_consent should now fail
-- (0 rows affected, no error — RLS silently filters, same posture as the
-- rest of this app). His SELECT and every other admin panel stay unaffected.
