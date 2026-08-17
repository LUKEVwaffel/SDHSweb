-- ============================================================================
-- LET 1 CORRECTION — supersedes cadet_consent_birthdates.sql, which mistakenly
-- wrote the "Course" column (2/4/5/6, class-period numbers on the roster PDF)
-- into `let_level`. Every cadet below is actually LET 1. Same 64 names,
-- same birthdates/gender, let_level corrected to '1' for all.
--
-- Matches by exact `name` = 'First Last' against existing cadet_consent rows
-- only — does NOT insert new cadets. Safe to re-run.
--
-- `company` derived from the roster's "Course" (class-period) column, per
-- the actual period→company mapping: 2=alpha, 4=bravo, 5=charlie, 6=delta.
-- Set alongside the other fields in case any matched row has the wrong
-- company on file.
-- ============================================================================

with roster (name, gender, grade, birthdate, company) as (
  values
    ('Victoria Averill',            'F', '9',  date '2012-05-30', 'alpha'),
    ('Madalynn Bassett',            'F', '9',  date '2011-12-01', 'alpha'),
    ('Analee Brown',                'F', '9',  date '2012-02-28', 'alpha'),
    ('Kyrsten Coleman',             'F', '9',  date '2012-02-08', 'alpha'),
    ('Elizabeth Cribbs',            'F', '9',  date '2011-10-12', 'alpha'),
    ('Alaysia Daniel',              'F', '9',  date '2012-02-27', 'alpha'),
    ('Brisyn Delgado',              'M', '9',  date '2011-10-17', 'alpha'),
    ('Bentley Forrest',             'M', '9',  date '2011-10-14', 'alpha'),
    ('Elijah Freeman',              'M', '9',  date '2011-12-07', 'alpha'),
    ('Adrianna Hall',               'F', '9',  date '2012-02-16', 'alpha'),
    ('Miles Holloway',              'M', '9',  date '2012-08-02', 'alpha'),
    ('Isabell Howard',              'F', '9',  date '2011-10-27', 'alpha'),
    ('Aireonna Jordan',             'F', '9',  date '2012-06-25', 'alpha'),
    ('Mason McMeans',               'M', '9',  date '2011-06-07', 'alpha'),
    ('Ally Stucki',                 'F', '9',  date '2011-10-05', 'alpha'),
    ('Cristopher Trujillo Arevalo', 'M', '9',  date '2012-07-13', 'alpha'),
    ('Elijah Amos',                 'M', '9',  date '2012-05-22', 'bravo'),
    ('Griffin Blumeyer',            'M', '9',  date '2011-07-18', 'bravo'),
    ('Cameron Covert',              'M', '10', date '2011-05-26', 'bravo'),
    ('Carson Cowden',               'M', '9',  date '2011-09-27', 'bravo'),
    ('Amber Davidson',              'F', '11', date '2010-06-09', 'bravo'),
    ('Bryson Dodd',                 'M', '9',  date '2012-07-08', 'bravo'),
    ('Audrey Dozier',               'F', '9',  date '2011-03-23', 'bravo'),
    ('Addison Hudson',              'F', '9',  date '2010-11-30', 'bravo'),
    ('Kai Kahn',                    'M', '9',  date '2012-01-23', 'bravo'),
    ('Itzel Maravilla Santes',      'F', '9',  date '2011-05-08', 'bravo'),
    ('Hannah Mason',                'F', '9',  date '2012-01-09', 'bravo'),
    ('Shyla Murphy',                'F', '9',  date '2012-04-26', 'bravo'),
    ('Regio Reynolds',              'M', '9',  date '2011-11-20', 'bravo'),
    ('John Sisk',                   'M', '9',  date '2012-05-24', 'bravo'),
    ('Alexander Snyder',            'M', '9',  date '2011-10-20', 'bravo'),
    ('Bryson Stanford',             'M', '9',  date '2012-06-03', 'bravo'),
    ('Ian Thompson',                'M', '9',  date '2012-04-08', 'bravo'),
    ('Eli Alvarado',                'M', '9',  date '2012-07-12', 'charlie'),
    ('William Baker',               'M', '12', date '2011-08-29', 'charlie'),
    ('Isabella Bassett',            'F', '9',  date '2011-12-01', 'charlie'),
    ('Karson Blaubach',             'M', '9',  date '2012-07-02', 'charlie'),
    ('Joseph Conner',               'M', '9',  date '2011-09-12', 'charlie'),
    ('Bentley Inman',               'M', '9',  date '2011-03-08', 'charlie'),
    ('Makynlee Kidd',               'F', '10', date '2011-07-03', 'charlie'),
    ('Hayden Lee',                  'M', '9',  date '2012-04-17', 'charlie'),
    ('Adaliah Pierce',              'F', '9',  date '2011-09-22', 'charlie'),
    ('Orion Pyburn',                'M', '9',  date '2012-05-04', 'charlie'),
    ('Alisson Roman Castro',        'F', '9',  date '2011-11-24', 'charlie'),
    ('Austin Sanders',              'M', '9',  date '2012-06-19', 'charlie'),
    ('Kadence Smith',               'M', '9',  date '2011-08-26', 'charlie'),
    ('Santiago Solano Salcedo',     'M', '9',  date '2012-02-06', 'charlie'),
    ('Lexas Toscani',               'M', '9',  date '2011-12-13', 'charlie'),
    ('Weston Williams',             'M', '9',  date '2012-03-16', 'charlie'),
    ('Crymson Beeler',              'F', '9',  date '2012-04-07', 'delta'),
    ('Caleb Bridges',               'M', '9',  date '2012-04-05', 'delta'),
    ('Kaylei Burt',                 'F', '9',  date '2011-10-19', 'delta'),
    ('Kyle Clifton',                'M', '9',  date '2011-10-11', 'delta'),
    ('Jordan Elsea',                'M', '9',  date '2012-04-18', 'delta'),
    ('Brayton Ferry',               'M', '9',  date '2012-07-07', 'delta'),
    ('Avery Fosdick',               'F', '9',  date '2012-06-15', 'delta'),
    ('Surisley Gutierrez Pineiro',  'F', '9',  date '2011-09-18', 'delta'),
    ('Kyler Harvey',                'M', '9',  date '2012-08-06', 'delta'),
    ('George Heiberger',            'M', '9',  date '2011-12-14', 'delta'),
    ('Riley Lyles',                 'M', '9',  date '2012-05-26', 'delta'),
    ('Isaac Raines',                'M', '9',  date '2011-12-08', 'delta'),
    ('Ella Reed',                   'F', '9',  date '2010-12-16', 'delta'),
    ('Mikayla Roos',                'F', '9',  date '2011-12-05', 'delta'),
    ('Cinthia Sanchez Garfias',     'F', '9',  date '2011-12-04', 'delta'),
    ('Scarlett Ward',               'F', '9',  date '2012-03-27', 'delta')
)
update public.cadet_consent c
set birthdate = r.birthdate,
    gender     = r.gender,
    grade      = r.grade,
    let_level  = '1',
    company    = r.company,
    updated_at = now()
from roster r
where c.name = r.name;

-- Diagnostic: roster names with no matching row in cadet_consent — these
-- cadets are NOT in dispatch (not in program per this check). Add manually
-- once you know which company (alpha/bravo/charlie/delta) each belongs to:
--   insert into public.cadet_consent (name, company, grade, let_level, birthdate, gender)
--     values ('First Last', 'alpha', '9', '1', date '2012-05-30', 'F');
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
