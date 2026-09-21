-- Extends rifle_signups_review_view (rifle_signup.sql) with roster identity
-- fields from cadet_consent, so Makaio's /rifle/portal SignupsTab shows the
-- same name/company/grade/LET/birthdate DISPATCH's RifleSignupsPanel now
-- does — not just email/phone.
--
-- cadet_consent is locked to s6-only RLS (cadet_consent_birthdates.sql), so
-- a plain rifle-admin or reviewer session can't read it directly. This view
-- already works around that same wall for rifle_signups itself: a view runs
-- with its OWNER's privileges against underlying RLS (Postgres default,
-- unless security_invoker is set — this view doesn't set it), so the WHERE
-- clause below is the entire access gate, same posture as the original view.
drop view if exists public.rifle_signups_review_view;
create view public.rifle_signups_review_view
with (security_barrier = true) as
  select
    rs.id, rs.school_email, rs.personal_email, rs.parent_email, rs.phone,
    rs.is_varsity, rs.created_at,
    cc.name as cadet_name, cc.company as cadet_company, cc.grade as cadet_grade,
    cc.let_level as cadet_let_level, cc.birthdate as cadet_birthdate
  from public.rifle_signups rs
  left join public.cadet_consent cc on lower(cc.school_email) = lower(rs.school_email)
  where public.is_reviewer() or public.is_s6() or public.is_rifle_admin();
grant select on public.rifle_signups_review_view to authenticated;
