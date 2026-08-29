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
-- (the Raiders squad picker), same place team membership is already managed.
--
-- NOT MAGIC: a cadet with no parent_email on their cadet_consent row still
-- won't receive anything — fill those in the Cadet Database. The final SELECT
-- below lists exactly who is missing one.
-- ============================================================================

-- ── SECTION 1 — column ──────────────────────────────────────────────────────
alter table public.cadet_teams
  add column if not exists squad text check (squad in ('male', 'coed', 'jv'));


-- ── SECTION 2 — seed from the /raiderteam roster ────────────────────────────
drop table if exists _raider_roster;
create temp table _raider_roster (nm text, squad text);
insert into _raider_roster (nm, squad) values
  -- MALE VARSITY
  ('Weston Noblit','male'),('Quincy Tyler','male'),('William Baker (Senior)','male'),
  ('Aidan O''Brien','male'),('Luke Vetsch','male'),('Makaio Roos','male'),
  ('Griffin Blumeyer','male'),('Aiden Clifton','male'),('Zane Youngblood','male'),
  ('Blayne Frazier','male'),('Alex Johnson','male'),('Logan O''Brien','male'),
  ('Hayden Ogle','male'),('Riley Lyles','male'),('Luke Mattison','male'),
  -- CO-ED VARSITY
  ('Zoe McCollum','coed'),('Amber Davidson','coed'),('Kylie Gray','coed'),
  ('Mya Sneideman','coed'),('Maddie Bassett','coed'),('Bella Bassett','coed'),
  ('Raven Powers','coed'),('Taylor King','coed'),('Chase Otto','coed'),
  ('Levi Fosdick','coed'),('Bryson Frazier','coed'),('Cooper Higginbotham','coed'),
  ('William Baker (Freshman)','coed'),('Sean Layson','coed'),('James Bunch','coed'),
  -- JUNIOR VARSITY
  ('Hayden Ogle','jv'),('Avery Fosdick','jv'),('Grayson Mercier','jv'),
  ('Mason Myers','jv'),('Jordan Elsea','jv'),('Jayde Walker','jv'),
  ('Veronica Coyer','jv'),('Elizabeth Morris','jv'),('Annabelle Settle','jv'),
  ('Hayden Lee','jv'),('James Shelby','jv'),('Miles Holloway','jv'),
  ('Bryson Dodd','jv'),('Luke Chambers','jv'),('Landon McClure','jv'),
  ('Ian Thompson','jv');

-- normalized match key: drop "(Senior)" etc., strip punctuation, collapse space
create or replace function pg_temp._nk(t text) returns text language sql immutable as $$
  select trim(regexp_replace(
           regexp_replace(regexp_replace(lower(t), '\([^)]*\)', ' ', 'g'), '[^a-z ]', ' ', 'g'),
           '\s+', ' ', 'g'))
$$;

-- one squad per cadet, male > coed > jv when the roster lists a cadet twice
with matched as (
  select distinct on (cc.id)
         cc.id as cadet_consent_id,
         r.squad
  from _raider_roster r
  join public.cadet_consent cc on pg_temp._nk(cc.name) = pg_temp._nk(r.nm)
  order by cc.id, case r.squad when 'male' then 1 when 'coed' then 2 else 3 end
)
insert into public.cadet_teams (cadet_consent_id, team, squad)
select cadet_consent_id, 'raiders', squad from matched
on conflict (cadet_consent_id, team) do update set squad = excluded.squad;


-- ── SECTION 3 — review the result (read the output, act on it) ──────────────

-- (a) roster names that matched NO cadet_consent row — add/rename these cadets
--     in the Cadet Database, then re-run this file:
select r.nm as unmatched_roster_name, r.squad
from _raider_roster r
where not exists (
  select 1 from public.cadet_consent cc where pg_temp._nk(cc.name) = pg_temp._nk(r.nm)
)
order by r.squad, r.nm;

-- (b) roster names that matched MORE THAN ONE cadet — fix the squad by hand in
--     the Cadet Database picker for these:
select r.nm as ambiguous_roster_name, r.squad, count(*) as matches
from _raider_roster r
join public.cadet_consent cc on pg_temp._nk(cc.name) = pg_temp._nk(r.nm)
group by r.nm, r.squad
having count(*) > 1
order by r.nm;

-- (c) the actual male/coed recipient list + who is missing a parent email:
select cc.name, ct.squad, cc.parent_email, cc.parent_email2,
       (coalesce(cc.parent_email,'') = '' and coalesce(cc.parent_email2,'') = '') as no_parent_email
from public.cadet_teams ct
join public.cadet_consent cc on cc.id = ct.cadet_consent_id
where ct.team = 'raiders' and ct.squad in ('male', 'coed')
order by ct.squad, cc.name;

drop table if exists _raider_roster;
