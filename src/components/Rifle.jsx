import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TeamGallery from './TeamGallery';
import RifleAnalysis from './RifleAnalysis';
import useIsMobile from '../hooks/useIsMobile';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)',
};

// ── Scoped motion (respects reduced-motion) ──────────────────────────────────
function RifleStyles() {
  return (
    <style>{`
      @keyframes rfPulse { 0%,100% { opacity: 0.16; } 50% { opacity: 0.34; } }
      @keyframes rfRing  { 0% { transform: scale(0.85); opacity: 0.5; } 70% { opacity: 0; } 100% { transform: scale(1.6); opacity: 0; } }
      @keyframes rfBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      .rf-target   { animation: rfPulse 3.4s ease-in-out infinite; }
      .rf-ping     { transform-box: fill-box; transform-origin: center; animation: rfRing 3.4s ease-out infinite; }
      .rf-live-dot { animation: rfBlink 1.6s ease-in-out infinite; }
      .rf-clickable:focus-visible { outline: 2px solid #C9A961; outline-offset: 4px; }
      @media (prefers-reduced-motion: reduce) {
        .rf-target, .rf-ping, .rf-live-dot { animation: none; }
      }
    `}</style>
  );
}

// Keyboard activation for click-through cards.
function activate(e, fn) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
}

// ── Shared background ─────────────────────────────────────────────────────────
function PageBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '52px 52px', opacity: 0.25,
      }} />
      {[
        { t: 'σ = Σ(xi - μ)² / n',   top: '8%',  left: '1%'  },
        { t: 'v = d/t · cos(θ)',       top: '18%', left: '0.5%'},
        { t: 'E = ½mv²',               top: '38%', left: '1.2%'},
        { t: 'R = v²sin(2θ) / g',      top: '55%', left: '0.8%'},
        { t: 'accuracy = hits/total',  top: '72%', left: '1%'  },
        { t: 'p = mv (momentum)',       top: '88%', left: '0.5%'},
        { t: 'θ_opt = 45° (max range)',top: '12%', right: '1%' },
        { t: 'KE = ½mv²',              top: '28%', right: '0.8%'},
        { t: 'Δx = v₀t + ½at²',       top: '48%', right: '1.2%'},
        { t: 'f = ma · precision',     top: '65%', right: '0.5%'},
        { t: '// PRECISION · POSTURE', top: '80%', right: '1%' },
        { t: 'μ = Σscore / n',         top: '92%', right: '0.8%'},
      ].map((m, i) => (
        <div key={i} style={{
          position: 'absolute', top: m.top, left: m.left, right: m.right,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5,
          color: P.gold, opacity: 0.09, letterSpacing: '0.1em', whiteSpace: 'nowrap',
        }}>{m.t}</div>
      ))}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
        <line x1="0%" y1="100%" x2="50%" y2="0%" stroke={P.gold} strokeWidth="0.6" opacity="0.05" />
        <line x1="100%" y1="100%" x2="50%" y2="0%" stroke={P.gold} strokeWidth="0.6" opacity="0.05" />
      </svg>
    </div>
  );
}

function Brackets({ size = 14, color = P.gold, opacity = 0.4 }) {
  const s = `1px solid rgba(201,169,97,${opacity})`;
  return (
    <>
      {[
        { top: 0, left: 0, borderTop: s, borderLeft: s },
        { top: 0, right: 0, borderTop: s, borderRight: s },
        { bottom: 0, left: 0, borderBottom: s, borderLeft: s },
        { bottom: 0, right: 0, borderBottom: s, borderRight: s },
      ].map((st, i) => (
        <div key={i} style={{ position: 'absolute', width: size, height: size, ...st, pointerEvents: 'none' }} />
      ))}
    </>
  );
}

function SectionLabel({ tag, title, subtitle }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.7 }}>
          {tag}
        </div>
        <div style={{ flex: 1, height: 1, background: P.hair }} />
      </div>
      <h2 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 42, color: P.cream, letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, margin: '10px 0 0', lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}

