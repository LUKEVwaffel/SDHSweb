import { useState, useEffect } from 'react';

// ── NEXT COMPETITION ─────────────────────────────────────────────────────────
// Live countdown to the soonest upcoming raider competition (passed in from
// Raiders.jsx, sourced from events_by_calendar) plus the standing Varsity
// report-time rule. Static rule text — competition day report time is NLT
// 5:45 AM for every Varsity team; update REPORT_TIME_LABEL if that changes.

const P = {
  navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#7EC87E',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

const REPORT_TIME_LABEL = '5:45 AM';

function fmtLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${MON[m - 1]} ${d}, ${y}`;
}

// Target = event date at its event_time, falling back to the Varsity report
// time so the clock still means something when no start time is posted.
function compTarget(ev) {
  if (!ev?.date) return null;
  const [y, m, d] = ev.date.split('-').map(Number);
  const [hh = 5, mm = 45] = (ev.event_time || '05:45:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0).getTime();
}

function Unit({ value, label }) {
  return (
    <div style={{
      flex: 1, minWidth: 74, textAlign: 'center', padding: '18px 8px',
      border: `1px solid ${P.hairStrong}`, background: 'rgba(6,16,31,0.55)',
    }}>
      <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 44, lineHeight: 1, color: P.cream, letterSpacing: '0.02em' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.3em', color: P.gold, opacity: 0.7, marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

export default function RaiderNextComp({ event }) {
  const target = compTarget(event);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const diff = target ? Math.max(0, target - now) : 0;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const fired = target && diff === 0;

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.7 }}>// COUNTDOWN</div>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
        </div>
        <h2 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 42, color: P.cream, letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
          NEXT COMPETITION
        </h2>
      </div>

      {event ? (
        <div style={{ border: `1px solid ${P.gold}`, background: `linear-gradient(160deg, rgba(126,200,126,0.08), rgba(201,169,97,0.02))`, padding: '32px 34px' }}>
          <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 26, color: P.cream, letterSpacing: '0.02em', margin: '0 0 6px', lineHeight: 1.2 }}>
            {event.title?.toUpperCase()}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.16em', marginBottom: 22 }}>
            {fmtLong(event.date)}{event.location ? ` · ${event.location}` : ''}
          </div>

          {fired ? (
            <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 30, color: P.green, letterSpacing: '0.08em' }}>
              COMPETITION DAY — GO GET IT
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Unit value={days} label="DAYS" />
              <Unit value={hours} label="HRS" />
              <Unit value={mins} label="MIN" />
              <Unit value={secs} label="SEC" />
            </div>
          )}

          <div style={{
            marginTop: 22, display: 'flex', alignItems: 'flex-start', gap: 10,
            border: `1px solid ${P.hairStrong}`, background: 'rgba(6,16,31,0.5)', padding: '14px 18px',
          }}>
            <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>⏰</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.cream, lineHeight: 1.65 }}>
              <strong>All Varsity teams report no later than {REPORT_TIME_LABEL}</strong> on competition day.
              Late arrivals do not travel — be early, be squared away.
            </span>
          </div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: '40px 28px', textAlign: 'center' }}>
          <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 22, color: P.cream, letterSpacing: '0.08em', marginBottom: 8 }}>
            NO COMPETITION ON THE BOARD
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.6 }}>
            The next meet posts here with a live countdown as soon as it's scheduled. Varsity report time stays {REPORT_TIME_LABEL}.
          </div>
        </div>
      )}
    </div>
  );
}
