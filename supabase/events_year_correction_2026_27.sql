-- ============================================================================
-- EVENTS YEAR CORRECTION — fix leftover AY2025-26 seed years to the real
-- 2026-27 school year calendar. Run in the Supabase SQL editor. NOT idempotent
-- re-run-safe by date (running twice would double-add a year) — matched by id,
-- run once.
--
-- BACKGROUND: events_calendar.sql seeded the AY2025-26 schedule with dates
-- literally '2025-08-21' etc. Those dates were never re-seeded for the actual
-- 2026-27 school year — every row just needs +1 year (2025→2026, 2026→2027).
-- Confirmed 1:1 against Luke's real 2026-27 calendar by title: every existing
-- row's month/day matches an entry in the real calendar exactly, so this is a
-- straight year shift, not a re-date. One posted row (Home Football Game,
-- 2025-08-21 — edited+posted by Luke on 2026-07-20) is included in this batch.
--
-- Also removes one duplicate: "Daisy feild day" (typo) vs "Daisy Field Day"
-- (correct spelling) — both 2026-05-14, not part of the JROTC battalion
-- calendar (personal/elementary event). Luke confirmed: delete the typo,
-- keep the correct-spelling row untouched (its date is not part of this
-- correction — not in the real 2026-27 calendar being cross-referenced).
-- ============================================================================

-- ── August 2026 ──────────────────────────────────────────────────────────
update public.events set date = '2026-08-21' where id = 'd861fbcc-bb26-4a24-92a5-f8627f78a5dc'; -- Home Football Game (posted)
update public.events set date = '2026-08-29' where id = 'e8a305fe-86cf-4092-a580-5865423271b9'; -- Rhea County Raider Competition

-- ── September 2026 ───────────────────────────────────────────────────────
update public.events set date = '2026-09-04' where id = '1c91bb10-0698-4b35-a81a-6815bb252e70'; -- Home Football Game
update public.events set date = '2026-09-05' where id = 'ebf2bd73-c7a2-41dd-ad0a-6d1bded5301a'; -- Battalion Rafting Trip
update public.events set date = '2026-09-12' where id = 'fa96f288-3b72-484b-bca3-e69c2f5d0ca3'; -- Spring Hill Raider Competition
update public.events set date = '2026-09-18' where id = '91e269be-28f1-4acb-bdca-4cb8f5585086'; -- Home Football Game
update public.events set date = '2026-09-19' where id = '0d0eef63-eff6-4988-bc4a-b9686ccc9dd4'; -- East Hamilton HS Hurricane Battalion Raider Competition
update public.events set date = '2026-09-25' where id = '42efedfd-ffcd-4e71-922d-7c46e8483669'; -- Home Football Game
update public.events set date = '2026-09-26' where id = 'df502ecb-6eb3-4076-8c00-30561f22d82b'; -- Warren County Raider Competition
update public.events set date = '2026-09-30' where id = 'fa2f1a8b-f9a5-4c18-9347-2c1394c4428d'; -- JROTC Blood Drive

-- ── October 2026 ──────────────────────────────────────────────────────────
update public.events set date = '2026-10-03' where id = '0d6f6a10-5cac-43c9-82eb-397b05e116a9'; -- Competition & Trophy Ceremony
update public.events set date = '2026-10-12', end_date = '2026-10-16' where id = 'bf8fa10f-be1a-4834-a1fc-222bedc1dd0f'; -- Fall Break
update public.events set date = '2026-10-27' where id = 'ea2e763e-593b-421e-acaf-f8c84c300612'; -- Rifle Shoulder to Shoulder (SD @ HOW)
update public.events set date = '2026-10-30' where id = '41e9ab1b-d39c-40fe-9fbf-7ac2fcc0ee4a'; -- Home Football Game — Senior Night

-- ── November 2026 ─────────────────────────────────────────────────────────
update public.events set date = '2026-11-03' where id = '7f13c763-e90e-4980-b6f2-8f3ff23f205c'; -- Rifle Shoulder to Shoulder (SD @ EH)
update public.events set date = '2026-11-10' where id = 'd7edf967-e50a-4d23-96ec-caf98be31b11'; -- Rifle Shoulder to Shoulder (SC @ SD)
update public.events set date = '2026-11-17' where id = '4da55eec-ec2e-4155-b0c3-9efcdfd22723'; -- Rifle Shoulder to Shoulder (BRA @ SD)

-- ── December 2026 ─────────────────────────────────────────────────────────
update public.events set date = '2026-12-01' where id = 'd12be4c7-b393-45ac-b24f-9b67aa992831'; -- JROTC Blood Drive
update public.events set date = '2026-12-01' where id = '17ac9c31-3c67-447c-bee8-c3d04229953b'; -- Rifle Shoulder to Shoulder (SD @ CEN)
update public.events set date = '2026-12-06' where id = '8776a1cc-639e-4653-8220-e4699baf4df4'; -- SD Christmas Parade
update public.events set date = '2026-12-08' where id = '7b546694-648d-4a3e-b5d7-64301bb87551'; -- Superintendent's Match

-- ── January 2027 ──────────────────────────────────────────────────────────
update public.events set date = '2027-01-16' where id = 'de8b80c4-50ba-45de-8bac-3e1c64fee811'; -- Red Bank Invitational Drill Competition
update public.events set date = '2027-01-19', end_date = '2027-01-21' where id = '90a4b4da-67d1-43c9-b65a-36f5bacf36d0'; -- East Hamilton HS Academic Bowl
update public.events set date = '2027-01-23' where id = 'bb854540-e36f-4ce7-9705-dce189f124c9'; -- Sale Creek Pot-Licker Drill / Academic Competition

-- ── March 2027 ────────────────────────────────────────────────────────────
update public.events set date = '2027-03-22', end_date = '2027-03-26' where id = '7c3dc324-ef57-4795-ac20-4e7c5bd31c56'; -- Spring Break
update public.events set date = '2027-03-29' where id = 'a421450c-ea8f-4206-95f2-2b91545c9d14'; -- JROTC Blood Drive

-- ── April 2027 ────────────────────────────────────────────────────────────
update public.events set date = '2027-04-20' where id = '609b48ab-e5c3-4f4b-bf78-a48496851726'; -- JROTC Olympics

-- ── May 2027 ──────────────────────────────────────────────────────────────
update public.events set date = '2027-05-07' where id = '74715dbd-d333-47c0-937b-3504581eebfe'; -- 78th Annual Armed Forces Day Parade
update public.events set date = '2027-05-14' where id = '09d027f6-fde1-4e74-a326-9ab968aacb11'; -- Black-Jack Best Cadet Competition
update public.events set date = '2027-05-15' where id = '54fc0e9e-3133-443e-9222-2896d8636d6e'; -- Graduation

-- ── Duplicate cleanup ─────────────────────────────────────────────────────
-- "Daisy feild day" typo dup — not part of JROTC calendar, delete only this row.
-- "Daisy Field Day" (id 416e82e7...) stays untouched, date unchanged.
delete from public.events where id = 'e760effe-564e-4e48-9ba7-b94d68726d52';

-- ============================================================================
-- Verify:
--   select id, title, date, end_date, status from public.events order by date;
--   -- expect 31 rows total (32 - 1 deleted), all dated 2026 or 2027,
--   -- earliest 2026-08-21 (posted), and NO row still reading "Daisy feild day".
-- ============================================================================
