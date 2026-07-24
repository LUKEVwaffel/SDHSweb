-- Cadet bio_long import — 24 matched cadets, 26 row-writes (Weston Noblit + Zoe McCollum dual rows)
-- Requires the CommandProfile.jsx bio_long-fallback code change to be visible on the public profile page.
BEGIN;

-- Brayden Gray -> alpha-1sg
UPDATE personnel SET bio_long = $bio$Brayden Gray is a junior in the battalion serving as First Sergeant. He's part of a battalion family in more ways than one, with his brother serving as S-6 and his cousin Kylie Gray serving as S-3.

One of his standout accomplishments came early. As a freshman, Brayden attended JCLC (Junior Cadet Leadership Course), an opportunity that usually goes to more experienced cadets, and it's a good marker of how quickly he's stepped up in the program. When asked to describe himself, Brayden kept it simple: born to lead.$bio$ WHERE id = 'alpha-1sg';

-- Presley Morgan -> s4-presley
UPDATE personnel SET bio_long = $bio$Presley Morgan's proudest accomplishment in JROTC so far has been earning a spot on staff during her sophomore year, a role that came earlier than most and speaks to the effort she's put into the program.

What she values most about JROTC is the sense of family within the battalion. She likes that she gets to go through high school doing something she's passionate about alongside people who share that same passion, and that the experiences they go through together help strengthen those relationships.

After high school, Presley plans to major in elementary education, with the goal of bringing the same sense of community she's found in JROTC into a classroom of her own.$bio$ WHERE id = 's4-presley';

-- Aidan O'Brien -> bc
UPDATE personnel SET bio_long = $bio$Aidan O'Brien is the SDHS Trojan Battalion Commander, the highest leadership position in the program. He's been named a Superior Cadet, placed 4th in the Hamilton County Best Cadet Competition, and won the Solo Exhibition County Championship.

He stays involved across nearly every team in the battalion, including Drill, Raiders, Rifle, Academics, Color Guard, and JLAB. Balancing that many teams alongside his role as Commander takes a lot of time management, and it's part of what's made him effective as a leader.

Outside of JROTC, Aidan practices Taekwondo, which has helped him build the focus and discipline he brings into his leadership role. What he values most about JROTC is the sense of family it creates among cadets. After high school, he plans to join the United States Marine Corps and complete a full 20 year military career.$bio$ WHERE id = 'bc';

-- Isabella Myers -> delta-1sg
UPDATE personnel SET bio_long = $bio$Isabella Myers currently serves as First Sergeant, after previously serving as a platoon leader in Bravo Company. Outside of JROTC, she's involved in her school's marching band as a member of color guard.

One of her proudest moments in the program was successfully briefing for JPA, which earned her the opportunity to attend JCLC. Between that and her leadership roles, she's built up a solid track record of responsibility and mentoring the cadets under her.

What she values most about JROTC is the sense of family within the battalion, along with the leadership experience the program has given her along the way. After high school, Isabella plans to major in law and minor in business, with the goal of becoming a lawyer and using what she's learned here to make a positive impact in her career.$bio$ WHERE id = 'delta-1sg';

-- Brock Beeler -> s3-brock
UPDATE personnel SET bio_long = $bio$Cadet Captain Brock Beeler serves as Deputy S-3 for the battalion. He's also active on both the Drill team and the Academic team, splitting his time between the two.

After high school, Brock is aiming for a full ride ROTC scholarship, with plans to major in Information Technology at MTSU.$bio$ WHERE id = 's3-brock';

-- Monica Suttles -> s2-monica
UPDATE personnel SET bio_long = $bio$Monica Suttles serves as S-2 and Band Color Guard Captain, splitting her leadership between the battalion and the fine arts program. Beyond color guard, she's also involved in indoor percussion and winter guard during the winter season.

She just wrapped up her first year on staff, where she earned the leadership position she'd been working toward and made the rank of Captain along the way. What she values most about JROTC is the relationships she's built with other cadets, and the chance to help push others to grow while doing the same herself. Outside of the battalion, she takes on a leadership role through her church as well.$bio$ WHERE id = 's2-monica';

