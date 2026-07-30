import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import RaiderVoting from './RaiderVoting';
import RaiderCarousel from './RaiderCarousel';
import RaiderFAQ from './RaiderFAQ';

// Palette mirrors Rifle.jsx for a consistent specialty-team look. Green is the
// raider live/event accent; gold stays the structural/command accent.
const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#7EC87E',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

const CAT_LABEL = { funny: 'FUNNY', aura: 'AURA', team: 'TEAM LEADING' };

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Scoped motion (respects reduced-motion) ──────────────────────────────────
function RaiderStyles() {
  return (
    <style>{`
      @keyframes rdBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      @keyframes rdPulse { 0%,100% { opacity: 0.16; } 50% { opacity: 0.34; } }
      .rd-live-dot { animation: rdBlink 1.6s ease-in-out infinite; }
      .rd-pulse    { animation: rdPulse 3.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .rd-live-dot, .rd-pulse { animation: none; }
      }
    `}</style>
  );
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
        { t: 't = d / pace',            top: '10%', left: '1%' },
        { t: 'load = 35 lb ruck',       top: '22%', left: '0.6%' },
        { t: 'grade = rise/run',        top: '40%', left: '1.2%' },
        { t: 'knot = one rope bridge',  top: '58%', left: '0.8%' },
        { t: 'cadence = steps/min',     top: '74%', left: '1%' },
        { t: '// STRENGTH · TEAM · GRIT', top: '90%', left: '0.6%' },
        { t: 'F = m·a (obstacle)',      top: '14%', right: '1%' },
        { t: 'HR_max = 220 − age',      top: '30%', right: '0.7%' },
        { t: 'W = F·d (haul)',          top: '50%', right: '1.1%' },
        { t: 'v = Δx/Δt (sprint)',      top: '66%', right: '0.6%' },
        { t: 'grip > gravity',          top: '82%', right: '1%' },
        { t: 'Σ effort → medal',        top: '94%', right: '0.7%' },
      ].map((m, i) => (
        <div key={i} style={{
          position: 'absolute', top: m.top, left: m.left, right: m.right,
          fontFamily: mono, fontSize: 8.5,
          color: P.gold, opacity: 0.09, letterSpacing: '0.1em', whiteSpace: 'nowrap',
        }}>{m.t}</div>
      ))}
    </div>
  );
}

function Brackets({ size = 14, opacity = 0.4 }) {
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
        <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.7 }}>{tag}</div>
        <div style={{ flex: 1, height: 1, background: P.hair }} />
      </div>
      <h2 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 42, color: P.cream, letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, margin: '10px 0 0', lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '72px 0' }}>
      <div style={{ flex: 1, height: 1, background: P.hair }} />
      <div style={{ fontFamily: mono, fontSize: 8, color: `${P.gold}55`, letterSpacing: '0.24em', padding: '0 4px' }}>◆</div>
      <div style={{ flex: 1, height: 1, background: P.hair }} />
    </div>
  );
}

// ── Commander Card (DB-driven, click → bio profile) ──────────────────────────
function CommanderCard({ person, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const open = () => onOpen(person);
  const hasPhoto = person.photo_url && imgOk;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View profile: ${person.name}, ${person.role_long || 'Raider Commander'}`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? P.hairStrong : P.hair}`,
        background: hovered ? 'rgba(201,169,97,0.04)' : P.deep,
        transition: 'border-color 0.2s, background 0.2s',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        cursor: 'pointer', position: 'relative', outline: 'none',
      }}
    >
      <Brackets size={16} opacity={hovered ? 0.7 : 0.3} />

      {/* photo area */}
      <div style={{
        aspectRatio: '3 / 4',
        background: `linear-gradient(160deg, rgba(20,40,71,0.9), rgba(6,16,31,0.95))`,
        margin: 14, position: 'relative', overflow: 'hidden',
        border: `1px solid ${P.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {hasPhoto ? (
          <img
            src={person.photo_url}
            alt={person.name}
            onError={() => setImgOk(false)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block',
              transition: 'transform 0.4s, filter 0.3s',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              filter: hovered ? 'none' : 'saturate(0.9)',
            }}
          />
        ) : (
          // AWAITING PORTRAIT placeholder (shared pattern with CommandProfile)
          <div style={{
            width: '100%', height: '100%', position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
            background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 10px, ${P.navy} 10px, ${P.navy} 11px)`,
          }}>
            <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 44, color: P.gold, opacity: 0.32 }}>
              {initials(person.name)}
            </div>
            <span style={{ fontFamily: mono, fontSize: 8, color: `${P.gold}66`, letterSpacing: '0.24em' }}>
              AWAITING PORTRAIT
            </span>
          </div>
        )}
        {/* gradient + role chip */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, rgba(6,16,31,0.85))', pointerEvents: 'none' }} />
        <div style={{
          position: 'absolute', top: 10, left: 10, background: 'rgba(6,16,31,0.8)', border: `1px solid ${P.hair}`,
          padding: '3px 9px', backdropFilter: 'blur(4px)', fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em',
        }}>
          {person.role_short || 'CMD'}
        </div>
        {/* hover CTA */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingBottom: 14, opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none',
        }}>
          <div style={{
            border: `1px solid ${P.gold}`, background: 'rgba(201,169,97,0.13)', backdropFilter: 'blur(4px)',
            padding: '6px 14px', fontFamily: mono, fontSize: 9, color: P.cream, letterSpacing: '0.2em',
          }}>VIEW PROFILE →</div>
        </div>
      </div>

      {/* info area */}
      <div style={{ padding: '2px 18px 22px' }}>
        <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.3em', color: P.gold, opacity: 0.55, marginBottom: 8 }}>
          {person.role_long ? person.role_long.toUpperCase() : 'RAIDER COMMANDER'}
        </div>
        <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 22, letterSpacing: '0.04em', color: P.cream, marginBottom: 6 }}>
          {person.name}
        </div>
        <div style={{ width: 32, height: 2, background: P.gold }} />
      </div>
    </div>
  );
}