// ── Commander Card ────────────────────────────────────────────────────────────
function CommanderCard() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const view = () => navigate('/profile/rifle-cmd', { state: { from: 'home' } });
  return (
    <div
      className="rifle-commander-grid rf-clickable"
      role="button"
      tabIndex={0}
      aria-label="View profile: Makaio Roos, Rifle Team Commander"
      onClick={view}
      onKeyDown={(e) => activate(e, view)}
      style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, border: `1px solid ${P.hair}`, background: P.deep, position: 'relative', cursor: 'pointer' }}
    >
      <Brackets size={18} opacity={hovered ? 0.7 : 0.3} />

      {/* Photo */}
      <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '3/4' }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <img
          src="/assets/makaio-roos.png"
          alt="Makaio Roos"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block', transition: 'transform 0.5s', transform: hovered ? 'scale(1.03)' : 'scale(1)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 60%, rgba(10,22,40,0.85) 100%)', pointerEvents: 'none' }} />
        {/* Role chip */}
        <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(6,16,31,0.82)', border: `1px solid ${P.hair}`, padding: '4px 10px', backdropFilter: 'blur(4px)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.22em' }}>
          COMMANDER
        </div>
      </div>

      {/* Info panel */}
      <div style={{ padding: '40px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Slot label */}
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.6, marginBottom: 8 }}>
          // RIFLE · COMMANDER · 01
        </div>

        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 52, color: P.cream, letterSpacing: '0.03em', margin: '0 0 6px', lineHeight: 1 }}>
          MAKAIO ROOS
        </h1>

        <div style={{ width: 40, height: 2, background: P.gold, marginBottom: 24 }} />

        {/* Metadata rows */}
        {[
          ['ROLE',    'Rifle Team Commander'],
          ['PROGRAM', 'AJROTC Rifle'],
          ['UNIT',    'Trojan Battalion · TN-051'],
          ['AY',      '2025–26'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10, borderBottom: `1px solid ${P.hair}`, paddingBottom: 10 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.gold, letterSpacing: '0.22em', width: 60, flexShrink: 0, opacity: 0.8 }}>{label}</div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.cream }}>{value}</div>
          </div>
        ))}

        {/* Crosshair target decoration */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.35 }}>
            <circle cx="14" cy="14" r="6" stroke={P.gold} strokeWidth="1" />
            <circle cx="14" cy="14" r="11" stroke={P.gold} strokeWidth="0.5" strokeDasharray="2 3" />
            <line x1="14" y1="2"  x2="14" y2="8"  stroke={P.gold} strokeWidth="1" />
            <line x1="14" y1="20" x2="14" y2="26" stroke={P.gold} strokeWidth="1" />
            <line x1="2"  y1="14" x2="8"  y2="14" stroke={P.gold} strokeWidth="1" />
            <line x1="20" y1="14" x2="26" y2="14" stroke={P.gold} strokeWidth="1" />
          </svg>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}55`, letterSpacing: '0.18em' }}>
            PRECISION · DISCIPLINE · EXCELLENCE
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function EventCalendar() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div>
      <SectionLabel
        tag="// UPCOMING · EVENTS"
        title="EVENT CALENDAR"
        subtitle="Scheduled rifle competitions and practice sessions."
      />

      <div style={{ border: `1px solid ${P.hair}`, overflow: 'hidden', background: P.deep }}>
        {/* Calendar nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${P.hair}`, background: P.navy }}>
          <button onClick={prevMonth} style={{ background: 'none', border: `1px solid ${P.hair}`, color: P.gold, cursor: 'pointer', padding: '6px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = P.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = P.hair}>←</button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 22, color: P.cream, letterSpacing: '0.12em' }}>
              {MONTHS[month]}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, opacity: 0.6, letterSpacing: '0.2em', marginTop: 2 }}>
              {year}
            </div>
          </div>

          <button onClick={nextMonth} style={{ background: 'none', border: `1px solid ${P.hair}`, color: P.gold, cursor: 'pointer', padding: '6px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = P.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = P.hair}>→</button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${P.hair}` }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.65, borderRight: `1px solid ${P.hair}` }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((d, i) => (
            <div key={i} style={{
              minHeight: 72,
              borderRight: `1px solid ${P.hair}`,
              borderBottom: `1px solid ${P.hair}`,
              padding: '8px 10px',
              background: isToday(d) ? 'rgba(201,169,97,0.08)' : 'transparent',
              position: 'relative',
            }}>
              {d && (
                <>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    color: isToday(d) ? P.gold : `${P.cream}60`,
                    fontWeight: isToday(d) ? 700 : 400,
                    lineHeight: 1,
                  }}>{String(d).padStart(2, '0')}</div>
                  {isToday(d) && (
                    <div style={{ width: 4, height: 4, background: P.gold, borderRadius: '50%', position: 'absolute', top: 8, right: 8 }} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Empty events state */}
        <div style={{ padding: '20px 24px', borderTop: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="rf-live-dot" style={{ width: 6, height: 6, background: `${P.gold}66`, flexShrink: 0 }} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: `${P.gold}66`, letterSpacing: '0.18em' }}>
            SEASON NOT STARTED · COMPETITION SCHEDULE TO BE ANNOUNCED
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: P.gold,    label: 'COMPETITION' },
          { color: '#4A9EFF', label: 'PRACTICE'    },
          { color: '#7EC87E', label: 'QUALIFIER'   },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, background: color, opacity: 0.7 }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.mute, letterSpacing: '0.18em' }}>{label}</div>
          </div>
        ))}
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}33`, letterSpacing: '0.14em', marginLeft: 'auto', alignSelf: 'center' }}>
          {MONTHS[today.getMonth()].slice(0,3)} {today.getDate()}, {today.getFullYear()} · TODAY
        </div>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function Rifle() {
  const isMobile = useIsMobile();
  return (
    <div style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative' }}>
      <RifleStyles />
      <PageBg />

      <div className="rifle-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 40px 100px', position: 'relative', zIndex: 1 }}>

        {/* ── Page header ── */}
        <div className="rifle-header" style={{ marginBottom: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.32em', opacity: 0.7 }}>
              // SPECIALTY TEAMS · RIFLE
            </div>
            <div style={{ flex: 1, height: 1, background: P.hair }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}55`, letterSpacing: '0.2em' }}>
              TN-051 · AY 2025-26
            </div>
          </div>
          <h1 className="rifle-title" style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 72, color: P.cream, letterSpacing: '0.04em', margin: '0 0 6px', lineHeight: 1 }}>
            RIFLE TEAM
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 5, height: 5, background: `${P.gold}50` }} />
            <div style={{ width: 7, height: 7, background: P.gold }} />
            <div style={{ width: 5, height: 5, background: `${P.gold}50` }} />
            <div style={{ width: 48, height: 1, background: P.hair, marginLeft: 4 }} />
          </div>
        </div>

        {/* ── Commander ── */}
        <div style={{ marginBottom: 72 }}>
          <SectionLabel tag="// LEADERSHIP" title="TEAM COMMANDER" />
          <CommanderCard />
        </div>

        {/* ── Divider ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 72 }}>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}55`, letterSpacing: '0.24em', padding: '0 4px' }}>
            ◆
          </div>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
        </div>

        {/* ── Shooter analysis (last season) ── */}
        <div style={{ marginBottom: 72 }}>
          <RifleAnalysis />
        </div>

        {/* ── Calendar — omitted on mobile; the design's mobile team template
            doesn't carry a calendar, and the event list is already reachable
            from /events. ── */}
        {!isMobile && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 72 }}>
              <div style={{ flex: 1, height: 1, background: P.hair }} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}55`, letterSpacing: '0.24em', padding: '0 4px' }}>
                ◆
              </div>
              <div style={{ flex: 1, height: 1, background: P.hair }} />
            </div>
            <EventCalendar />
          </>
        )}

        {/* ── Divider ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '72px 0' }}>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}55`, letterSpacing: '0.24em', padding: '0 4px' }}>◆</div>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
        </div>

        {/* ── Photo gallery ── */}
        <div>
          <SectionLabel tag="// GALLERY" title="TEAM PHOTOS" />
          <div style={{ marginTop: 24 }}>
            <TeamGallery teamId="rifle" />
          </div>
        </div>

      </div>
      <style>{`
        @media (max-width: 767px) {
          .rifle-wrap { padding: 24px 20px 60px !important; }
          .rifle-title { font-size: 38px !important; }
          .rifle-commander-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
