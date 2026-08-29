-- ============================================================================
-- RAIDER SQUADS — add a male/coed/jv tag to cadet_teams so the email drafter
-- can target "Male Raider Parents" / "Coed Raider Parents". Run in the Supabase
-- SQL editor. Idempotent. Depends on opticsend.sql (cadet_teams) and
-- cadet_consent_contact.sql / cadet_consent_parent2.sql (parent_email[2]).
--
-- WHY: cadet_teams only knows team='raiders' — no varsity-squad split. The
-- /raiderteam page (src/lib/raiderRoster.js RAIDER_TEAMS) is the roster source
-- of truth. This migration seeds a `squad` value onto the raiders cadet_teams
-- rows by name-matching that roster to cadet_consent ONCE, here, where the
-- result can be eyeballed — instead of fuzzy-matching names at every send.
--
-- After running, resolveAudienceEmails() reads cadet_teams.squad directly (no
-- name matching). Ongoing edits happen in DISPATCH → People → Cadet Database
-- (the RAIDERS SQUAD picker), same place team membership is already managed.
--
-- NOT MAGIC: a cadet with no parent_email on their cadet_consent row still
-- won't receive anything — fill those in the Cadet Database. Query (c) at the
-- bottom lists exactly who is missing one.
--
-- No temp tables / helper functions — the Supabase SQL editor does not keep
-- either alive between statements, so the roster VALUES list is repeated in
-- each query below. Edit all four copies together if the roster changes.
-- ============================================================================

-- ── SECTION 1 — column ──────────────────────────────────────────────────────
alter table public.cadet_teams
  add column if not exists squad text check (squad in ('male', 'coed', 'jv'));


