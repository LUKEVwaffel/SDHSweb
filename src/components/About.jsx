import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import { TEAMS as TEAM_DEFS } from '../lib/teams';
import VerifiedTooltip from './VerifiedTooltip';
import FaqSection from './FaqSection';

// FAQ categories: teams entries must match ids in lib/teams.js (raiders/rifle/academic/drill).
// Numbering (Q01..Q14) is continuous across categories, computed in FaqSection.
const FAQ_CATEGORIES = [
  {
    category: 'The Basics',
    items: [
      { q: 'What is JROTC, actually?', a: "JROTC isn't a recruiting pipeline for the military. It's a leadership and citizenship class that happens to use a military structure to teach it. You'll learn public speaking, teamwork, how to lead people, how to follow through on responsibility, and how to carry yourself with confidence. Some cadets do go on to join the military. Most don't. Both are completely fine." },
      { q: 'Is this only for people who want a military career?', a: "Not even close. We have cadets who want to be teachers, engineers, nurses, artists, mechanics, you name it. What everyone gets out of it is leadership experience and confidence, not a career track. If you're only interested because it looks good on a college application, that's a completely valid reason to join too." },
    ],
  },
  {
    category: 'Time & Commitment',
    items: [
      { q: "What's the real time commitment like?", a: "It's a class period, same as any other elective. That's the baseline. Specialty teams (Raiders, Rifle, Drill, Academic) are optional and ask for more time outside of school, but nobody is required to join one. You can do JROTC and nothing extra, and still get everything the core class offers." },
      { q: 'Can I still do other clubs, sports, or a job at the same time?', a: "Yes. Lots of our cadets play sports, work part-time jobs, or are in other clubs. JROTC is built to work alongside the rest of your life, not take it over." },
      { q: "What happens if I join and decide it's not for me? Can I leave?", a: "Yes, you can drop it like any other elective. We'd rather you tell a staff member what's not working for you first, since a lot of the time it's a scheduling or team-fit issue that's fixable, not a reason to leave the whole program. But if you decide it's genuinely not for you, that's your call, no hard feelings." },
      { q: "Who do I talk to if I'm struggling or thinking about quitting?", a: "Any staff member, or the SAI (Chief) or 1SGT directly. That's what they're there for. You won't be pressured to stay if it's genuinely not working for you, but talk to someone before deciding, since a lot of problems are fixable once someone actually knows about them." },
    ],
  },
  {
    category: 'Life as a Cadet',
    items: [
      { q: "What if I'm not naturally athletic or fit?", a: "Most of what happens in JROTC isn't physical at all: classroom leadership lessons, drill (which is about precision, not endurance), and academic competition. The Raiders team is the physically demanding one, and it's entirely optional. Nobody is going to make you feel bad for not being an athlete.", teams: ['raiders'] },
      { q: 'How often do I actually wear the uniform?', a: "Typically once a week, plus special events. It's not a daily requirement." },
      { q: 'What does a normal day/week actually look like as a cadet?', a: "Most days look like a regular class: leadership lessons, group activities, some classroom time. Once a week you're in uniform. If you're on a specialty team, you'll have practice time outside of that, on a schedule the team sets together." },
      { q: 'Is it only drill and marching, or is there more to it?', a: 'Drill is one piece, not the whole thing. There\'s also Academic Team (think competitive trivia/knowledge events), Rifle (marksmanship, not combat training), Raiders (fitness/team challenge competitions), and staff leadership roles running the actual day-to-day operations of the battalion. There\'s a place here for a lot of different interests.', teams: ['drill', 'academic', 'rifle', 'raiders'] },
    ],
  },
  {
    category: 'After JROTC',
    items: [
      { q: 'Do I have to join the military after this?', a: "No. Zero obligation. JROTC is a high school elective, not a recruitment contract. Nobody signs anything committing them to service. Plenty of our cadets go straight into college, trade school, or the workforce with no military involvement at all." },
      { q: 'Will this help or hurt my GPA and college applications?', a: 'It helps. JROTC counts as a real elective credit, and having a genuine leadership role (not just a club membership) is something colleges specifically look for. Cadets in leadership positions get real, concrete things to talk about in applications and interviews, not just "I was in a club."' },
      { q: 'What opportunities does this open up later?', a: "Scholarship opportunities (including ROTC college scholarships, if that ever interests you), real leadership experience for job and college applications, and a genuine reference network of instructors who've watched you grow over years, not just one semester." },
      { q: 'Does JROTC actually count for real school credit?', a: "Yes, three years of JROTC earns a Finance credit, a History credit, and a PE credit, all through the JROTC curriculum. Without it, that's three separate classes to get the same three credits." },
    ],
  },
];

