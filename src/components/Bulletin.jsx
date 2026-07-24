import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { toCalendarItem } from '../lib/calendar';

const P = {
  ink: '#06101F',
  navy: '#142847',
  deep: '#0A1628',
  gold: '#C9A961',
  bright: '#E8C77A',
  cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)',
  faint: 'rgba(244,236,216,0.4)',
  hairline: 'rgba(201,169,97,0.25)',
};

// Event categories — color-coded so the schedule scans at a glance.
const CAT = {
  FOOTBALL:  { label: 'FOOTBALL',  color: '#7FA8D6' },
  RAIDER:    { label: 'RAIDER',    color: '#7EC87E' },
  RIFLE:     { label: 'RIFLE',     color: '#C9A961' },
  DRILL:     { label: 'DRILL',     color: '#D69B6B' },
  ACADEMIC:  { label: 'ACADEMIC',  color: '#B48FD4' },
  JROTC:     { label: 'JROTC',     color: '#6BC7C0' },
  BATTALION: { label: 'BATTALION', color: '#E8C77A' },
  CEREMONY:  { label: 'CEREMONY',  color: '#D6889B' },
  BREAK:     { label: 'BREAK',     color: 'rgba(244,236,216,0.45)' },
  EVENT:     { label: 'EVENT',     color: '#C9A961' },
};

// Long-range calendar — now DB-backed. Events live in the `events` table,
// managed by S-6 in DISPATCH → Calendar. Only status='posted' rows show here.
const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const MON3   = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// Group events into ordered month buckets.
function groupByMonth(events) {
  const groups = [];
  let current = null;
  events.forEach(ev => {
    const key = `${ev.y}-${ev.m}`;
    if (!current || current.key !== key) {
      current = { key, y: ev.y, m: ev.m, items: [] };
      groups.push(current);
    }
    current.items.push(ev);
  });
  return groups;
}

function EventRow({ ev }) {
  const [hovered, setHovered] = useState(false);
  const c = CAT[ev.cat] || CAT.EVENT;
  const dayLabel = ev.d2 ? `${ev.d}–${ev.d2}` : String(ev.d).padStart(2, '0');
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '62px 122px 1fr',
        alignItems: 'center', gap: 18,
        padding: '13px 16px 13px 13px',
        borderLeft: `2px solid ${hovered ? c.color : `${c.color}88`}`,
        borderBottom: `1px solid ${P.hairline}`,
        background: hovered ? 'rgba(201,169,97,0.05)' : 'transparent',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Day */}
      <div style={{
        color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
        fontSize: ev.d2 ? 18 : 24, letterSpacing: '0.02em', lineHeight: 1,
      }}>{dayLabel}</div>

      {/* Category pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        border: `1px solid ${P.hairline}`, padding: '4px 9px', width: 'fit-content',
      }}>
        <span style={{ width: 7, height: 7, background: c.color, flexShrink: 0 }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
          letterSpacing: '0.16em', color: P.mute,
        }}>{c.label}</span>
      </div>

      {/* Title + location */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          color: P.cream, fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 500, lineHeight: 1.3,
        }}>{ev.title}</div>
        {ev.where && (
          <div style={{
            color: P.mute, fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5,
            letterSpacing: '0.06em', marginTop: 3,
          }}>{ev.where}</div>
        )}
      </div>
    </div>
  );
}

function MonthPanel({ group }) {
  return (
    <div className="cal-fade">
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
        <div style={{
          fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 30,
          color: P.cream, letterSpacing: '0.06em', lineHeight: 1,
        }}>{MONTHS[group.m]}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.gold, letterSpacing: '0.2em', opacity: 0.7 }}>
          {group.y}
        </div>
        <div style={{ flex: 1, height: 1, background: P.hairline }} />
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.faint, letterSpacing: '0.18em' }}>
          {String(group.items.length).padStart(2, '0')} {group.items.length === 1 ? 'EVENT' : 'EVENTS'}
        </div>
      </div>

      {/* Events */}
      <div style={{ borderTop: `1px solid ${P.hairline}` }}>
        {group.items.map((ev, i) => <EventRow key={`${group.key}-${i}`} ev={ev} />)}
      </div>
    </div>
  );
}

