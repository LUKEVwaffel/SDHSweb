-- ============================================================================
-- CADET BIRTHDATES — extends `cadet_consent`, same pattern as
-- cadet_consent_contact.sql / cadet_consent_grade_let.sql (nullable columns
-- on the existing roster, not a new table). Run in the Supabase SQL editor
-- (project bjgyvmdzcymruunzavni). Idempotent for the ALTERs; the UPDATE
-- matches by exact `name` = 'First Last' against existing rows only — it
-- does NOT insert new cadets, since `company` (alpha/bravo/charlie/delta/
-- staff) isn't known from the source roster and is NOT NULL on this table.
--
-- Source: LET 2/4/5/6 class roster (64 cadets). grade/let_level are
-- overwritten to match this roster; birthdate/gender are set alongside.
--
-- PRIVACY NOTE: minors' birthdates. cadet_consent.sql's own comment claims
-- anon-readable, but that's stale — admin_roles.sql SECTION 3d locks this
-- table to s6-only (authenticated + is_s6()), no anon access at all, and
-- tv_shoutouts.sql already documents that lockdown. Live-verified against
-- the anon key (REST API, 2026-08-11): cadet_consent returns 0 rows to anon
-- (content-range: */0) despite having real rows, while personnel (genuinely
-- public-read) returns data through the same key — confirms RLS is
-- actually blocking anon here, not just table emptiness. Safe to store.
--
-- COLUMN NAME NOTE: tv_shoutouts.sql already added `birthdate` (no
-- underscore) to this table and reads it for the TV birthday shoutout.
-- Using that existing column below instead of introducing a duplicate
-- `birthdate`.
-- ============================================================================

alter table public.cadet_consent
  add column if not exists gender text; -- 'M' | 'F'

with roster (name, gender, grade, let_level, birthdate) as (
  values
    -- LET 2
    ('Victoria Averill',            'F', '9', '2', date '2012-05-30'),
    ('Madalynn Bassett',            'F', '9', '2', date '2011-12-01'),
    ('Analee Brown',                'F', '9', '2', date '2012-02-28'),
    ('Kyrsten Coleman',             'F', '9', '2', date '2012-02-08'),
    ('Elizabeth Cribbs',            'F', '9', '2', date '2011-10-12'),
    ('Alaysia Daniel',              'F', '9', '2', date '2012-02-27'),
    ('Brisyn Delgado',              'M', '9', '2', date '2011-10-17'),
    ('Bentley Forrest',             'M', '9', '2', date '2011-10-14'),
    ('Elijah Freeman',              'M', '9', '2', date '2011-12-07'),
    ('Adrianna Hall',               'F', '9', '2', date '2012-02-16'),
    ('Miles Holloway',              'M', '9', '2', date '2012-08-02'),
    ('Isabell Howard',              'F', '9', '2', date '2011-10-27'),
    ('Aireonna Jordan',             'F', '9', '2', date '2012-06-25'),
    ('Mason McMeans',               'M', '9', '2', date '2011-06-07'),
    ('Ally Stucki',                 'F', '9', '2', date '2011-10-05'),
    ('Cristopher Trujillo Arevalo', 'M', '9', '2', date '2012-07-13'),

    -- LET 4
    ('Elijah Amos',                 'M', '9',  '4', date '2012-05-22'),
    ('Griffin Blumeyer',            'M', '9',  '4', date '2011-07-18'),
    ('Cameron Covert',              'M', '10', '4', date '2011-05-26'),
    ('Carson Cowden',               'M', '9',  '4', date '2011-09-27'),
    ('Amber Davidson',              'F', '11', '4', date '2010-06-09'),
    ('Bryson Dodd',                 'M', '9',  '4', date '2012-07-08'),
    ('Audrey Dozier',               'F', '9',  '4', date '2011-03-23'),
    ('Addison Hudson',              'F', '9',  '4', date '2010-11-30'),
    ('Kai Kahn',                    'M', '9',  '4', date '2012-01-23'),
    ('Itzel Maravilla Santes',      'F', '9',  '4', date '2011-05-08'),
    ('Hannah Mason',                'F', '9',  '4', date '2012-01-09'),
    ('Shyla Murphy',                'F', '9',  '4', date '2012-04-26'),
    ('Regio Reynolds',              'M', '9',  '4', date '2011-11-20'),
    ('John Sisk',                   'M', '9',  '4', date '2012-05-24'),
    ('Alexander Snyder',            'M', '9',  '4', date '2011-10-20'),
    ('Bryson Stanford',             'M', '9',  '4', date '2012-06-03'),
    ('Ian Thompson',                'M', '9',  '4', date '2012-04-08'),

    -- LET 5
    ('Eli Alvarado',                'M', '9',  '5', date '2012-07-12'),
    ('William Baker',               'M', '12', '5', date '2011-08-29'),
    ('Isabella Bassett',            'F', '9',  '5', date '2011-12-01'),
    ('Karson Blaubach',             'M', '9',  '5', date '2012-07-02'),
    ('Joseph Conner',               'M', '9',  '5', date '2011-09-12'),
    ('Bentley Inman',               'M', '9',  '5', date '2011-03-08'),
    ('Makynlee Kidd',               'F', '10', '5', date '2011-07-03'),
    ('Hayden Lee',                  'M', '9',  '5', date '2012-04-17'),
    ('Adaliah Pierce',              'F', '9',  '5', date '2011-09-22'),
    ('Orion Pyburn',                'M', '9',  '5', date '2012-05-04'),
    ('Alisson Roman Castro',        'F', '9',  '5', date '2011-11-24'),
    ('Austin Sanders',              'M', '9',  '5', date '2012-06-19'),
    ('Kadence Smith',               'M', '9',  '5', date '2011-08-26'),
    ('Santiago Solano Salcedo',     'M', '9',  '5', date '2012-02-06'),
    ('Lexas Toscani',               'M', '9',  '5', date '2011-12-13'),
    ('Weston Williams',             'M', '9',  '5', date '2012-03-16'),

    -- LET 6
    ('Crymson Beeler',              'F', '9', '6', date '2012-04-07'),
    ('Caleb Bridges',               'M', '9', '6', date '2012-04-05'),
    ('Kaylei Burt',                 'F', '9', '6', date '2011-10-19'),
    ('Kyle Clifton',                'M', '9', '6', date '2011-10-11'),
    ('Jordan Elsea',                'M', '9', '6', date '2012-04-18'),
    ('Brayton Ferry',               'M', '9', '6', date '2012-07-07'),
    ('Avery Fosdick',               'F', '9', '6', date '2012-06-15'),
    ('Surisley Gutierrez Pineiro',  'F', '9', '6', date '2011-09-18'),
    ('Kyler Harvey',                'M', '9', '6', date '2012-08-06'),
    ('George Heiberger',            'M', '9', '6', date '2011-12-14'),
    ('Riley Lyles',                 'M', '9', '6', date '2012-05-26'),
    ('Isaac Raines',                'M', '9', '6', date '2011-12-08'),
    ('Ella Reed',                   'F', '9', '6', date '2010-12-16'),
    ('Mikayla Roos',                'F', '9', '6', date '2011-12-05'),
    ('Cinthia Sanchez Garfias',     'F', '9', '6', date '2011-12-04'),
    ('Scarlett Ward',               'F', '9', '6', date '2012-03-27')
)
update public.cadet_consent c
set birthdate = r.birthdate,
    gender     = r.gender,
    grade      = r.grade,
    let_level  = r.let_level,
    updated_at = now()
