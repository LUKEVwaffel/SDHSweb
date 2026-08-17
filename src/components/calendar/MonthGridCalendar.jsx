import { useState, useMemo } from 'react';
import { categoryColor, MONTHS } from '../../lib/calendar';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', faint: 'rgba(244,236,216,0.35)',
  hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
const inter = 'Inter, sans-serif';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function firstWeekday(year, month) { return new Date(year, month, 1).getDay(); }

// Map day-of-month -> events touching that day, expanding multi-day spans
// (end_date) across every day in range so a 3-day event shows a dot on all 3.
function eventsByDay(events, year, month) {
  const map = {};
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  for (const ev of events) {
    if (!ev.date) continue;
    const start = new Date(`${ev.date}T00:00:00`);
    const end = ev.end_date ? new Date(`${ev.end_date}T00:00:00`) : start;
    const from = start < monthStart ? monthStart : start;
    const to = end > monthEnd ? monthEnd : end;
    if (from > to) continue;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (map[day] ||= []).push(ev);
      }
    }
  }
  return map;
}

function pickInitialMonth(events) {
  const now = new Date();
  const upcoming = events.find((ev) => ev.date && new Date(`${ev.date}T00:00:00`) >= now);
  const d = upcoming?.date ? new Date(`${upcoming.date}T00:00:00`) : now;
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * Public day-grid month calendar. Reads already-fetched `events` rows
 * (status='posted'), renders a Sun-Sat grid with category-color dots per day.
 * Clicking a day selects it; if that day has >1 event, a small picker below
 * the grid lets the visitor narrow to one. Selecting an event calls
 * onSelectEvent(id) so the parent can filter the photo grid; passing null
 * clears back to "all recent photos".
 */
export default function MonthGridCalendar({ events, selectedEventId, onSelectEvent }) {
  const [cursor, setCursor] = useState(() => pickInitialMonth(events));
  const [openDay, setOpenDay] = useState(null);
  const { year, month } = cursor;

  const dayMap = useMemo(() => eventsByDay(events, year, month), [events, year, month]);
  const totalDays = daysInMonth(year, month);
  const startWeekday = firstWeekday(year, month);

  function prevMonth() {
    setOpenDay(null);
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  }
  function nextMonth() {
    setOpenDay(null);
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  }

  function handleDayClick(day) {
    const dayEvents = dayMap[day] || [];
    if (!dayEvents.length) return;
    if (dayEvents.length === 1) {
      onSelectEvent(dayEvents[0].id === selectedEventId ? null : dayEvents[0].id);
      setOpenDay(null);
      return;
    }
    setOpenDay(openDay === day ? null : day);
  }

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const openDayEvents = openDay ? (dayMap[openDay] || []) : [];

  return (
    <div>
      {/* Month header */}
      <div className="mgc-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <button onClick={prevMonth} aria-label="Previous month" style={navBtn}>‹</button>
        <div className="mgc-header-label" style={{ fontFamily: oswald, fontWeight: 700, fontSize: 26, letterSpacing: '0.06em', color: P.cream }}>
          {MONTHS[month]} <span style={{ color: P.gold, opacity: 0.75 }}>{year}</span>
        </div>
        <button onClick={nextMonth} aria-label="Next month" style={navBtn}>›</button>
      </div>

      {/* Weekday row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="mgc-weekday" style={{ textAlign: 'center', fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.14em', padding: '4px 0' }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const dayEvents = dayMap[day] || [];
          const hasEvents = dayEvents.length > 0;
          const isSelected = dayEvents.some((e) => e.id === selectedEventId) || openDay === day;
          return (
            <button
              key={day}
              className="mgc-cell"
              onClick={() => handleDayClick(day)}
              disabled={!hasEvents}
              aria-pressed={isSelected}
              style={{
                aspectRatio: '1', minHeight: 52, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: isSelected ? 'rgba(201,169,97,0.12)' : P.deep,
                border: `1px solid ${isSelected ? P.gold : P.hair}`,
                cursor: hasEvents ? 'pointer' : 'default',
                padding: 4, boxSizing: 'border-box',
              }}
            >
              <span className="mgc-daynum" style={{ fontFamily: mono, fontSize: 12, color: hasEvents ? P.cream : P.faint }}>{day}</span>
              {hasEvents && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 32 }}>
                  {dayEvents.slice(0, 4).map((ev) => (
                    <span key={ev.id} style={{ width: 6, height: 6, background: categoryColor(ev.category), flexShrink: 0 }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Multi-event day picker */}
      {openDay && openDayEvents.length > 1 && (
        <div style={{ marginTop: 16, border: `1px solid ${P.hair}`, background: P.navy, padding: 14 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 10 }}>
            {openDayEvents.length} EVENTS ON {MONTHS[month]} {openDay}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {openDayEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onSelectEvent(ev.id === selectedEventId ? null : ev.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  background: ev.id === selectedEventId ? 'rgba(201,169,97,0.1)' : 'transparent',
                  border: `1px solid ${ev.id === selectedEventId ? P.gold : P.hair}`,
                  padding: '8px 12px', cursor: 'pointer',
                }}
              >
                <span style={{ width: 8, height: 8, background: categoryColor(ev.category), flexShrink: 0 }} />
                <span style={{ fontFamily: inter, fontSize: 13, color: P.cream }}>{ev.title}</span>
                {ev.location && <span style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginLeft: 'auto' }}>{ev.location}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedEventId && (
        <button onClick={() => { onSelectEvent(null); setOpenDay(null); }} style={{ ...navBtn, width: 'auto', marginTop: 14, padding: '8px 16px', fontSize: 10, fontFamily: mono, letterSpacing: '0.14em' }}>
          ← CLEAR FILTER
        </button>
      )}
      <style>{`
        .mgc-cell { transition: background 0.12s, border-color 0.12s; }
        .mgc-cell:not(:disabled):hover { background: rgba(201,169,97,0.16) !important; border-color: ${P.gold} !important; }
        @media (max-width: 767px) {
          .mgc-header-label { font-size: 20px !important; }
          .mgc-weekday { font-size: 8.5px !important; padding: 2px 0 !important; }
          .mgc-cell { min-height: 44px !important; padding: 2px !important; }
          .mgc-daynum { font-size: 11px !important; }
        }
      `}</style>
    </div>
  );
}

const navBtn = {
  background: 'transparent', border: `1px solid ${P.hair}`, color: P.gold,
  cursor: 'pointer', fontSize: 20, width: 36, height: 36, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