// ── Team stats (admin-editable; renders "pending" until real rows exist) ─────
function StatsSection({ stats }) {
  return (
    <div>
      <SectionLabel
        tag="// COMPETITION · RECORD"
        title="TEAM STATS"
        subtitle="County placement, trophies, and season record. Entered via admin — no placeholder numbers."
      />
      {stats.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {stats.map((s) => (
            <div key={s.id} style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: '24px 22px', position: 'relative' }}>
              <Brackets size={14} opacity={0.3} />
              <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 44, color: P.gold, letterSpacing: '0.02em', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.cream, letterSpacing: '0.2em', marginTop: 12 }}>
                {s.label}
              </div>
              {s.sub && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.5 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: '56px 24px', textAlign: 'center', position: 'relative' }}>
          <Brackets size={18} opacity={0.3} />
          <div className="rd-pulse" style={{ fontFamily: oswald, fontWeight: 700, fontSize: 24, color: P.cream, letterSpacing: '0.1em', marginBottom: 8 }}>
            STATS PENDING
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
            County placement, trophy counts, and season results appear here once entered.
            No numbers are shown until they are real.
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: `${P.gold}55`, letterSpacing: '0.28em', marginTop: 18 }}>
            // AWAITING RESULTS
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photo winners (from last event's closed poll) ────────────────────────────
function PhotoWinners({ cards }) {
  return (
    <div>
      <SectionLabel
        tag="// LAST EVENT · PHOTO VOTE"
        title="LATEST WINNERS"
        subtitle="Top Funny / Aura / Team-Leading photos from the most recent closed poll."
      />
      {cards.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {cards.map((w) => (
            <div key={w.key} style={{ background: P.deep, border: `1px solid ${P.hairStrong}`, overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '4/3', background: P.navy }}>
                <img src={w.url} alt={w.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 10, left: 10, background: P.gold, color: P.ink, fontFamily: mono, fontSize: 9, letterSpacing: '0.14em', padding: '4px 10px' }}>
                  🏆 {w.label}
                </div>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: P.mute }}>{w.caption ? `📷 ${w.caption}` : 'RAIDER TEAM'}</span>
                <span style={{ fontFamily: oswald, fontSize: 16, color: P.gold }}>{w.votes} ▲</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: '48px 24px', textAlign: 'center', position: 'relative' }}>
          <Brackets size={16} opacity={0.3} />
          <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 22, color: P.cream, letterSpacing: '0.08em', marginBottom: 8 }}>
            NO CLOSED POLLS YET
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
            Winners post here after an event's photo vote closes. Vote in the live poll below.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Event Calendar (wired to events where team = raiders) ────────────────────
