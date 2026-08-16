-- ============================================================================
-- DD FORM 3203 (JAN 2024) + JROTC CADET PERSONAL DATASHEET — two more
-- per-person forms tracked on `cadet_consent`, same pattern as the existing
-- photo-consent status (see cadet_consent.sql). Applies to every row in the
-- table — cadets AND staff (company='staff') are both in `cadet_consent`, so
-- no separate staff table is needed. Run in the Supabase SQL editor (project
-- bjgyvmdzcymruunzavni). Idempotent.
--
-- S-6 tracks these two independently of photo consent: everyone was handed a
-- packet and both forms are due back 2026-08-31.
-- ============================================================================

alter table public.cadet_consent
  add column if not exists dd3203_status text not null default 'pending'
    check (dd3203_status in ('pending','collected','declined')),
  add column if not exists dd3203_collected_at timestamptz,
  add column if not exists dd3203_collected_by text,

  add column if not exists datasheet_status text not null default 'pending'
    check (datasheet_status in ('pending','collected','declined')),
  add column if not exists datasheet_collected_at timestamptz,
  add column if not exists datasheet_collected_by text;
