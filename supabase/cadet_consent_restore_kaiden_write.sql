-- ============================================================================
-- REVERT: cadet_consent_block_kaiden_write.sql
-- Restores Kaiden's (kg36247@students.hcde.org) write access to cadet_consent
-- by dropping the not-kaiden policies and recreating the blanket is_s6() policy
-- (any s6 = full read/write), matching admin_roles.sql SECTION 3d.
--
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- ============================================================================

drop policy if exists cadet_consent_read_s6           on public.cadet_consent;
drop policy if exists cadet_consent_ins_s6_not_kaiden  on public.cadet_consent;
drop policy if exists cadet_consent_upd_s6_not_kaiden  on public.cadet_consent;
drop policy if exists cadet_consent_del_s6_not_kaiden  on public.cadet_consent;
drop policy if exists cadet_consent_all_s6             on public.cadet_consent;

create policy cadet_consent_all_s6 on public.cadet_consent
  for all to authenticated
  using (public.is_s6()) with check (public.is_s6());

-- VERIFY: select * from pg_policies where tablename = 'cadet_consent';
-- Kaiden's INSERT/UPDATE/DELETE against cadet_consent should work again.
