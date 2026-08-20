-- Add Hayden Ogle as JV Raider Team Commander — new personnel row.
-- Run in the Supabase SQL editor. Idempotent via ON CONFLICT (id) DO NOTHING —
-- safe to re-run, will never duplicate or clobber a later edit made from the
-- Dispatch PeoplePanel (bio_long/photo are expected to be filled in there
-- after this row exists — PeoplePanel has no add-new-row UI, only
-- edit-existing). `bio` and `bio_long` are both NOT NULL on this table
-- (photo_url is not) — empty string, not NULL, on both so the insert
-- doesn't 23502.
--
-- Existing raider commander rows use id 'raider-male' / 'raider-female'
-- (see personnel_bios_import.sql) — 'raider-jv' follows that convention.
-- sort_order is computed as "one past the current max within section='raider'"
-- so this doesn't need to guess the live table's current ordering.
BEGIN;

INSERT INTO personnel (id, name, role_short, role_long, section, bio, bio_long, photo_url, visible, sort_order)
VALUES (
  'raider-jv',
  'Hayden Ogle',
  'JV CMDR',
  'JV Raider Team Commander',
  'raider',
  '',
  '',
  NULL,
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM personnel WHERE section = 'raider')
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
