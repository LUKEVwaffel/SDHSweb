-- Batch 1: rank/let_level/graduating fill for 12 personnel rows (TBD -> real values)
-- Excludes bc (Aiden O'Brien) and s6-luke (Luke Vetsch) — handled separately
BEGIN;

-- Alayna Herpy -> s1-alayna
UPDATE personnel SET rank = $val$Master Sergeant$val$, let_level = $val$3$val$, graduating = $val$2028$val$ WHERE id = 's1-alayna';

-- Aubrey Gillot -> s1-aubrey
UPDATE personnel SET rank = $val$Captain$val$, let_level = $val$4$val$, graduating = $val$2027$val$ WHERE id = 's1-aubrey';

-- Monica Suttles -> s2-monica
UPDATE personnel SET rank = $val$Captain$val$, let_level = $val$3$val$, graduating = $val$2028$val$ WHERE id = 's2-monica';

-- Kylie Gray -> s3-kylie
UPDATE personnel SET rank = $val$Major$val$, let_level = $val$4$val$, graduating = $val$2027$val$ WHERE id = 's3-kylie';

-- Brock Beeler -> s3-brock
UPDATE personnel SET rank = $val$Captain$val$, let_level = $val$4$val$, graduating = $val$2027$val$ WHERE id = 's3-brock';

-- Skyla Hern -> s3-skyla
UPDATE personnel SET rank = $val$Master Sergeant$val$, let_level = $val$3$val$, graduating = $val$2028$val$ WHERE id = 's3-skyla';

-- Presley Morgan -> s4-presley
UPDATE personnel SET rank = $val$Captain$val$, let_level = $val$3$val$, graduating = $val$2028$val$ WHERE id = 's4-presley';

-- Draevin Kidd -> s4-draevin
UPDATE personnel SET rank = $val$Master Sergeant$val$, let_level = $val$3$val$, graduating = $val$2028$val$ WHERE id = 's4-draevin';

-- Aaron Johnson -> s5-aaron
UPDATE personnel SET rank = $val$Major$val$, let_level = $val$4$val$, graduating = $val$2027$val$ WHERE id = 's5-aaron';

-- Danielle Zonato -> s5-danielle
UPDATE personnel SET rank = $val$Captain$val$, let_level = $val$4$val$, graduating = $val$2027$val$ WHERE id = 's5-danielle';

-- Michael McCauley -> s5-michael
UPDATE personnel SET rank = $val$Master Sergeant$val$, let_level = $val$3$val$, graduating = $val$2028$val$ WHERE id = 's5-michael';

-- Kaiden Gray -> s6-kaiden
UPDATE personnel SET rank = $val$Captain$val$, let_level = $val$4$val$, graduating = $val$2027$val$ WHERE id = 's6-kaiden';

COMMIT;