const P = {
  ink: '#06101F', navy: '#142847', navy2: '#182D4E', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', bronze: '#8A5A2E', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', mute2: 'rgba(244,236,216,0.72)',
  hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.4)',
};

const oswald = "'Oswald', sans-serif";
const inter = "'Inter', sans-serif";
const mono = "'JetBrains Mono', monospace";

const CORE_VALUES = [
  { code: 'LDR-01', title: 'LEADERSHIP', icon: '◈', desc: 'Cadets earn positions of responsibility through demonstrated character and performance, not seniority alone. Every cadet is expected to lead from wherever they stand.', featured: true },
  { code: 'LDR-02', title: 'DISCIPLINE', icon: '⊞', desc: 'From uniform standards to academic excellence, discipline is the foundation of everything we do. It builds habits that carry far beyond JROTC.' },
  { code: 'LDR-03', title: 'SERVICE', icon: '⊕', desc: 'The Trojan Battalion is deeply embedded in the Soddy Daisy community. Color guards, honor guards, community service: cadets give back.' },
  { code: 'LDR-04', title: 'EXCELLENCE', icon: '◉', desc: 'Whether competing in Raiders, Rifle, or Academic Bowl, we aim for the top. The battalion consistently ranks in the top 5% nationally.' },
];

// id matches lib/teams.js where the team exists there (drives accent color lookup below).
const TEAMS = [
  { id: 'raiders', label: 'RAIDERS', detail: 'Physical fitness, rope bridges, obstacle events, land navigation.' },
  { id: 'rifle', label: 'RIFLE', detail: 'Precision air rifle under CMP and USA Shooting rules.' },
  { id: 'academic', label: 'ACADEMIC', detail: 'JLAB Bowl competition representing the battalion at regionals.' },
  { id: 'drill', label: 'DRILL', detail: 'Armed and unarmed exhibition and regulation routines.' },
  { id: 'colorguard', label: 'COLOR GUARD', detail: 'Representing the battalion at school and community events.', accent: P.bright },
  { id: 'honorguard', label: 'HONOR GUARD', detail: 'Formal ceremonies, funerals, and official government events.', accent: P.bronze },
];
const teamAccent = (t) => t.accent || TEAM_DEFS.find((d) => d.id === t.id)?.accent || P.gold;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Scroll-triggered fade-up used across every section for staggered reveal.
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(14px)',
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }} ref={ref}>
      {children}
    </div>
  );
}

// Corner-bracket frame — the recurring "briefing panel" motif for callout cards.
function Bracket({ children, style = {} }) {
  const corner = (pos) => ({ position: 'absolute', width: 12, height: 12, pointerEvents: 'none', ...pos });
  return (
    <div style={{ position: 'relative', ...style }}>
      <span style={corner({ top: -1, left: -1, borderTop: `1px solid ${P.hairStrong}`, borderLeft: `1px solid ${P.hairStrong}` })} />
      <span style={corner({ top: -1, right: -1, borderTop: `1px solid ${P.hairStrong}`, borderRight: `1px solid ${P.hairStrong}` })} />
      <span style={corner({ bottom: -1, left: -1, borderBottom: `1px solid ${P.hairStrong}`, borderLeft: `1px solid ${P.hairStrong}` })} />
      <span style={corner({ bottom: -1, right: -1, borderBottom: `1px solid ${P.hairStrong}`, borderRight: `1px solid ${P.hairStrong}` })} />
      {children}
    </div>
  );
}

// Numbered section header — shared by every section from "What is JROTC?" onward.
function PanelHead({ index, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
      <span style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.1em', border: `1px solid ${P.hair}`, padding: '3px 8px', flexShrink: 0 }}>{index}</span>
      <h2 style={{ fontFamily: oswald, fontSize: 22, color: P.cream, letterSpacing: '0.03em', fontWeight: 600, margin: 0 }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: P.hair }} />
    </div>
  );
}