-- Draevin Kidd -> s4-draevin
UPDATE personnel SET bio_long = $bio$Draevin Kidd competes on the Drill Team and currently serves as Assistant S-4, handling logistics for the battalion. He previously served as a Platoon Sergeant during his sophomore year, and has kept building on that leadership since.

His track record speaks for itself: 1st Place in the IDR Knockout County Championship, a Distinguished Cadet title, and both the American Legion Military Excellence Award and the Korean War Veteran Award.

What Draevin values most about JROTC is the people he's met and the leadership skills he's picked up along the way. After high school, he plans to attend Tennessee Tech on an ROTC scholarship, serve in the military, and eventually retire into teaching, carrying the same passion for leadership and service into a classroom.$bio$ WHERE id = 's4-draevin';

-- Lachlan Redlin -> bravo-xo
UPDATE personnel SET bio_long = $bio$Lachlan Redlin currently serves as a Company Executive Officer (XO), helping keep daily operations running smoothly for his company. He previously spent time on Raiders as a LET 1 cadet, where he got his first taste of teamwork and physical challenges early in his JROTC career.

Outside of JROTC, Lachlan runs Track and Cross Country, both of which build the same kind of endurance and discipline he brings to his role as XO. He describes JROTC simply as a fun class, and says being Company XO has helped him grow into a more responsible leader.$bio$ WHERE id = 'bravo-xo';

-- Kaiden Gray -> s6-kaiden
UPDATE personnel SET bio_long = $bio$Kaiden Gray is a Cadet Captain serving as S-6, Media and Public Affairs Officer for the battalion, handling communication and helping represent the program to the outside. He's also held the roles of Cadet First Sergeant and Public Affairs and Media Staff Officer over his time in JROTC.

He's active on Drill as well, and previously led the Squad IDR team as Squad IDR Commander. One of his proudest accomplishments has been receiving the Korean War Veteran Award.

What Kaiden values most about JROTC is the community, and the way the program pushes cadets to grow together.$bio$ WHERE id = 's6-kaiden';

-- Skylah Herne -> s3-skyla
UPDATE personnel SET bio_long = $bio$Skylah Herne serves as Assistant S-3, where she's grown into a dependable part of the battalion staff. Outside of JROTC she's into archery, theatre, and writing. One of her proudest moments in the program was earning her spot on staff after working through a tough freshman year.

What she likes most about JROTC is the people, and the friendships she's built along the way. She describes herself as mostly quiet, but says her creativity comes out through music, theatre, and writing. After high school, Skylah plans to go to college and pursue a career in professional theatre.$bio$ WHERE id = 's3-skyla';

-- Michael McCauley -> s5-michael
UPDATE personnel SET bio_long = $bio$Michael McCauley shoots for the SDHS Archery team, where he's put up a personal best score of 274, and is also part of the JROTC Drill Team. One of his proudest accomplishments was taking 1st place in the county for dual exhibition alongside his dual partner.

Within JROTC, Michael currently serves as Assistant S-5, helping out with planning and communication for the battalion. After high school, he plans to earn a bachelor's degree in Computer Science and join the BlueSky program through ETSU.$bio$ WHERE id = 's5-michael';

-- William Boyd -> charlie-1sg
UPDATE personnel SET bio_long = $bio$William Boyd is a Company First Sergeant, a role he grew into after previously serving as a Platoon Leader. Outside of JROTC he's involved in band, Boy Scouts, and color guard, and previously competed on the Drill Team as well. In scouting, he's spent over two and a half years as a Senior Patrol Leader, which says a lot about how much leadership he's carried outside the battalion too.

One of his proudest JROTC accomplishments is receiving the Korean War Medal, along with getting the chance to call cadences during parades over the past several years. What he enjoys most about JROTC is spending time with friends while learning to become a better leader. After high school, William plans to work at the Volkswagen Group plant, and in his free time he's usually playing the Monster Hunter series.$bio$ WHERE id = 'charlie-1sg';

