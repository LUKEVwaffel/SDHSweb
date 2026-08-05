import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import useIsMobile from '../hooks/useIsMobile';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
};

const S_SECTIONS = [
  { key: 'command', label: 'CMD', name: 'BATTALION COMMAND', desc: 'Battalion commander, executive officer, and command sergeant major, the senior leadership echelon.' },
  { key: 's1', label: 'S-1', name: 'PERSONNEL',      desc: 'Principal staff for personnel readiness — maintains strength reports, rosters, and records, oversees bulletin boards and photo displays, and plans awards, promotion, and social events.' },
  { key: 's2', label: 'S-2', name: 'INTELLIGENCE',   desc: 'Oversees battalion physical security and monthly key control inventory, and provides terrain, weather, and threat analysis for training and event planning.' },
  { key: 's3', label: 'S-3', name: 'OPERATIONS',     desc: 'Plans, organizes, and supervises all cadet training happening within 30 days — allocating resources, finalizing instructions and schedules, and rehearsing classes before execution.' },
  { key: 's4', label: 'S-4', name: 'LOGISTICS',      desc: 'Coordinates battalion logistics, supply, and equipment — receiving, distributing, and inventorying gear, and linking cadets with the cadre supply technician.' },
  { key: 's5', label: 'S-5', name: 'CIVIL AFFAIRS',  desc: 'Plans training and operations more than 30 days out — allocating resources, building the long-range training calendar, and handing plans to S-3 a month before each event.' },
  { key: 's6', label: 'S-6', name: 'COMMUNICATIONS', desc: 'Collects media waivers each fall, documents JROTC events through photography, builds the monthly battalion newsletter, and runs the battalion\'s social media and website.' },
];

// Keyboard activation for click-through cards.
function activate(e, fn) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
}

// ─── Scoped focus styles ─────────────────────────────────────────────────────
function CardStyles() {
  return (
    <style>{`
      .cmd-clickable:focus-visible { outline: 2px solid #C9A961; outline-offset: 4px; }
    `}</style>
  );
}

