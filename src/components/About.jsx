import { useEffect, useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import VerifiedTooltip from './VerifiedTooltip';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
};

const CORE_VALUES = [
  { code: 'LDR-01', title: 'LEADERSHIP', icon: '◈', desc: 'Cadets earn positions of responsibility through demonstrated character and performance, not seniority alone. Every cadet is expected to lead from wherever they stand.' },
  { code: 'LDR-02', title: 'DISCIPLINE', icon: '⊞', desc: 'From uniform standards to academic excellence, discipline is the foundation of everything we do. It builds habits that carry far beyond JROTC.' },
  { code: 'LDR-03', title: 'SERVICE', icon: '⊕', desc: 'The Trojan Battalion is deeply embedded in the Soddy Daisy community. Color guards, honor guards, community service: cadets give back.' },
  { code: 'LDR-04', title: 'EXCELLENCE', icon: '◉', desc: 'Whether competing in Raiders, Rifle, or Academic Bowl, we aim for the top. The battalion consistently ranks in the top 5% nationally.' },
];

const TEAMS = [
  { label: 'RAIDERS', detail: 'Physical fitness, rope bridges, obstacle events, land navigation.' },
  { label: 'RIFLE', detail: 'Precision air rifle under CMP and USA Shooting rules.' },
  { label: 'ACADEMIC', detail: 'JLAB Bowl competition representing the battalion at regionals.' },
  { label: 'DRILL', detail: 'Armed and unarmed exhibition and regulation routines.' },
  { label: 'COLOR GUARD', detail: 'Representing the battalion at school and community events.' },
  { label: 'HONOR GUARD', detail: 'Formal ceremonies, funerals, and official government events.' },
];

function StatBox({ value, label }) {
  return (
    <div style={{ border: `1px solid ${P.hair}`, padding: '20px 24px', background: P.deep, textAlign: 'center' }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 42, color: P.gold, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, letterSpacing: '0.2em', marginTop: 6 }}>{label}</div>
    </div>
  );
}

// ─── Leadership card — adult instructors (SAI, AI, 1SGT), click through to CommandProfile ──
function LeadershipCard({ person, onViewProfile }) {
  const [hovered, setHovered] = useState(false);
  const bioText = person.bio_long || person.bio;
  const view = () => onViewProfile(person);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View profile: ${person.name}, ${person.role_long || person.role_short}`}
      onClick={view}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); view(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        cursor: 'pointer', display: 'flex', gap: 16,
        border: `1px solid ${hovered ? P.gold : P.hair}`,
        background: P.navy, padding: 16,
        transition: 'border-color 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      <div style={{ width: 76, height: 96, flexShrink: 0, position: 'relative', overflow: 'hidden', background: P.deep }}>
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 7px, ${P.navy} 7px, ${P.navy} 8px)`,
          }}>
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.28 }}>
              <circle cx="24" cy="24" r="8" stroke={P.gold} strokeWidth="1.2" />
              <line x1="24" y1="3" x2="24" y2="13" stroke={P.gold} strokeWidth="1.2" />
              <line x1="24" y1="35" x2="24" y2="45" stroke={P.gold} strokeWidth="1.2" />
              <line x1="3" y1="24" x2="13" y2="24" stroke={P.gold} strokeWidth="1.2" />
              <line x1="35" y1="24" x2="45" y2="24" stroke={P.gold} strokeWidth="1.2" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.18em', marginBottom: 4 }}>
          {person.role_short}
        </div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 16, color: P.cream, letterSpacing: '0.04em', lineHeight: 1.15 }}>
          {person.name.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, marginTop: 4, letterSpacing: '0.1em' }}>
          {person.role_long}
        </div>
        {bioText ? (
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 11, color: P.mute, lineHeight: 1.5, margin: '8px 0 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{bioText}</p>
        ) : (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: `${P.gold}77`, letterSpacing: '0.14em', marginTop: 8 }}>
            // AWAITING BIOGRAPHY
          </div>
        )}
      </div>
    </div>
  );
}