-- Aaron Johnson -> s5-aaron
UPDATE personnel SET bio_long = $bio$Cadet Major Aaron Johnson is the Battalion S-5 (Future Operations Officer) for the 2026-2027 school year. He is an avid participant of color guards, honor guards, and service opportunities. He is a proud member of the Drill Team and the Academic Team. His goal after high school is to major in Mechanical Engineering and join the U.S. Army Corps of Engineers.$bio$ WHERE id = 's5-aaron';

-- Kylie Gray -> s3-kylie
UPDATE personnel SET bio_long = $bio$Kylie Gray currently serves as S-3, Operations Officer, after previously holding the AS-1 position and serving as Company Commander. Along the way she's earned the National Scholar-Athlete Award and is a two-time recipient of the Cadet Challenge Award.

Within the battalion she's part of the Drill Team, Color Guard Team, and Academic Team, and outside of JROTC she's also involved in Band Color Guard and Winter Guard.

After graduation, Kylie plans to pursue a career with the FBI's Behavioral Analysis Unit, hoping to put the leadership and problem solving skills she's built in JROTC to use in service to her country and community.$bio$ WHERE id = 's3-kylie';

-- Mya Sneidman -> xo
UPDATE personnel SET bio_long = $bio$Mya Sneidman is one of the most involved cadets in the battalion, holding leadership roles as Coed Raider Commander, Academic Team Captain, Blood Drive Coordinator, robotics founder and captain, and founder and co-president of Youth in Government, where she also serves as a YIG floor leader.

Her proudest accomplishment in JROTC was serving as the 2025 to 2026 Coed Raider Team Commander. She says the responsibilities that came with the role pushed her to grow, both as a leader and as a person. Outside of JROTC, she stays just as busy, with rock climbing, volunteer beekeeping, academic team, robotics, a part time job at AMC, and pet sitting on the side.

Mya has been open about how much JROTC has changed her. Before joining, she describes herself as extremely meek, someone who slacked off outside of academics despite performing well in the classroom. She credits the program with rewiring how she communicates with people and how seriously she takes her responsibilities and passions now.

After high school, Mya plans to attend the University of Tennessee, Knoxville or the University of Florida to study entomology.$bio$ WHERE id = 'xo';

-- Suzanne Perry -> bravo-1sg
UPDATE personnel SET bio_long = $bio$Suzanne Perry currently serves as Company First Sergeant, and has also served as Color Guard Commander for Team 2. Outside of those roles she's been on both the drill team and archery team for the past two years, building focus and precision along the way.

One of her proudest accomplishments has been earning the rank of First Sergeant. She says JROTC has taught her responsibility and helped her build strong bonds with a wide range of people. After high school, Suzanne plans to attend college to become a physical therapist, so she can keep helping others grow and recover.$bio$ WHERE id = 'bravo-1sg';

-- Weston Noblit -> csm
UPDATE personnel SET bio_long = $bio$Weston Noblit currently serves as Command Sergeant Major of the battalion, a role he stepped into after previously holding the S-4 position. As CSM, he's responsible for enforcing standards and discipline across the unit, a job that's earned him a reputation as someone cadets can rely on to lead by example.

He also serves as Raider Commander, where he's helped guide the team to multiple 1st place finishes in the one rope bridge event this year, one of the most physically demanding events in Raider competition. Alongside his Raider duties, he competes on the rifle team, rounding out a JROTC resume that spans leadership, physical competition, and marksmanship.

Outside of JROTC, Weston is a senior member of the SDHS rock climbing team, where he's spent years building the kind of discipline and problem solving that carries over well into his role in the battalion. What he says he values most about JROTC is the people, and the connections he's made through the program along the way. After graduation, he plans to become a high school math teacher, bringing the same leadership he's built here into a classroom of his own.$bio$ WHERE id = 'csm';

-- Weston Noblit -> raider-male
UPDATE personnel SET bio_long = $bio$Weston Noblit currently serves as Command Sergeant Major of the battalion, a role he stepped into after previously holding the S-4 position. As CSM, he's responsible for enforcing standards and discipline across the unit, a job that's earned him a reputation as someone cadets can rely on to lead by example.