from roster r
where c.name = r.name;

-- Diagnostic: roster names with no matching row in cadet_consent — these were
-- NOT inserted (no `company` known for them). Add manually once you know
-- which company (alpha/bravo/charlie/delta) each belongs to:
--   insert into public.cadet_consent (name, company, grade, let_level, birthdate, gender)
--     values ('First Last', 'alpha', '9', '2', date '2012-05-30', 'F');
with roster (name) as (
  values
    ('Victoria Averill'), ('Madalynn Bassett'), ('Analee Brown'), ('Kyrsten Coleman'),
    ('Elizabeth Cribbs'), ('Alaysia Daniel'), ('Brisyn Delgado'), ('Bentley Forrest'),
    ('Elijah Freeman'), ('Adrianna Hall'), ('Miles Holloway'), ('Isabell Howard'),
    ('Aireonna Jordan'), ('Mason McMeans'), ('Ally Stucki'), ('Cristopher Trujillo Arevalo'),
    ('Elijah Amos'), ('Griffin Blumeyer'), ('Cameron Covert'), ('Carson Cowden'),
    ('Amber Davidson'), ('Bryson Dodd'), ('Audrey Dozier'), ('Addison Hudson'),
    ('Kai Kahn'), ('Itzel Maravilla Santes'), ('Hannah Mason'), ('Shyla Murphy'),
    ('Regio Reynolds'), ('John Sisk'), ('Alexander Snyder'), ('Bryson Stanford'),
    ('Ian Thompson'), ('Eli Alvarado'), ('William Baker'), ('Isabella Bassett'),
    ('Karson Blaubach'), ('Joseph Conner'), ('Bentley Inman'), ('Makynlee Kidd'),
    ('Hayden Lee'), ('Adaliah Pierce'), ('Orion Pyburn'), ('Alisson Roman Castro'),
    ('Austin Sanders'), ('Kadence Smith'), ('Santiago Solano Salcedo'), ('Lexas Toscani'),
    ('Weston Williams'), ('Crymson Beeler'), ('Caleb Bridges'), ('Kaylei Burt'),
    ('Kyle Clifton'), ('Jordan Elsea'), ('Brayton Ferry'), ('Avery Fosdick'),
    ('Surisley Gutierrez Pineiro'), ('Kyler Harvey'), ('George Heiberger'), ('Riley Lyles'),
    ('Isaac Raines'), ('Ella Reed'), ('Mikayla Roos'), ('Cinthia Sanchez Garfias'),
    ('Scarlett Ward')
)
select r.name as unmatched_roster_name
from roster r
left join public.cadet_consent c on c.name = r.name
where c.name is null
order by r.name;
