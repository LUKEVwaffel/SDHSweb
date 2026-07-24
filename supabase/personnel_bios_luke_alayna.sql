-- Luke Vetsch + Alayna Herpy bio_long update — 2 rows, ids confirmed via REST query
BEGIN;

-- Luke Vetsch -> s6-luke
UPDATE personnel SET bio_long = $bio$Luke Vetsch is a junior serving as Assistant S-6, Developer for the Trojan Battalion. He built the battalion's entire public website from the ground up, along with DISPATCH, the battalion's admin portal, rebuilding what started as a single 2,000+ line file into a full organized system covering events, staff and command, cadet photos, email lists, and media.

On the public site, his work includes the Raiders team page, the annual consent form, and the battalion's photo and events system. One of his biggest projects has been the email review system, giving the SAI, Sergeant Kaz, and the First Sergeant their own individual logins to approve or deny drafted emails before they go out, replacing the old print-for-signature process entirely. He also built the bio submission portal used to collect every cadet's biography for the site, the very system that produced this bio.

Outside of JROTC, Luke runs his own freelance web design business, ML Web Design, and works as a lifeguard at Girls Preparatory School. He's approached the site with an eye toward the future, keeping DISPATCH simple enough that it can be handed off cleanly to his successor down the road.$bio$ WHERE id = 's6-luke';

-- Alayna Herpy -> s1-alayna
UPDATE personnel SET bio_long = $bio$Alayna Herpy is a dedicated cadet who has embraced JROTC as a place to grow both personally and as a leader. One of her proudest accomplishments has been earning a spot on staff during her sophomore year, a milestone that reflects her hard work and commitment early in her JROTC career.

What Alayna values most about the program is the energy of the people in it, she loves the opportunity JROTC gives her to connect with cadets she might not otherwise get to know. That openness to building new relationships has become a defining part of her experience in the battalion.

After high school, Alayna plans to attend college and major in education, with the goal of bringing the same leadership and connection she found in JROTC into a classroom of her own.$bio$ WHERE id = 's1-alayna';

COMMIT;
