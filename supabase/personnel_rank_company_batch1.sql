-- Batch: company-level rank fill (CDR/XO/1SG -> real rank titles, all 4 companies)
-- CDR (Company Commander)   -> Captain
-- XO  (Executive Officer)   -> First Lieutenant
-- 1SG (First Sergeant)      -> First Sergeant
-- Scope: role_short in ('CDR','XO','1SG') only — excludes leadership (AI/SAI/1SGT)
-- and Raider/Rifle team CMDs, which are a different role, not company command.
BEGIN;

UPDATE personnel SET rank = 'Captain' WHERE id IN ('alpha-cdr', 'bravo-cdr', 'charlie-cdr', 'delta-cdr');
UPDATE personnel SET rank = 'First Lieutenant' WHERE id IN ('alpha-xo', 'bravo-xo', 'charlie-xo', 'delta-xo');
UPDATE personnel SET rank = 'First Sergeant' WHERE id IN ('alpha-1sg', 'bravo-1sg', 'charlie-1sg', 'delta-1sg');

COMMIT;