function EventCalendar({ events }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  // Map events to this month's day cells. `date` is 'YYYY-MM-DD'.
  const eventsByDay = {};
  for (const ev of events) {
    const [ey, em, ed] = (ev.date || '').split('-').map(Number);
    if (ey === year && em === month + 1) {
      (eventsByDay[ed] = eventsByDay[ed] || []).push(ev);
    }
  }

  // Upcoming list: today onward, chronological.
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const upcoming = [...events]
    .filter((e) => e.date && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div>
      <SectionLabel
        tag="// UPCOMING · EVENTS"
        title="EVENT CALENDAR"
        subtitle="Scheduled raider competitions, practices, and field events."
      />

      <div style={{ border: `1px solid ${P.hair}`, overflow: 'hidden', background: P.deep }}>
        {/* nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${P.hair}`, background: P.navy }}>
          <button onClick={prevMonth} style={navBtn}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.gold)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hair)}>←</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: oswald, fontSize: 22, color: P.cream, letterSpacing: '0.12em' }}>{MONTHS[month]}</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, opacity: 0.6, letterSpacing: '0.2em', marginTop: 2 }}>{year}</div>
          </div>
          <button onClick={nextMonth} style={navBtn}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.gold)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hair)}>→</button>
        </div>

        {/* day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${P.hair}` }}>
          {DAYS.map((d) => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.65, borderRight: `1px solid ${P.hair}` }}>{d}</div>
          ))}
        </div>

        {/* day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((d, i) => {
            const dayEvents = d ? eventsByDay[d] : null;
            const has = dayEvents && dayEvents.length > 0;
            return (
              <div key={i} style={{
                minHeight: 76, borderRight: `1px solid ${P.hair}`, borderBottom: `1px solid ${P.hair}`,
                padding: '8px 10px', position: 'relative',
                background: isToday(d) ? 'rgba(201,169,97,0.08)' : has ? 'rgba(126,200,126,0.06)' : 'transparent',
              }}>
                {d && (
                  <>
                    <div style={{
                      fontFamily: mono, fontSize: 11, lineHeight: 1,
                      color: isToday(d) ? P.gold : `${P.cream}60`, fontWeight: isToday(d) ? 700 : 400,
                    }}>{String(d).padStart(2, '0')}</div>
                    {isToday(d) && <div style={{ width: 4, height: 4, background: P.gold, borderRadius: '50%', position: 'absolute', top: 8, right: 8 }} />}
                    {has && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div key={ev.id} title={ev.title} style={{
                            fontFamily: mono, fontSize: 7.5, color: P.green, letterSpacing: '0.04em',
                            borderLeft: `2px solid ${P.green}`, paddingLeft: 4,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{ev.title}</div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div style={{ fontFamily: mono, fontSize: 7, color: P.mute }}>+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* upcoming footer */}
        <div style={{ borderTop: `1px solid ${P.hair}`, padding: '16px 20px' }}>
          {upcoming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.28em', opacity: 0.7 }}>NEXT UP</div>
              {upcoming.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: P.green, letterSpacing: '0.08em', width: 92, flexShrink: 0 }}>
                    {fmtDate(ev.date)}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.cream }}>{ev.title}</div>
                  {ev.location && <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginLeft: 'auto' }}>{ev.location}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="rd-live-dot" style={{ width: 6, height: 6, background: `${P.gold}66`, flexShrink: 0 }} />
              <div style={{ fontFamily: mono, fontSize: 9, color: `${P.gold}66`, letterSpacing: '0.18em' }}>
                NO UPCOMING RAIDER EVENTS · SCHEDULE TO BE ANNOUNCED
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${MON[m - 1]} ${String(d).padStart(2, '0')}, ${y}`;
}

const navBtn = {
  background: 'none', border: `1px solid ${P.hair}`, color: P.gold, cursor: 'pointer',
  padding: '6px 12px', fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', transition: 'border-color 0.15s',
};

// ── Main export ──────────────────────────────────────────────────────────────
export default function Raiders() {
  const navigate = useNavigate();
  const [commanders, setCommanders] = useState([]);
  const [winners, setWinners] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState([]);

  useEffect(() => {
    // Commanders: real personnel rows (photos + bios live in DB).
    SB.from('personnel').select('*').eq('section', 'raider').eq('visible', true).order('sort_order')
      .then(({ data }) => setCommanders(data || []));
    // Latest closed-poll winners for raiders.
    SB.from('photo_bulletin').select('*').eq('team', 'raiders').order('published_at', { ascending: false }).limit(1)
      .then(({ data }) => setWinners(data?.[0] || null));
    // Team-tagged events for the calendar.
    SB.from('events').select('*').eq('team', 'raiders').order('date', { ascending: true })
      .then(({ data }) => setEvents(data || []));
    // Admin-editable stats (empty until real numbers entered).
    SB.from('team_stats').select('*').eq('team', 'raiders').order('sort_order', { ascending: true })
      .then(({ data }) => setStats(data || []));
  }, []);

  const winnerCards = winners
    ? ['funny', 'aura', 'team'].map((k) => ({
        key: k, label: CAT_LABEL[k],
        url: winners[`winner_${k}_url`], caption: winners[`winner_${k}_caption`], votes: winners[`winner_${k}_votes`],
      })).filter((w) => w.url)
    : [];

  const openProfile = (person) => navigate(`/profile/${person.id}`, { state: { from: 'raiders' } });

  return (
    <div style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif', position: 'relative' }}>
      <RaiderStyles />
      <PageBg />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 40px 100px', position: 'relative', zIndex: 1 }}>

        {/* ── Page header — small label above, large title below ── */}
        <div style={{ marginBottom: 44 }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: P.gold,
            fontFamily: mono, fontSize: 10, letterSpacing: '0.28em', padding: 0, marginBottom: 28, display: 'block',
          }}>← HOME</button>

          <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.38em', opacity: 0.75, marginBottom: 10 }}>
            SPECIALTY TEAM
          </div>
          <h1 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 84, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.95 }}>
            RAIDERS
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
            <div style={{ width: 5, height: 5, background: `${P.green}80` }} />
            <div style={{ width: 7, height: 7, background: P.green }} />
            <div style={{ width: 5, height: 5, background: `${P.green}80` }} />
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.22em', color: P.gold, opacity: 0.55, marginLeft: 8 }}>
              ELITE COMPETITION TEAM · TN-051
            </div>
          </div>
        </div>

        {/* ── Hero carousel ── */}
        <div style={{ marginBottom: 64 }}>
          <RaiderCarousel />
        </div>

        {/* ── Meet your commanders + about, side by side (stacks on narrow viewports) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 44, alignItems: 'start' }}>
          <div>
            <SectionLabel tag="// ABOUT THE TEAM" title="WHAT IS RAIDERS" />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: '0 0 14px' }}>
              Raiders is the battalion's physical fitness and tactical skills competition team. Cadets train in rope bridge construction,
              obstacle courses, land navigation, and team relays, then compete against other JROTC battalions at regional meets.
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: 0 }}>
              No prior fitness level or JROTC experience is required to join — training builds up over the season, and every cadet
              is welcome at practice regardless of where they're starting from.
            </p>
          </div>
          <div>
            <SectionLabel tag="// LEADERSHIP" title="MEET YOUR COMMANDERS" subtitle="Tap a commander for their full profile." />
            {commanders.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                {commanders.map((c) => <CommanderCard key={c.id} person={c} onOpen={openProfile} />)}
              </div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>LOADING…</div>
            )}
          </div>
        </div>

        <Divider />

        {/* ── Team stats ── */}
        <StatsSection stats={stats} />

        <Divider />

        {/* ── Event calendar ── */}
        <EventCalendar events={events} />

        <Divider />

        {/* ── Raider Photos hub: winners + live voting + gallery CTA, one themed block ── */}
        <div style={{ border: `1px solid ${P.hairStrong}`, background: 'rgba(201,169,97,0.03)', padding: '40px 36px' }}>
          <SectionLabel tag="// PHOTOS · VOTING" title="RAIDER PHOTOS" subtitle="Latest winners, live voting, and the full event gallery." />

          <PhotoWinners cards={winnerCards} />

          <div style={{ marginTop: 40 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.28em', opacity: 0.7, marginBottom: 16 }}>
              // LIVE VOTE — FUNNY · AURA · TEAM LEADING
            </div>
            <RaiderVoting compact />
          </div>

          <div style={{
            marginTop: 32, paddingTop: 28, borderTop: `1px solid ${P.hair}`,
            display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <button onClick={() => navigate('/submit')} style={{
              background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
              fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, padding: '13px 24px',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = P.bright)}
              onMouseLeave={(e) => (e.currentTarget.style.background = P.gold)}>
              📸 SUBMIT A RAIDER PHOTO →
            </button>
            <button onClick={() => navigate('/events')} style={{
              background: 'transparent', color: P.cream, border: `1px solid ${P.hairStrong}`, cursor: 'pointer',
              fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, padding: '13px 24px',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hairStrong)}>
              VIEW FULL PHOTO GALLERY →
            </button>
          </div>
        </div>

        <Divider />

        {/* ── FAQ ── */}
        <div>
          <SectionLabel tag="// FAQ" title="COMMON QUESTIONS" subtitle="What parents and cadets usually ask about Raiders — edit freely." />
          <RaiderFAQ />
        </div>

      </div>
    </div>
  );
}
