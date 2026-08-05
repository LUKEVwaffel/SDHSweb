-- Assistant staff titles: "Officer" -> "NCO", matching official DA Form 4856
-- counseling language for assistant positions (S5's assistant was already
-- "Asst. Civil affairs NCO" — only S1/S3/S4/S6 assistants needed the fix).

UPDATE personnel SET role_long = 'Asst. Personnel NCO'       WHERE id = 's1-alayna';
UPDATE personnel SET role_long = 'Asst. Operations NCO'      WHERE id = 's3-skyla';
UPDATE personnel SET role_long = 'Asst. Logistics NCO'       WHERE id = 's4-draevin';
UPDATE personnel SET role_long = 'Asst. Communications NCO'  WHERE id = 's6-luke';