-- ── SECTION 2 — seed from the /raiderteam roster ────────────────────────────
-- normalized key on both sides: drop "(Senior)" etc., strip punctuation,
-- collapse whitespace, lowercase.
with roster(nm, squad) as (values
  ('Weston Noblit','male'),('Quincy Tyler','male'),('William Baker (Senior)','male'),
  ('Aidan O''Brien','male'),('Luke Vetsch','male'),('Makaio Roos','male'),
  ('Griffin Blumeyer','male'),('Aiden Clifton','male'),('Zane Youngblood','male'),
  ('Blayne Frazier','male'),('Alex Johnson','male'),('Logan O''Brien','male'),
  ('Hayden Ogle','male'),('Riley Lyles','male'),('Luke Mattison','male'),
  ('Zoe McCollum','coed'),('Amber Davidson','coed'),('Kylie Gray','coed'),
  ('Mya Sneideman','coed'),('Maddie Bassett','coed'),('Bella Bassett','coed'),
  ('Raven Powers','coed'),('Taylor King','coed'),('Chase Otto','coed'),
  ('Levi Fosdick','coed'),('Bryson Frazier','coed'),('Cooper Higginbotham','coed'),
  ('William Baker (Freshman)','coed'),('Sean Layson','coed'),('James Bunch','coed'),
  ('Hayden Ogle','jv'),('Avery Fosdick','jv'),('Grayson Mercier','jv'),
  ('Mason Myers','jv'),('Jordan Elsea','jv'),('Jayde Walker','jv'),
  ('Veronica Coyer','jv'),('Elizabeth Morris','jv'),('Annabelle Settle','jv'),
  ('Hayden Lee','jv'),('James Shelby','jv'),('Miles Holloway','jv'),
  ('Bryson Dodd','jv'),('Luke Chambers','jv'),('Landon McClure','jv'),
  ('Ian Thompson','jv')
),
rn as (
  select squad, nm,
         trim(regexp_replace(regexp_replace(regexp_replace(lower(nm),
           '\([^)]*\)', ' ', 'g'), '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')) as k
  from roster
),
cn as (
  select id,
         trim(regexp_replace(regexp_replace(lower(name),
           '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')) as k
  from public.cadet_consent
),
matched as (
  select distinct on (cn.id) cn.id as cadet_consent_id, rn.squad
  from rn join cn on cn.k = rn.k
  order by cn.id, case rn.squad when 'male' then 1 when 'coed' then 2 else 3 end
)
insert into public.cadet_teams (cadet_consent_id, team, squad)
select cadet_consent_id, 'raiders', squad from matched
on conflict (cadet_consent_id, team) do update set squad = excluded.squad;


-- ── SECTION 3 — review the result (read each output, act on it) ─────────────

-- (a) roster names that matched NO cadet_consent row — add/rename these cadets
--     in the Cadet Database, then re-run SECTION 2:
with roster(nm, squad) as (values
  ('Weston Noblit','male'),('Quincy Tyler','male'),('William Baker (Senior)','male'),
  ('Aidan O''Brien','male'),('Luke Vetsch','male'),('Makaio Roos','male'),
  ('Griffin Blumeyer','male'),('Aiden Clifton','male'),('Zane Youngblood','male'),
  ('Blayne Frazier','male'),('Alex Johnson','male'),('Logan O''Brien','male'),
  ('Hayden Ogle','male'),('Riley Lyles','male'),('Luke Mattison','male'),
  ('Zoe McCollum','coed'),('Amber Davidson','coed'),('Kylie Gray','coed'),
  ('Mya Sneideman','coed'),('Maddie Bassett','coed'),('Bella Bassett','coed'),
  ('Raven Powers','coed'),('Taylor King','coed'),('Chase Otto','coed'),
  ('Levi Fosdick','coed'),('Bryson Frazier','coed'),('Cooper Higginbotham','coed'),
  ('William Baker (Freshman)','coed'),('Sean Layson','coed'),('James Bunch','coed'),
  ('Hayden Ogle','jv'),('Avery Fosdick','jv'),('Grayson Mercier','jv'),
  ('Mason Myers','jv'),('Jordan Elsea','jv'),('Jayde Walker','jv'),
  ('Veronica Coyer','jv'),('Elizabeth Morris','jv'),('Annabelle Settle','jv'),
  ('Hayden Lee','jv'),('James Shelby','jv'),('Miles Holloway','jv'),
  ('Bryson Dodd','jv'),('Luke Chambers','jv'),('Landon McClure','jv'),
  ('Ian Thompson','jv')
),
rn as (
  select squad, nm,
         trim(regexp_replace(regexp_replace(regexp_replace(lower(nm),
           '\([^)]*\)', ' ', 'g'), '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')) as k
  from roster
),
cn as (
  select trim(regexp_replace(regexp_replace(lower(name),
           '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')) as k
  from public.cadet_consent
)
select rn.nm as unmatched_roster_name, rn.squad
from rn
where rn.k not in (select k from cn)
order by rn.squad, rn.nm;

-- (b) roster names that matched MORE THAN ONE cadet — set the squad by hand in
--     the Cadet Database picker for these:
with roster(nm, squad) as (values
  ('Weston Noblit','male'),('Quincy Tyler','male'),('William Baker (Senior)','male'),
  ('Aidan O''Brien','male'),('Luke Vetsch','male'),('Makaio Roos','male'),
  ('Griffin Blumeyer','male'),('Aiden Clifton','male'),('Zane Youngblood','male'),
  ('Blayne Frazier','male'),('Alex Johnson','male'),('Logan O''Brien','male'),
  ('Hayden Ogle','male'),('Riley Lyles','male'),('Luke Mattison','male'),
  ('Zoe McCollum','coed'),('Amber Davidson','coed'),('Kylie Gray','coed'),
  ('Mya Sneideman','coed'),('Maddie Bassett','coed'),('Bella Bassett','coed'),
  ('Raven Powers','coed'),('Taylor King','coed'),('Chase Otto','coed'),
  ('Levi Fosdick','coed'),('Bryson Frazier','coed'),('Cooper Higginbotham','coed'),
  ('William Baker (Freshman)','coed'),('Sean Layson','coed'),('James Bunch','coed'),
  ('Hayden Ogle','jv'),('Avery Fosdick','jv'),('Grayson Mercier','jv'),
  ('Mason Myers','jv'),('Jordan Elsea','jv'),('Jayde Walker','jv'),
  ('Veronica Coyer','jv'),('Elizabeth Morris','jv'),('Annabelle Settle','jv'),
  ('Hayden Lee','jv'),('James Shelby','jv'),('Miles Holloway','jv'),
  ('Bryson Dodd','jv'),('Luke Chambers','jv'),('Landon McClure','jv'),
  ('Ian Thompson','jv')
),
rn as (
  select nm,
         trim(regexp_replace(regexp_replace(regexp_replace(lower(nm),
           '\([^)]*\)', ' ', 'g'), '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')) as k
  from roster
),
cn as (
  select id,
         trim(regexp_replace(regexp_replace(lower(name),
           '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')) as k
  from public.cadet_consent
)
select rn.nm as ambiguous_roster_name, count(distinct cn.id) as cadet_matches
from rn join cn on cn.k = rn.k
group by rn.nm
having count(distinct cn.id) > 1
order by rn.nm;

-- (c) the actual male/coed recipient list + who is missing a parent email:
select cc.name, ct.squad, cc.parent_email, cc.parent_email2,
       (coalesce(cc.parent_email, '') = '' and coalesce(cc.parent_email2, '') = '') as no_parent_email
from public.cadet_teams ct
join public.cadet_consent cc on cc.id = ct.cadet_consent_id
where ct.team = 'raiders' and ct.squad in ('male', 'coed')
order by ct.squad, cc.name;