// ─── Full-page grid + math overlay ───────────────────────────────────────────
function PageBackground() {
  const annotations = [
    { x: '2%',  y: '4%',  t: 'TN-051' },
    { x: '88%', y: '3%',  t: 'AY 2025–26' },
    { x: '1%',  y: '22%', t: 'Σ CMD = 3' },
    { x: '90%', y: '18%', t: 'AJROTC' },
    { x: '2%',  y: '42%', t: 'S1–S6' },
    { x: '88%', y: '38%', t: 'LAT 35.24°N' },
    { x: '1%',  y: '62%', t: '// STAFF' },
    { x: '90%', y: '58%', t: 'TN-051' },
    { x: '3%',  y: '80%', t: 'Σ staff = 9' },
    { x: '87%', y: '78%', t: 'TROJAN' },
    { x: '44%', y: '2%',  t: '// BATTALION STAFF · TN-051' },
    { x: '42%', y: '96%', t: 'LAT 35.2438° N · LONG 85.1814° W' },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '52px 52px', opacity: 0.4,
      }} />
      {/* Math */}
      {annotations.map((a, i) => (
        <div key={i} style={{
          position: 'absolute', left: a.x, top: a.y,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
          color: P.gold, opacity: 0.08, letterSpacing: '0.14em', whiteSpace: 'nowrap',
        }}>{a.t}</div>
      ))}
      {/* SVG lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }}>
        <line x1="0" y1="35%" x2="100%" y2="35%" stroke={P.gold} strokeWidth="1" strokeDasharray="3 18" />
        <line x1="0" y1="68%" x2="100%" y2="68%" stroke={P.gold} strokeWidth="0.5" strokeDasharray="2 20" />
        <line x1="12%" y1="0" x2="12%" y2="100%" stroke={P.gold} strokeWidth="0.5" strokeDasharray="2 16" />
        <line x1="88%" y1="0" x2="88%" y2="100%" stroke={P.gold} strokeWidth="0.5" strokeDasharray="2 16" />
      </svg>
    </div>
  );
}

// ─── Corner brackets ──────────────────────────────────────────────────────────
function Brackets({ active, size = 14 }) {
  const color = active ? P.gold : `${P.gold}50`;
  const s = `1px solid ${color}`;
  return (
    <>
      {[
        { top: 0, left: 0, borderTop: s, borderLeft: s },
        { top: 0, right: 0, borderTop: s, borderRight: s },
        { bottom: 0, left: 0, borderBottom: s, borderLeft: s },
        { bottom: 0, right: 0, borderBottom: s, borderRight: s },
      ].map((st, i) => (
        <div key={i} style={{ position: 'absolute', width: size, height: size, ...st, pointerEvents: 'none', transition: 'border-color 0.2s' }} />
      ))}
    </>
  );
}

// ─── Schematic placeholder for a missing portrait ─────────────────────────────
function PhotoPending({ featured }) {
  const r = featured ? 26 : 20;
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 9px, ${P.navy} 9px, ${P.navy} 10px)`,
    }}>
      <svg width={r * 2} height={r * 2} viewBox="0 0 48 48" fill="none" style={{ opacity: 0.25 }}>
        <circle cx="24" cy="24" r="8" stroke={P.gold} strokeWidth="1" />
        <line x1="24" y1="4"  x2="24" y2="12" stroke={P.gold} strokeWidth="1" />
        <line x1="24" y1="36" x2="24" y2="44" stroke={P.gold} strokeWidth="1" />
        <line x1="4"  y1="24" x2="12" y2="24" stroke={P.gold} strokeWidth="1" />
        <line x1="36" y1="24" x2="44" y2="24" stroke={P.gold} strokeWidth="1" />
      </svg>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}66`, letterSpacing: '0.24em' }}>
        AWAITING PORTRAIT
      </span>
    </div>
  );
}

// ─── S-section portrait card ─────────────────────────────────────────────────
function StaffCard({ person, onViewProfile }) {
  const [hovered, setHovered] = useState(false);
  const view = () => onViewProfile(person);

  return (
    <div
      className="cmd-clickable"
      role="button"
      tabIndex={0}
      aria-label={`View profile: ${person.name}, ${person.role_long || person.role_short}`}
      onClick={view}
      onKeyDown={(e) => activate(e, view)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        border: `1px solid ${hovered ? P.gold : P.hair}`,
        background: P.navy,
        transition: 'border-color 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Photo */}
      <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', background: P.deep }}>
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.name} style={{
            width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block',
            transition: 'transform 0.35s', transform: hovered ? 'scale(1.06)' : 'scale(1)',
          }} />
        ) : (
          <PhotoPending />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 50%, rgba(6,16,31,0.88) 100%)',
          pointerEvents: 'none',
        }} />
        <Brackets active={hovered} size={11} />
        {/* Role chip */}
        <div style={{
          position: 'absolute', top: 8, left: 10,
          background: 'rgba(6,16,31,0.8)', border: `1px solid ${P.hair}`,
          padding: '2px 7px', backdropFilter: 'blur(4px)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.gold, letterSpacing: '0.18em',
        }}>{person.role_short}</div>
        {/* Hover CTA */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none',
        }}>
          <div style={{
            border: `1px solid ${P.gold}`, background: 'rgba(201,169,97,0.12)',
            backdropFilter: 'blur(4px)', padding: '6px 14px',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.cream, letterSpacing: '0.18em',
          }}>PROFILE →</div>
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${P.hair}` }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 14, color: P.cream, letterSpacing: '0.06em', lineHeight: 1.1 }}>
          {person.name.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.mute, marginTop: 5, letterSpacing: '0.12em' }}>
          {person.role_long}
        </div>
        {person.bio && (
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 11, color: `${P.mute}`, lineHeight: 1.55, margin: '8px 0 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{person.bio}</p>
        )}
      </div>
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionHeader({ label, name, desc, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '44px 0 28px', gap: 32, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ width: 3, height: 36, background: P.gold, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.3em', marginBottom: 4 }}>
            {label} · {name}
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 26, color: P.cream, letterSpacing: '0.08em', lineHeight: 1 }}>
            {name} SECTION
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.65, maxWidth: 420, margin: 0, textAlign: 'right' }}>
          {desc}
        </p>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: `${P.gold}66`, letterSpacing: '0.15em' }}>
          {count} PERSONNEL
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Staff() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [personnel, setPersonnel] = useState({});
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState('command');

  useEffect(() => {
    async function load() {
      const { data } = await SB.from('personnel').select('*').eq('visible', true).order('sort_order');
      const grouped = {};
      (data || []).forEach(p => {
        if (!grouped[p.section]) grouped[p.section] = [];
        grouped[p.section].push(p);
      });
      setPersonnel(grouped);
      setLoading(false);
    }
    load();
  }, []);

  function goProfile(person) { navigate(`/profile/${person.id}`, { state: { from: 'staff' } }); }

  if (isMobile) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ padding: '24px 20px 40px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', opacity: 0.8 }}>
            // AY 2025–26
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 32, color: P.cream, letterSpacing: '0.05em', marginTop: 8, marginBottom: 20 }}>
            BATTALION STAFF
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>
              LOADING…
            </div>
          ) : (
            S_SECTIONS.map(sec => {
              const members = personnel[sec.key] || [];
              if (!members.length) return null;
              const isOpen = openSection === sec.key;
              return (
                <div key={sec.key} style={{ borderBottom: `1px solid ${P.hair}` }}>
                  <button
                    onClick={() => setOpenSection(isOpen ? null : sec.key)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0',
                      textAlign: 'left', minHeight: 52, boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ width: 3, height: 28, background: P.gold, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.24em' }}>
                        {sec.label} · {sec.name}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, marginTop: 3 }}>
                        {members.length} PERSONNEL
                      </div>
                    </div>
                    <span style={{
                      color: P.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                      display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s',
                    }}>⌄</span>
                  </button>
                  {isOpen && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 18 }}>
                      {members.map(p => <StaffCard key={p.id} person={p} onViewProfile={goProfile} />)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <CardStyles />
      <PageBackground />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto', padding: '60px 40px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 120, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>
            LOADING…
          </div>
        ) : (
          <>
            {/* ── Page header ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 8 }}>
              <div style={{ width: 3, height: 36, background: P.gold }} />
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.32em', marginBottom: 4 }}>
                  // AY 2025–26 · TROJAN BATTALION
                </div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 32, color: P.cream, letterSpacing: '0.08em', lineHeight: 1 }}>
                  BATTALION STAFF
                </div>
              </div>
            </div>

            {/* ── Roster sections (command + S1–S6) ────────────────────────── */}
            {S_SECTIONS.map(sec => {
              const members = personnel[sec.key] || [];
              if (!members.length) return null;
              return (
                <div key={sec.key}>
                  <SectionHeader label={sec.label} name={sec.name} desc={sec.desc} count={members.length} />
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    gap: 16,
                    paddingBottom: 16,
                  }}>
                    {members.map(p => <StaffCard key={p.id} person={p} onViewProfile={goProfile} />)}
                  </div>
                  <div style={{ height: 1, background: P.hair, margin: '12px 0 0' }} />
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