export default function Bulletin() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await SB.from('events').select('*').eq('status', 'posted').order('date', { ascending: true });
      if (cancelled) return;
      const items = (data || []).map(toCalendarItem);
      setEvents(items);
      setLoading(false);
      // Default to the current/upcoming month; fall back to the first.
      const grps = groupByMonth(items);
      const now = new Date();
      const upcoming = grps.find(g => g.y > now.getFullYear() || (g.y === now.getFullYear() && g.m >= now.getMonth()));
      setSelected((upcoming || grps[0])?.key || null);
    })();
    return () => { cancelled = true; };
  }, []);

  const groups = groupByMonth(events);
  const activeGroup = groups.find(g => g.key === selected) || groups[0];

  return (
    <section style={{
      background: P.ink, padding: '72px 32px',
      borderBottom: `1px solid ${P.hairline}`,
    }}>
      <style>{`
        @keyframes calFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .cal-fade { animation: calFade 0.28s ease-out both; }
        .cal-tab { scrollbar-width: none; }
        .cal-tab::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { .cal-fade { animation: none; } }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 26, gap: 32, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              color: P.gold, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, letterSpacing: '0.32em', marginBottom: 12,
            }}>// S-5 SHOP · LONG-RANGE CALENDAR</div>
            <div style={{
              color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
              fontSize: 44, letterSpacing: '0.04em', lineHeight: 0.95,
            }}>BATTALION CALENDAR</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              letterSpacing: '0.22em', color: P.gold, opacity: 0.75,
            }}>{events.length} EVENTS · AY 2025–26</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5,
              letterSpacing: '0.18em', color: P.faint, marginTop: 6,
            }}>AS OF 15 MAY 2026 · SUBJECT TO CHANGE</div>
          </div>
        </div>

        {/* Month selector */}
        <div className="cal-tab" style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
          borderBottom: `1px solid ${P.hairline}`, marginBottom: 28,
        }}>
          {groups.map(g => {
            const on = g.key === selected;
            return (
              <button
                key={g.key}
                onClick={() => setSelected(g.key)}
                aria-pressed={on}
                style={{
                  flexShrink: 0, cursor: 'pointer', background: on ? P.deep : 'transparent',
                  border: 'none', borderBottom: `2px solid ${on ? P.gold : 'transparent'}`,
                  padding: '12px 16px 11px', display: 'flex', alignItems: 'baseline', gap: 7,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(201,169,97,0.05)'; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 16,
                  letterSpacing: '0.08em', color: on ? P.cream : P.mute,
                }}>{MON3[g.m]}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: '0.1em',
                  color: on ? P.gold : P.faint,
                }}>'{String(g.y).slice(2)}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5,
                  color: on ? P.gold : P.faint, opacity: on ? 1 : 0.7,
                }}>· {g.items.length}</span>
              </button>
            );
          })}
        </div>

        {/* Selected month */}
        {loading ? (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.mute, letterSpacing: '0.2em', padding: '48px 0', textAlign: 'center' }}>LOADING CALENDAR…</div>
        ) : events.length === 0 ? (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.mute, letterSpacing: '0.16em', padding: '48px 0', textAlign: 'center' }}>NO EVENTS POSTED YET</div>
        ) : (
          activeGroup && <MonthPanel key={activeGroup.key} group={activeGroup} />
        )}

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          marginTop: 24, paddingTop: 18, borderTop: `1px solid ${P.hairline}`,
        }}>
          {Object.keys(CAT).filter(k => k !== 'EVENT').map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: CAT[k].color }} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                letterSpacing: '0.14em', color: P.faint,
              }}>{CAT[k].label}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