export default function About({ setActive }) {
  const [content, setContent] = useState({});
  const [leadership, setLeadership] = useState([]);

  useEffect(() => {
    SB.from('page_content').select('*').then(({ data }) => {
      const map = {};
      (data || []).forEach(r => { map[r.key] = r.value; });
      setContent(map);
    });
    SB.from('personnel').select('*').eq('section', 'leadership').eq('visible', true).order('sort_order')
      .then(({ data }) => setLeadership(data || []));
  }, []);

  function goProfile(person) { setActive(`profile-${person.id}`); }

  return (
    <section style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Hero */}
      <div style={{
        borderBottom: `1px solid ${P.hair}`,
        background: `linear-gradient(160deg, ${P.navy} 0%, ${P.ink} 60%)`,
        padding: '80px 40px 60px', position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
          backgroundSize: '48px 48px', opacity: 0.4,
        }} />
        <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <button onClick={() => setActive('home')} style={{
            background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            letterSpacing: '0.28em', padding: 0, marginBottom: 24, display: 'block',
          }}>← BACK</button>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.32em', marginBottom: 14 }}>
            // ABOUT THE PROGRAM
          </div>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 80, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.88 }}>
            TROJAN<br />BATTALION
          </h1>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            {['SODDY DAISY HS', 'AJROTC', 'U.S. ARMY', 'TN-051', 'EST. 1990s'].map(tag => (
              <div key={tag} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold,
                border: `1px solid ${P.hair}`, padding: '4px 10px', letterSpacing: '0.18em',
              }}>{tag}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px 80px' }}>

        {/* Leadership */}
        {leadership.length > 0 && (
          <div style={{ padding: '48px 0', borderBottom: `1px solid ${P.hair}` }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 24 }}>PROGRAM LEADERSHIP</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {leadership.map(p => <LeadershipCard key={p.id} person={p} onViewProfile={goProfile} />)}
            </div>
          </div>
        )}

        {/* Mission + Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '56px 0 48px', borderBottom: `1px solid ${P.hair}` }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 12 }}>MISSION STATEMENT</div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, color: P.cream, lineHeight: 1.75, margin: 0, maxWidth: 520 }}>
              {content['battalion.mission'] || 'Develop citizens of character dedicated to serving their nation and community.'}
            </p>
            <div style={{ marginTop: 32, padding: '20px 24px', background: P.navy, border: `1px solid ${P.hair}`, borderLeft: `3px solid ${P.gold}` }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 8 }}>THE CREED</div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
                {content['battalion.creed'] || '"I will seek the mantle of leadership and stand prepared to uphold the Constitution and the American way of life."'}
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
            <VerifiedTooltip style={{ display: 'flex' }}>
              <div style={{ width: '100%' }}>
                <StatBox value={content['battalion.national_rank'] || 'TOP 5%'} label="NATIONAL RANKING" />
              </div>
            </VerifiedTooltip>
            <StatBox value={content['battalion.programs_count'] || '7'} label="SPECIALTY TEAMS" />
            <StatBox value={content['battalion.cadets_count'] || '27'} label="ACTIVE CADETS" />
            <StatBox value={content['battalion.year'] || '2025–26'} label="SCHOOL YEAR" />
          </div>
        </div>

        {/* What is JROTC */}
        <div style={{ padding: '48px 0', borderBottom: `1px solid ${P.hair}` }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 16 }}>FOR PARENTS & COMMUNITY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            <div>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 28, color: P.cream, letterSpacing: '0.08em', margin: '0 0 16px' }}>WHAT IS JROTC?</h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: '0 0 14px' }}>
                Junior Reserve Officers' Training Corps (JROTC) is a U.S. Army–sponsored character and leadership development program offered in high schools across the country. It is <strong style={{ color: P.cream }}>not a military recruitment program</strong>. It is an elective course focused on building citizenship, discipline, and leadership.
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: 0 }}>
                The Army's mission for JROTC is to motivate young people to be better citizens. Cadets develop skills in physical fitness, public speaking, community service, and teamwork: tools they carry with them for life regardless of whether they pursue military service.
              </p>
            </div>
            <div>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 28, color: P.cream, letterSpacing: '0.08em', margin: '0 0 16px' }}>DOES IT MEAN MILITARY SERVICE?</h2>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: '0 0 14px' }}>
                <strong style={{ color: P.cream }}>No obligation whatsoever.</strong> Participation in JROTC does not require, obligate, or imply any commitment to military service. Cadets are free to pursue any career path after graduation.
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: 0 }}>
                That said, many cadets do go on to pursue military service, ROTC scholarships, or service academy appointments, and JROTC experience is viewed favorably in those processes. The Trojan Battalion has a strong track record of cadets earning ROTC scholarships and nominations.
              </p>
            </div>
          </div>
        </div>

        {/* Core Values */}
        <div style={{ padding: '48px 0', borderBottom: `1px solid ${P.hair}` }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 24 }}>CORE VALUES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {CORE_VALUES.map(v => (
              <div key={v.code} style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '24px 20px' }}>
                <div style={{ fontSize: 22, color: P.gold, marginBottom: 10 }}>{v.icon}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.gold, letterSpacing: '0.2em', marginBottom: 6 }}>{v.code}</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: P.cream, letterSpacing: '0.1em', marginBottom: 10 }}>{v.title}</div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: P.mute, lineHeight: 1.65, margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Specialty Teams */}
        <div style={{ padding: '48px 0', borderBottom: `1px solid ${P.hair}` }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 24 }}>SPECIALTY TEAMS & ACTIVITIES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {TEAMS.map(t => (
              <div key={t.label} style={{ border: `1px solid ${P.hair}`, padding: '16px 18px', background: P.deep, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 2, height: 36, background: P.gold, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, color: P.cream, letterSpacing: '0.12em', marginBottom: 5 }}>{t.label}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: P.mute, lineHeight: 1.6 }}>{t.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact / Enrollment */}
        <div style={{ padding: '48px 0' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 24 }}>ENROLLMENT & CONTACT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '28px 32px' }}>
              <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: P.cream, letterSpacing: '0.1em', margin: '0 0 16px' }}>HOW TO ENROLL</h3>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.7, margin: '0 0 12px' }}>
                JROTC is an elective course open to all students at Soddy Daisy High School. No prior military experience or physical fitness requirements are needed to join.
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.7, margin: 0 }}>
                Enroll through the school's course selection process or speak directly with the Senior Army Instructor. New cadets are welcome at any point in the year.
              </p>
            </div>
            <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '28px 32px' }}>
              <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: P.cream, letterSpacing: '0.1em', margin: '0 0 16px' }}>CONTACT THE PROGRAM</h3>
              {[
                ['SCHOOL', 'Soddy Daisy High School'],
                ['ADDRESS', `${content['footer.address1'] || '618 Sequoyah Access Rd'}, ${content['footer.address2'] || 'Soddy Daisy, TN 37379'}`],
                ['EMAIL', content['footer.email'] || 'thrasher_michael@hcde.org'],
                ['UNIT', content['battalion.unit'] || 'TN-051'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.15em', width: 72, flexShrink: 0, paddingTop: 1 }}>{label}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.cream }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