// Lat/long-style readout strip — echoes the same motif Hero.jsx uses, ties About back to the homepage.
function Telemetry({ left, center, right, borderBottom }) {
  return (
    <div style={{
      position: 'relative', borderTop: `1px solid ${P.hair}`, borderBottom: borderBottom ? `1px solid ${P.hair}` : undefined,
      background: 'rgba(0,0,0,0.3)', padding: '12px 40px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
      fontFamily: mono, fontSize: 9, letterSpacing: '0.22em', color: P.gold, opacity: 0.85,
    }}>
      <span>{left}</span>
      {center && <span>{center}</span>}
      <span className="hp-blink">{right}</span>
    </div>
  );
}

function Eyebrow({ children, style = {}, color = P.gold }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 9, color, letterSpacing: '0.28em', fontWeight: 500, ...style }}>
      {children}
    </div>
  );
}

// Circular ring stat — reuses the site's existing `ring-traced` keyframe (index.css), previously unused.
function RingStat({ value, label }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 128 128" style={{ position: 'absolute', inset: 0 }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke={P.hair} strokeWidth="2" />
        <circle className="ring-traced" cx="64" cy="64" r={r} fill="none" stroke={P.gold} strokeWidth="2" strokeDasharray={c} strokeLinecap="round" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 19, color: P.bright }}>{value}</div>
        <div style={{ fontFamily: mono, fontSize: 7, color: P.mute, letterSpacing: '0.12em', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// Secondary stat box with an animated fill bar along the bottom edge.
function StatBar({ value, label }) {
  const long = String(value).length > 5;
  return (
    <div style={{ border: `1px solid ${P.hair}`, padding: '16px 14px', background: P.deep, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontFamily: oswald, fontSize: 28 * (long ? 0.72 : 1), color: P.gold, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.14em', marginTop: 6 }}>{label}</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: '100%', background: P.gold, transformOrigin: 'left', animation: 'hp-bar 1.1s ease-out forwards' }} />
    </div>
  );
}

// ─── Credit callout — "3 years = 3 credits" gets its own full-bleed band ──
function CreditCallout() {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(115deg, ${P.navy} 0%, #1c3358 45%, ${P.bronze} 145%)`,
      borderTop: `1px solid ${P.hairStrong}`, borderBottom: `1px solid ${P.hairStrong}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(201,169,97,0.03) 3px, rgba(201,169,97,0.03) 4px)`,
      }} />
      <div style={{
        position: 'absolute', right: '-8%', top: '-30%', width: '60%', height: '220%',
        background: 'rgba(232,199,122,0.06)', transform: 'rotate(12deg)', pointerEvents: 'none',
      }} />
      <div className="credit-grid" style={{
        maxWidth: 1400, margin: '0 auto', padding: '56px 40px', position: 'relative', zIndex: 1,
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 48, alignItems: 'center',
      }}>
        <div className="credit-number" style={{ fontFamily: oswald, fontWeight: 700, fontSize: 'clamp(72px, 9vw, 148px)', lineHeight: 0.8, color: P.cream, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          3<span style={{ fontSize: '0.3em', color: P.hairStrong, margin: '0 6px' }}>=</span><span style={{ color: P.bright }}>3</span>
        </div>
        <div>
          <Eyebrow color={P.bright}>THE BEST-KEPT SECRET OF THE PROGRAM</Eyebrow>
          <h3 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 30, color: P.cream, margin: '10px 0 12px', letterSpacing: '0.01em' }}>
            Three years of JROTC earns three real school credits.
          </h3>
          <p style={{ fontFamily: inter, fontSize: 15, lineHeight: 1.7, color: 'rgba(244,236,216,0.85)', maxWidth: 520, margin: '0 0 18px' }}>
            Finance, History, and PE, all through the JROTC curriculum. Without it, that's three separate classes. Nowhere else at this school can one program clear all three.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {['FINANCE CREDIT', 'HISTORY CREDIT', 'PE CREDIT'].map((chip) => (
              <div key={chip} style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', color: P.ink, background: P.bright, padding: '7px 14px', fontWeight: 500 }}>
                {chip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Leadership card — adult instructors (SAI, AI, 1SGT), click through to CommandProfile ──
// Uniform portrait card, same photo aspect/crop as Staff.jsx's StaffCard.
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
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        border: `1px solid ${hovered ? P.gold : P.hair}`,
        background: P.navy,
        transition: 'border-color 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: P.deep }}>
        {person.role_short && (
          <div style={{
            position: 'absolute', top: 8, left: 8, fontFamily: mono, fontSize: 8, color: P.gold,
            letterSpacing: '0.14em', background: 'rgba(6,16,31,0.75)', padding: '3px 8px', border: `1px solid ${P.hairStrong}`,
          }}>{person.role_short}</div>
        )}
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.name} style={{
            width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block',
            transition: 'transform 0.35s', transform: hovered ? 'scale(1.06)' : 'scale(1)',
          }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 7px, ${P.navy} 7px, ${P.navy} 8px)`,
          }}>
            <svg width={32} height={32} viewBox="0 0 48 48" fill="none" style={{ opacity: 0.28 }}>
              <circle cx="24" cy="24" r="8" stroke={P.gold} strokeWidth="1.2" />
              <line x1="24" y1="3" x2="24" y2="13" stroke={P.gold} strokeWidth="1.2" />
              <line x1="24" y1="35" x2="24" y2="45" stroke={P.gold} strokeWidth="1.2" />
              <line x1="3" y1="24" x2="13" y2="24" stroke={P.gold} strokeWidth="1.2" />
              <line x1="35" y1="24" x2="45" y2="24" stroke={P.gold} strokeWidth="1.2" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, padding: '16px', borderTop: `1px solid ${P.hair}` }}>
        <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 15, color: P.cream, letterSpacing: '0.03em', lineHeight: 1.15 }}>
          {person.name.toUpperCase()}
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 3, letterSpacing: '0.1em' }}>
          {person.role_long}
        </div>
        {bioText ? (
          <p style={{
            fontFamily: inter, fontSize: 11, color: P.mute2, lineHeight: 1.6, margin: '6px 0 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{bioText}</p>
        ) : (
          <div style={{ fontFamily: mono, fontSize: 9, color: `${P.gold}77`, letterSpacing: '0.14em', marginTop: 8 }}>
            // AWAITING BIOGRAPHY
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Specialty team tile — left accent bar in the team's own color (from lib/teams.js) ──
function TeamCard({ team }) {
  const [hovered, setHovered] = useState(false);
  const accent = teamAccent(team);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderLeft: `3px solid ${accent}`, padding: '18px 20px',
        background: hovered ? '#0c1a30' : P.deep,
        transition: 'background 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        <span style={{ fontFamily: oswald, fontSize: 14.5, color: P.cream, letterSpacing: '0.1em', fontWeight: 600 }}>{team.label}</span>
      </div>
      <div style={{ fontFamily: inter, fontSize: 12.5, color: P.mute2, lineHeight: 1.6 }}>{team.detail}</div>
    </div>
  );
}

function ValueCard({ value }) {
  const [hovered, setHovered] = useState(false);
  const featured = !!value.featured;
  return (
    <div
      className={featured ? 'value-card value-card-featured' : 'value-card'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: featured ? `linear-gradient(160deg, ${P.navy} 0%, #1a3159 100%)` : P.navy,
        border: `1px solid ${hovered ? P.hairStrong : P.hair}`, padding: featured ? '28px 26px' : '26px 22px',
        transition: 'transform 0.2s, border-color 0.2s', transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        gridRow: featured ? 'span 2' : undefined,
        display: featured ? 'flex' : undefined, flexDirection: featured ? 'column' : undefined, justifyContent: featured ? 'center' : undefined,
      }}
    >
      <div style={{
        width: featured ? 52 : 40, height: featured ? 52 : 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${P.hairStrong}`, borderRadius: '50%', fontSize: featured ? 24 : 18, color: P.gold, marginBottom: 14,
      }}>{value.icon}</div>
      <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.7 }}>{value.code}</div>
      <div style={{ fontFamily: oswald, fontSize: featured ? 22 : 17, color: P.cream, letterSpacing: '0.08em', margin: '8px 0 10px', fontWeight: 600 }}>{value.title}</div>
      <p style={{ fontFamily: inter, fontSize: featured ? 14 : 12.5, color: P.mute2, lineHeight: 1.65, margin: 0, maxWidth: featured ? 320 : undefined }}>{value.desc}</p>
    </div>
  );
}

export default function About() {
  const navigate = useNavigate();
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

  function goProfile(person) { navigate(`/profile/${person.id}`); }

  return (
    <section style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Hero */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${P.hair}`,
        background: `radial-gradient(ellipse 900px 500px at 15% -10%, rgba(201,169,97,0.12), transparent 60%), linear-gradient(160deg, ${P.navy2} 0%, ${P.ink} 65%)`,
      }}>
        {/* decorative grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
          backgroundSize: '56px 56px', opacity: 0.35,
          maskImage: 'linear-gradient(180deg, black, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(180deg, black, transparent 85%)',
        }} />
        {/* scanline texture — matches Hero.jsx */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(201,169,97,0.022) 3px, rgba(201,169,97,0.022) 4px)`,
        }} />
        {/* corner radar echo — same sweep motif as the homepage hero, smaller and quieter here */}
        <div style={{ position: 'absolute', right: -100, top: -60, width: 320, height: 320, opacity: 0.4, pointerEvents: 'none' }}>
          <svg viewBox="0 0 200 200" width="320" height="320" style={{ position: 'absolute', inset: 0 }}>
            {[40, 60, 80, 95].map((r, i) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={P.gold} strokeWidth="0.5" opacity={0.12 + i * 0.04} />
            ))}
          </svg>
          <svg viewBox="0 0 200 200" width="320" height="320" className="hp-cw-12" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="about-sweep" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={P.gold} stopOpacity="0" />
                <stop offset="100%" stopColor={P.gold} stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <path d="M 100 100 L 100 5 A 95 95 0 0 1 195 100 Z" fill="url(#about-sweep)" />
          </svg>
        </div>
        <div className="about-hero-inner" style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1, padding: '72px 40px 44px' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
            fontFamily: mono, fontSize: 10,
            letterSpacing: '0.28em', padding: 0, marginBottom: 28, display: 'block',
          }}>← BACK</button>
          <Eyebrow style={{ marginBottom: 14 }}>// ABOUT THE PROGRAM</Eyebrow>
          <h1 className="about-hero-title" style={{ fontFamily: oswald, fontWeight: 700, fontSize: 'clamp(52px, 8vw, 80px)', color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.88 }}>
            TROJAN<br /><span style={{ color: P.gold }}>BATTALION</span>
          </h1>
          <p style={{ fontFamily: inter, fontSize: 17, color: P.mute2, maxWidth: 560, lineHeight: 1.7, margin: '22px 0 0' }}>
            {content['battalion.tagline'] || 'A leadership and citizenship program at Soddy Daisy High School. No military obligation, no dues, no pressure. Just a place to grow.'}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            {['SODDY DAISY HS', 'AJROTC', 'U.S. ARMY', 'TN-051', 'EST. 1990s'].map(tag => (
              <div key={tag} style={{
                fontFamily: mono, fontSize: 9, color: P.gold,
                border: `1px solid ${P.hairStrong}`, padding: '5px 12px', letterSpacing: '0.16em',
                background: 'rgba(201,169,97,0.05)',
              }}>{tag}</div>
            ))}
          </div>
        </div>
        <Telemetry left="LAT 35.2438° N · LONG 85.1814° W" center="SODDY DAISY · TENNESSEE" right="[ STATUS · OK ]" />
      </div>

      <div className="about-content" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px' }}>

        {/* Mission + Stats */}
        <div className="about-mission-grid" style={{ padding: '56px 0', borderBottom: `1px solid ${P.hair}`, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 40, alignItems: 'stretch' }}>
          <Reveal>
            <Eyebrow>MISSION STATEMENT</Eyebrow>
            <p style={{ fontFamily: inter, fontSize: 18, color: P.cream, lineHeight: 1.8, margin: '14px 0 0', maxWidth: 480 }}>
              {content['battalion.mission'] || 'Develop citizens of character dedicated to serving their nation and community.'}
            </p>
            <div style={{ marginTop: 22, padding: '18px 22px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${P.hair}`, borderLeft: `3px solid ${P.gold}`, position: 'relative' }}>
              <Eyebrow style={{ fontSize: 9 }}>THE CREED</Eyebrow>
              <p style={{ fontFamily: inter, fontSize: 13.5, color: P.mute2, lineHeight: 1.7, margin: '8px 0 0', fontStyle: 'italic' }}>
                {content['battalion.creed'] || '"I will seek the mantle of leadership and stand prepared to uphold the Constitution and the American way of life."'}
              </p>
              <button onClick={() => navigate('/creed')} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                marginTop: 10, fontFamily: mono, fontSize: 9, letterSpacing: '0.2em', color: P.gold,
              }}>PRACTICE IT →</button>
            </div>
          </Reveal>
          <div className="about-mission-divider" style={{ width: 1, background: `linear-gradient(180deg, transparent, ${P.hairStrong} 15%, ${P.hairStrong} 85%, transparent)`, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: 0, fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>N35.24</span>
            <span style={{ position: 'absolute', left: 10, bottom: 0, fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>W85.18</span>
          </div>
          <Reveal delay={0.08}>
            <Eyebrow>BY THE NUMBERS</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 14 }}>
              <VerifiedTooltip style={{ display: 'flex' }}>
                <RingStat value={content['battalion.national_rank'] || 'TOP 5%'} label="NAT'L RANK · VERIFIED" />
              </VerifiedTooltip>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <StatBar value={content['battalion.programs_count'] || '7'} label="SPECIALTY TEAMS" />
                <StatBar value={content['battalion.cadets_count'] || '27'} label="ACTIVE CADETS" />
                <StatBar value={content['battalion.year'] || '2025–26'} label="SCHOOL YEAR" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <CreditCallout />

      <div className="about-content" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px' }}>

        {/* What is JROTC */}
        <div style={{ padding: '56px 0', borderBottom: `1px solid ${P.hair}` }}>
          <PanelHead index="01" title="WHAT IS JROTC?" />
          <div className="about-overview-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Reveal>
              <Bracket style={{ padding: '26px 28px', background: P.deep, border: `1px solid ${P.hair}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.gold }} />
                  <Eyebrow style={{ fontSize: 9 }}>PROGRAM OVERVIEW</Eyebrow>
                </div>
                <h3 style={{ fontFamily: oswald, fontSize: 18, color: P.cream, letterSpacing: '0.02em', fontWeight: 600, margin: '0 0 12px' }}>Not a recruitment pipeline</h3>
                <p style={{ fontFamily: inter, fontSize: 14, color: P.mute2, lineHeight: 1.75, margin: '0 0 12px' }}>
                  Junior Reserve Officers' Training Corps (JROTC) is a U.S. Army–sponsored character and leadership development program offered in high schools across the country. It is <strong style={{ color: P.cream }}>not a military recruitment program</strong>. It is an elective course focused on building citizenship, discipline, and leadership.
                </p>
                <p style={{ fontFamily: inter, fontSize: 14, color: P.mute2, lineHeight: 1.75, margin: 0 }}>
                  The Army's mission for JROTC is to motivate young people to be better citizens. Cadets develop skills in physical fitness, public speaking, community service, and teamwork: tools they carry with them for life regardless of whether they pursue military service.
                </p>
              </Bracket>
            </Reveal>
            <Reveal delay={0.08}>
              <Bracket style={{ padding: '26px 28px', background: P.deep, border: `1px solid ${P.hair}`, height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.gold }} />
                  <Eyebrow style={{ fontSize: 9 }}>OBLIGATION</Eyebrow>
                </div>
                <h3 style={{ fontFamily: oswald, fontSize: 18, color: P.cream, letterSpacing: '0.02em', fontWeight: 600, margin: '0 0 12px' }}>Zero military commitment</h3>
                <p style={{ fontFamily: inter, fontSize: 14, color: P.mute2, lineHeight: 1.75, margin: '0 0 12px' }}>
                  <strong style={{ color: P.cream }}>No obligation whatsoever.</strong> Participation in JROTC does not require, obligate, or imply any commitment to military service. Cadets are free to pursue any career path after graduation.
                </p>
                <p style={{ fontFamily: inter, fontSize: 14, color: P.mute2, lineHeight: 1.75, margin: 0 }}>
                  That said, many cadets do go on to pursue military service, ROTC scholarships, or service academy appointments, and JROTC experience is viewed favorably in those processes. The Trojan Battalion has a strong track record of cadets earning ROTC scholarships and nominations.
                </p>
              </Bracket>
            </Reveal>
          </div>
        </div>

        {/* Leadership */}
        {leadership.length > 0 && (
          <div style={{ padding: '56px 0', borderBottom: `1px solid ${P.hair}` }}>
            <PanelHead index="02" title="PROGRAM LEADERSHIP" />
            <Reveal>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18 }}>
                {leadership.map(p => <LeadershipCard key={p.id} person={p} onViewProfile={goProfile} />)}
              </div>
            </Reveal>
          </div>
        )}

        {/* Core Values — one featured + three, instead of four flat equal columns */}
        <div style={{ padding: '56px 0', borderBottom: `1px solid ${P.hair}` }}>
          <PanelHead index="03" title="CORE VALUES" />
          <Reveal>
            <div className="values-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: 14 }}>
              {CORE_VALUES.map(v => <ValueCard key={v.code} value={v} />)}
            </div>
          </Reveal>
        </div>

        {/* Specialty Teams */}
        <div style={{ padding: '56px 0', borderBottom: `1px solid ${P.hair}` }}>
          <PanelHead index="04" title="SPECIALTY TEAMS & ACTIVITIES" />
          <Reveal>
            <div className="teams-about-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {TEAMS.map(t => <TeamCard key={t.id} team={t} />)}
            </div>
          </Reveal>
        </div>

        <div style={{ padding: '56px 0', borderBottom: `1px solid ${P.hair}` }}>
          <PanelHead index="05" title="FREQUENTLY ASKED QUESTIONS" />
          <FaqSection categories={FAQ_CATEGORIES} />
        </div>

        {/* Contact / Enrollment */}
        <div style={{ padding: '56px 0' }}>
          <PanelHead index="06" title="ENROLLMENT & CONTACT" />
          <Reveal>
            <div className="about-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '24px 26px' }}>
                <h3 style={{ fontFamily: oswald, fontSize: 16, color: P.cream, letterSpacing: '0.06em', margin: '0 0 14px', fontWeight: 600 }}>HOW TO ENROLL</h3>
                <p style={{ fontFamily: inter, fontSize: 13, color: P.mute2, lineHeight: 1.7, margin: '0 0 10px' }}>
                  JROTC is an elective course open to all students at Soddy Daisy High School. No prior military experience or physical fitness requirements are needed to join.
                </p>
                <p style={{ fontFamily: inter, fontSize: 13, color: P.mute2, lineHeight: 1.7, margin: 0 }}>
                  Enroll through the school's course selection process or speak directly with the Senior Army Instructor. New cadets are welcome at any point in the year.
                </p>
              </div>
              <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: '24px 26px' }}>
                <h3 style={{ fontFamily: oswald, fontSize: 16, color: P.cream, letterSpacing: '0.06em', margin: '0 0 14px', fontWeight: 600 }}>CONTACT THE PROGRAM</h3>
                {[
                  ['SCHOOL', 'Soddy Daisy High School'],
                  ['ADDRESS', `${content['footer.address1'] || '618 Sequoyah Access Rd'}, ${content['footer.address2'] || 'Soddy Daisy, TN 37379'}`],
                  ['EMAIL', content['footer.email'] || 'thrasher_michael@hcde.org'],
                  ['UNIT', content['battalion.unit'] || 'TN-051'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.14em', width: 68, flexShrink: 0, paddingTop: 1 }}>{label}</div>
                    <div style={{ fontFamily: inter, fontSize: 12.5, color: P.cream }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <Telemetry left="TROJAN BATTALION // OPS PROFILE" center={`UNIT // ${content['battalion.unit'] || 'TN-051'}`} right="[ STATUS · OK ]" borderBottom />
      <style>{`
        @media (max-width: 767px) {
          .about-hero-inner { padding: 40px 20px 32px !important; }
          .about-hero-title { font-size: 40px !important; }
          .about-content { padding: 0 20px !important; }
          .about-mission-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .about-mission-divider { display: none !important; }
          .credit-grid { grid-template-columns: 1fr !important; padding: 40px 20px !important; gap: 20px !important; }
          .credit-number { font-size: 64px !important; }
          .about-overview-grid { grid-template-columns: 1fr !important; }
          .values-grid { grid-template-columns: 1fr !important; grid-template-rows: none !important; }
          .value-card-featured { grid-row: auto !important; }
          .teams-about-grid { grid-template-columns: 1fr !important; }
          .about-contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