He also serves as Raider Commander, where he's helped guide the team to multiple 1st place finishes in the one rope bridge event this year, one of the most physically demanding events in Raider competition. Alongside his Raider duties, he competes on the rifle team, rounding out a JROTC resume that spans leadership, physical competition, and marksmanship.

Outside of JROTC, Weston is a senior member of the SDHS rock climbing team, where he's spent years building the kind of discipline and problem solving that carries over well into his role in the battalion. What he says he values most about JROTC is the people, and the connections he's made through the program along the way. After graduation, he plans to become a high school math teacher, bringing the same leadership he's built here into a classroom of his own.$bio$ WHERE id = 'raider-male';

-- Danielle Zonato Cortes -> s5-danielle
UPDATE personnel SET bio_long = $bio$Cadet Captain Danielle Zonato Cortes is the Deputy S-5 for the Soddy Daisy Trojan Battalion. She participates in Drill Team, Academic Team, color guards, honor guards, and volunteer whenever possible. After high school, she wants to major in Psychology and enlist into the U.S. National Guard.$bio$ WHERE id = 's5-danielle';

-- Aubrey Gillott -> s1-aubrey
UPDATE personnel SET bio_long = $bio$Aubrey Gillott serves as S-1 for the battalion and is also part of Band Color Guard. Along the way she's earned the role of Company Commander and received the Dandelion Medal.

What she values most about JROTC is the sense of family and teamwork among the cadets. After high school, Aubrey hopes to travel the world and pursue a career as a game warden, combining her love of adventure with the leadership and service she's built here.$bio$ WHERE id = 's1-aubrey';

-- Ary Shirey -> delta-cdr
UPDATE personnel SET bio_long = $bio$Ary Shirey serves as a Company Commander in JROTC, leading and guiding fellow cadets. Outside of the battalion, she stays busy with soccer, band color guard, and winter guard.

What she values most about JROTC is the family atmosphere and the friendships and support system it's given her throughout high school. After graduation, Ary plans to join the military and study veterinary medicine, with hopes of eventually becoming a K-9 police officer, combining her love of animals with a career in service.$bio$ WHERE id = 'delta-cdr';

-- Chase Otto -> bravo-cdr
UPDATE personnel SET bio_long = $bio$Chase Otto is a junior holding the rank of 1st Lieutenant and serving as a Company Commander. He actively participates in most service learning projects and is involved in both Drill and Raiders.

His goals after high school are to attend West Point and earn a master's in Aerospace Engineering. In his own words, he's a chill guy.$bio$ WHERE id = 'bravo-cdr';

-- Zoe McCollum -> charlie-cdr
UPDATE personnel SET bio_long = $bio$Zoe McCollum serves as both Company Commander and Raider Commander, and stays involved in Drill, Raiders, and Color Guard on top of those roles. Outside of JROTC, she's part of her church worship team, dances, and rides horses.

Her JROTC accomplishments stack up quickly: Most Improved Female Raider, a trip to JCLC, time as JV Raider Commander, and now leading as Female/CoEd Raider Commander. She also serves as a Choir Leader and Cheer Captain outside the battalion.

After high school, Zoe plans to attend Bryan College to study Secondary Education and World History, with the goal of becoming a high school history teacher.$bio$ WHERE id = 'charlie-cdr';

-- Zoe McCollum -> raider-female
UPDATE personnel SET bio_long = $bio$Zoe McCollum serves as both Company Commander and Raider Commander, and stays involved in Drill, Raiders, and Color Guard on top of those roles. Outside of JROTC, she's part of her church worship team, dances, and rides horses.

Her JROTC accomplishments stack up quickly: Most Improved Female Raider, a trip to JCLC, time as JV Raider Commander, and now leading as Female/CoEd Raider Commander. She also serves as a Choir Leader and Cheer Captain outside the battalion.

After high school, Zoe plans to attend Bryan College to study Secondary Education and World History, with the goal of becoming a high school history teacher.$bio$ WHERE id = 'raider-female';

