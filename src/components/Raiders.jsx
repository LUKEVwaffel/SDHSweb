import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import RaiderCarousel from './RaiderCarousel';
import RaiderFAQ from './RaiderFAQ';
import useIsMobile from '../hooks/useIsMobile';
import { categoryColor, eventOccursOnDate, formatRecurrenceDays, formatEventTime } from '../lib/calendar';

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

// `tight` = a plain thin rule at half the margin, no diamond mark. Used
// between sections that read as one continuous train of thought (e.g. the
// tryout info flowing straight into its own calendar) so the page doesn't
// read as one identical divider repeated on a metronome.
function Divider({ tight = false }) {
  if (tight) return <div style={{ height: 1, background: P.hair, margin: '36px 0' }} />;
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
// Redesigned around category-color dots + click-to-expand-day (mirrors the
// main /events MonthGridCalendar pattern instead of cramming full titles into
// tiny cells), plus recurring-practice support: any event with
// `recurrence_days` set repeats across every matching weekday in its
// [date, end_date] range via eventOccursOnDate() — this is the ONLY calendar
// in the app that expands recurrence, so practice repeats show up here and
// nowhere else (see events_recurrence.sql).
function EventCalendar({ events }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [openDay, setOpenDay] = useState(null);
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

  // Map every day in this month to the events (incl. recurring occurrences)
  // touching it, via the shared predicate rather than a plain date-equality
  // lookup — that's what lets the practice series repeat here.
  const eventsByDay = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hits = events.filter((ev) => eventOccursOnDate(ev, dateStr));
    if (hits.length) eventsByDay[d] = hits;
  }

  // "Next up" stays scoped to real one-off events — a recurring series would
  // otherwise dominate a list meant for competitions/field events. The
  // practice strip below covers the recurring schedule instead.
  const oneOff = events.filter((e) => !e.recurrence_days?.length);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const upcoming = [...oneOff]
    .filter((e) => e.date && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const activePractice = events.find((e) => e.recurrence_days?.length && e.end_date && todayStr <= e.end_date);

  const categoriesPresent = [...new Set(events.map((e) => e.category).filter(Boolean))];

  const prevMonth = () => { setOpenDay(null); setViewDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setOpenDay(null); setViewDate(new Date(year, month + 1, 1)); };

  const openDayEvents = openDay ? (eventsByDay[openDay] || []) : [];

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
          <button onClick={prevMonth} aria-label="Previous month" style={navBtn}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.gold; e.currentTarget.style.background = 'rgba(201,169,97,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.hair; e.currentTarget.style.background = 'transparent'; }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: oswald, fontSize: 22, color: P.cream, letterSpacing: '0.12em' }}>{MONTHS[month]}</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, opacity: 0.6, letterSpacing: '0.2em', marginTop: 2 }}>{year}</div>
          </div>
          <button onClick={nextMonth} aria-label="Next month" style={navBtn}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.gold; e.currentTarget.style.background = 'rgba(201,169,97,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.hair; e.currentTarget.style.background = 'transparent'; }}>›</button>
        </div>

        {/* day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${P.hair}` }}>
          {DAYS.map((d) => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.65 }}>{d}</div>
          ))}
        </div>

        {/* day grid — full page width, so cells lean wide-and-short (like a
            real calendar app) with room for 1-2 event chips instead of a
            near-empty square holding one tiny dot. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, padding: 6 }}>
          {cells.map((d, i) => {
            const dayEvents = d ? eventsByDay[d] : null;
            const has = dayEvents && dayEvents.length > 0;
            const isOpen = openDay === d;
            const overflow = has ? dayEvents.length - 2 : 0;
            return (
              <button
                key={i}
                onClick={() => has && setOpenDay(isOpen ? null : d)}
                disabled={!has}
                aria-pressed={isOpen}
                style={{
                  minHeight: 78, display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                  gap: 4, position: 'relative', textAlign: 'left',
                  background: !d ? 'transparent' : isOpen ? 'rgba(201,169,97,0.14)' : isToday(d) ? 'rgba(201,169,97,0.08)' : has ? 'rgba(126,200,126,0.05)' : 'transparent',
                  border: !d ? '1px solid transparent' : `1px solid ${isOpen ? P.gold : isToday(d) ? P.hairStrong : P.hair}`,
                  cursor: has ? 'pointer' : 'default', padding: '6px 7px', boxSizing: 'border-box', transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {d && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontFamily: mono, fontSize: 11, lineHeight: 1,
                        color: isToday(d) ? P.gold : has ? P.cream : `${P.cream}50`, fontWeight: isToday(d) ? 700 : 400,
                      }}>{String(d).padStart(2, '0')}</span>
                      {isToday(d) && <span style={{ width: 4, height: 4, background: P.gold, borderRadius: '50%', flexShrink: 0 }} />}
                    </div>
                    {has && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                        {dayEvents.slice(0, 2).map((ev, idx) => (
                          <div key={ev.id || idx} title={ev.title} style={{
                            fontFamily: mono, fontSize: 7.5, letterSpacing: '0.01em', color: P.cream, opacity: 0.85,
                            borderLeft: `2px solid ${categoryColor(ev.category)}`, paddingLeft: 4, lineHeight: 1.3,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{ev.title}</div>
                        ))}
                        {overflow > 0 && (
                          <div style={{ fontFamily: mono, fontSize: 7, color: P.mute, paddingLeft: 4 }}>+{overflow} more</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* expanded day panel */}
        {openDay && openDayEvents.length > 0 && (
          <div style={{ margin: '0 6px 6px', border: `1px solid ${P.hairStrong}`, background: P.navy, padding: 14 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 10 }}>
              {MONTHS[month]} {openDay} · {openDayEvents.length} EVENT{openDayEvents.length > 1 ? 'S' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openDayEvents.map((ev, idx) => (
                <div key={ev.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 7, height: 7, background: categoryColor(ev.category), flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.cream }}>{ev.title}</span>
                  {formatEventTime(ev.event_time) && <span style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{formatEventTime(ev.event_time)}</span>}
                  {ev.location && <span style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginLeft: 'auto' }}>{ev.location}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* category legend */}
        {categoriesPresent.length > 0 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '12px 20px', borderTop: `1px solid ${P.hair}` }}>
            {categoriesPresent.map((cat) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, background: categoryColor(cat), flexShrink: 0 }} />
                <span style={{ fontFamily: mono, fontSize: 7.5, letterSpacing: '0.12em', color: P.mute }}>{cat.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* standing practice strip */}
        {activePractice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderTop: `1px solid ${P.hair}`, background: 'rgba(78,143,82,0.08)' }}>
            <span style={{ width: 6, height: 6, background: categoryColor(activePractice.category), flexShrink: 0 }} />
            <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.14em', color: P.mute }}>
              STANDING PRACTICE · {formatRecurrenceDays(activePractice.recurrence_days)}{formatEventTime(activePractice.event_time) ? ` · ${formatEventTime(activePractice.event_time)}` : ''}
            </span>
          </div>
        )}

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
  const isMobile = useIsMobile();
  const [commanders, setCommanders] = useState([]);
  const [winners, setWinners] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Commanders: real personnel rows (photos + bios live in DB).
    SB.from('personnel').select('*').eq('section', 'raider').eq('visible', true).order('sort_order')
      .then(({ data }) => setCommanders(data || []));
    // Latest closed-poll winners for raiders.
    SB.from('photo_bulletin').select('*').eq('team', 'raiders').order('published_at', { ascending: false }).limit(1)
      .then(({ data }) => setWinners(data?.[0] || null));
    // Team-tagged events for the calendar (includes the recurring practice
    // series row, if one is posted — see events_recurrence.sql). Reads from
    // the events_by_calendar view so events secondarily tagged 'raiders'
    // (event_secondary_teams — see events_multi_calendar.sql) show up here
    // too, not just events owned by the raiders team.
    SB.from('events_by_calendar').select('*').eq('calendar_team', 'raiders').order('date', { ascending: true })
      .then(({ data }) => setEvents(data || []));
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

      <div className="raiders-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 40px 100px', position: 'relative', zIndex: 1 }}>

        {/* ── Page header — small label above, large title below ── */}
        <div style={{ marginBottom: 44, position: 'relative' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: P.gold,
            fontFamily: mono, fontSize: 10, letterSpacing: '0.28em', padding: '4px 0', marginBottom: 24, marginLeft: -2,
            display: 'flex', alignItems: 'center', gap: 6, transition: 'letter-spacing 0.2s, opacity 0.2s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.letterSpacing = '0.36em'; e.currentTarget.style.opacity = '0.75'; }}
            onMouseLeave={(e) => { e.currentTarget.style.letterSpacing = '0.28em'; e.currentTarget.style.opacity = '1'; }}
          >← HOME</button>

          {/* soft depth glow behind the wordmark, purely decorative */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: -40, left: -60, width: 420, height: 260,
            background: `radial-gradient(closest-side, ${P.green}14, transparent 70%)`,
            pointerEvents: 'none', zIndex: 0,
          }} />

          <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.38em', opacity: 0.75, marginBottom: 10, position: 'relative' }}>
            SPECIALTY TEAM
          </div>
          <h1 className="raiders-title" style={{ fontFamily: oswald, fontWeight: 700, fontSize: 84, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.95, position: 'relative' }}>
            RAIDERS
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, position: 'relative' }}>
            <div style={{ width: 5, height: 5, background: `${P.green}80` }} />
            <div style={{ width: 7, height: 7, background: P.green }} />
            <div style={{ width: 5, height: 5, background: `${P.green}80` }} />
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.22em', color: P.gold, opacity: 0.55, marginLeft: 8 }}>
              ELITE COMPETITION TEAM · TN-051
            </div>
          </div>
        </div>

        {/* ── Hero carousel ── */}
        <div style={{ marginBottom: 40 }}>
          <RaiderCarousel />
        </div>

        {/* ── Meet your commanders + about, side by side (stacks on narrow viewports) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 28, alignItems: 'start' }}>
          <div>
            <SectionLabel tag="// ABOUT THE TEAM" title="WHAT IS RAIDERS" />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: '0 0 14px' }}>
              Raiders is the battalion's physical fitness and tactical skills competition team. Cadets train in rope bridge construction,
              obstacle courses, land navigation, and team relays, then compete against other JROTC battalions at regional meets.
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.mute, lineHeight: 1.75, margin: 0 }}>
              No prior fitness level or JROTC experience is required to join. Training builds up over the season, and every cadet
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

        <Divider tight />

        {/* ── Tryouts & standing practice info — static content, not DB-driven.
            Placed right after the About/Commanders intro so it's the first
            thing a prospective cadet hits after learning what Raiders is. ── */}
        <div>
          <SectionLabel
            tag="// TRYOUTS · PRACTICE"
            title="JOIN THE TEAM"
            subtitle="Raiders fields three teams: Male, Coed, and JV. Tryouts are open to every cadet in the battalion."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'PRACTICES', value: 'MON – THU', sub: '2:30 PM – 4:30 PM' },
              { label: 'REPORT TO', value: 'THE RANGE' },
              { label: 'BRING', value: 'WATER + PT CLOTHES' },
            ].map((t) => (
              <div key={t.label} style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: '24px 22px', position: 'relative' }}>
                <Brackets size={14} opacity={0.3} />
                <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 26, color: P.gold, letterSpacing: '0.02em', lineHeight: 1.15 }}>
                  {t.value}
                </div>
                <div style={{ fontFamily: mono, fontSize: 9, color: P.cream, letterSpacing: '0.2em', marginTop: 12 }}>
                  {t.label}
                </div>
                {t.sub && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.5 }}>{t.sub}</div>}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.75, margin: 0, maxWidth: 640 }}>
            Tryouts determine each season's Male, Coed, and JV rosters. Not every cadet who tries out will make a team;
            spots are limited, and tryout results are final for that season. Cadets who don't make a roster are encouraged
            to come back and try again next year.
          </p>
        </div>

        {/* ── Event calendar — omitted on mobile, same as the unified team
            template; full schedule stays reachable from /events. ── */}
        {!isMobile && (
          <>
            <Divider tight />
            <EventCalendar events={events} />
          </>
        )}

        <Divider tight />

        {/* ── Season calendar download: static PDF, manually re-uploaded when
            the schedule changes. Not generated from live event data. ── */}
        <div style={{ border: `1px solid ${P.hairStrong}`, background: 'rgba(201,169,97,0.03)', padding: '40px 36px' }}>
          <SectionLabel tag="// SCHEDULE" title="NEVER MISS A COMPETITION"
            subtitle="Download the full season calendar — every meet, tryout, and practice date in one PDF." />
          <a href="/assets/raiders-season-calendar.pdf" download="Raiders-Season-Calendar.pdf"
            style={{
              background: P.gold, color: P.ink, textDecoration: 'none', display: 'inline-block',
              fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, padding: '13px 24px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = P.bright)}
            onMouseLeave={(e) => (e.currentTarget.style.background = P.gold)}>
            ↓ DOWNLOAD SEASON CALENDAR
          </a>
        </div>

        <Divider />

        {/* ── Raider Photos: frozen winners from the latest closed poll. Live
            voting + uploads now live on /events (the primary photo gateway) —
            see /submit for the standalone hub. ── */}
        <div style={{ border: `1px solid ${P.hairStrong}`, background: 'rgba(201,169,97,0.03)', padding: '40px 36px' }}>
          <SectionLabel tag="// PHOTOS" title="RAIDER PHOTOS" subtitle="Latest winners from the most recent closed poll." />

          <PhotoWinners cards={winnerCards} />

          <div style={{
            marginTop: 32, paddingTop: 28, borderTop: `1px solid ${P.hair}`,
            display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <button onClick={() => navigate('/events')} style={{
              background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
              fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, padding: '13px 24px',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = P.bright)}
              onMouseLeave={(e) => (e.currentTarget.style.background = P.gold)}>
              VIEW FULL PHOTO GALLERY →
            </button>
          </div>
        </div>

        <Divider />

        {/* ── FAQ ── */}
        <div>
          <SectionLabel tag="// FAQ" title="COMMON QUESTIONS" subtitle="What parents and cadets usually ask about Raiders. Edit freely." />
          <RaiderFAQ />
        </div>

      </div>
      <style>{`
        @media (max-width: 767px) {
          .raiders-wrap { padding: 24px 20px 60px !important; }
          .raiders-title { font-size: 46px !important; }
        }
      `}</style>
    </div>
  );
}