-- Aidan Clifton -> alpha-cdr
UPDATE personnel SET bio_long = $bio$Aidan Clifton is a Cadet Captain serving as a Company Commander in the Soddy-Daisy High School Trojan Battalion. Throughout his time in JROTC, he has participated in numerous activities and events including drill competitions, ceremonial color guards, JCLC, rifle competitions where he earned the Sharpshooter Badge, academic team competitions, honor guards, and sabre guards. These experiences have strengthened his leadership, discipline, teamwork, and commitment to representing the battalion with professionalism and pride. As a Company Commander, he strives to lead by example, support the development of his fellow cadets, and contribute to the continued success and excellence of the Trojan Battalion.$bio$ WHERE id = 'alpha-cdr';

-- Jennie Howard -> delta-xo
UPDATE personnel SET bio_long = $bio$Jennie Howard serves as a Company Executive Officer (XO), a role she grew into after previously serving as both a Platoon Sergeant and Squad Leader. Outside of JROTC, she's also part of Marching Band.

One of her proudest accomplishments has been contributing to JPA. She says she values the friendships and connections she's made through JROTC, and appreciates the range of opportunities the program has given her. After high school, Jennie plans to attend college and keep working toward her future goals.$bio$ WHERE id = 'delta-xo';

-- New adult leadership rows (section='leadership', invisible to Staff/Companies/Raiders section filters)
INSERT INTO personnel (id, name, role_short, role_long, section, bio, bio_long, photo_url, visible, sort_order)
VALUES
  ('leadership-sai', 'Michael Thrasher', 'SAI', 'Senior Army Instructor (Chief)', 'leadership', NULL, $bio$CW3 Michael (Brad) Thrasher is a 2002 graduate of Soddy-Daisy High School. After high school he enlisted the United States Army in 2004 and was award the military occupation specialty (MOS) of Avionics and Aircraft Survivability Equipment Repairer. He later commissioned to be an Army Warrant Officer in 2018 and retired after 20 years of service in 2025. During CW3 Thrasher's 20 year career, he deployed to Iraqi and Afghanistan in support of Operation Iraqi Freedom and Operation Enduring Freedom. He was stationed at several locations throughout the world to include but not limited to Fort Bragg, NC, Joint Base Lewis-McCord, WA, Caserma Del Din, Italy, Camp Casey, South Korea and Camp Arifjan, Kuwait. CW3 Thrasher served in every company level leadership role from team leader to first sergeant as well as platoon leader. His awards include 3 Meritorious Service Medals (MSM), 1 Joint Commendation Medal, 6 Army Commendation Medals (ARCOM), 6 Army Achievement Medals (AAM), Parachutist Badge, and Netherland Foreign Jump Wings.$bio$, NULL, true, 1),
  ('leadership-kaz', 'Jay Kazminski', 'AI', 'Army Instructor (Sgt Kaz)', 'leadership', NULL, $bio$SFC Kazminski grew up in Wheaton, Illinois, and enlisted in the United States Army at the age of 21 as an Infantry Mortarman (11C). During a distinguished military career spanning more than 20 years, he served in numerous leadership roles including platoon sergeant, recruiter, instructor, and section leader. His service included multiple combat deployments and earned him several awards and decorations, including the Bronze Star Medal and the Master Combat Infantryman Badge. He honorably retired from the Army in June 2021 as a Sergeant First Class.

Following retirement, SFC Kazminski continued his commitment to leadership and mentorship by becoming an Army Instructor for the JROTC program at Soddy Daisy High School. He earned a Bachelor of Science degree in Emergency Management and Homeland Security from Post University, graduating Cum Laude, and also completed advanced studies in Firearms Technology and Gunsmithing through Sonoran Desert Institute. He has been happily married for 27 years and is the proud father of three children, two sons and one daughter.$bio$, NULL, true, 2),
  ('leadership-1sgt', 'Tim Hodges', '1SGT', '1SGT', 'leadership', NULL, NULL, NULL, true, 3);

COMMIT;