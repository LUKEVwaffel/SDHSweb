import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import { toCalendarItem, MON3, categoryColor } from '../lib/calendar';

const P = {
  ink: '#06101F',
  gold: '#C9A961',
  bright: '#E8C77A',
  cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)',
  faint: 'rgba(244,236,216,0.4)',
  hairline: 'rgba(201,169,97,0.25)',
};

const UPCOMING_COUNT = 5;

function TeaserRow({ ev }) {
  const dayLabel = ev.d2 ? `${ev.d}–${ev.d2}` : String(ev.d).padStart(2, '0');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '56px 1fr', alignItems: 'center', gap: 16,
      padding: '12px 4px', borderBottom: `1px solid ${P.hairline}`,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: ev.d2 ? 15 : 20, color: P.cream, lineHeight: 1 }}>{dayLabel}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.mute, marginTop: 2 }}>{MON3[ev.m]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, background: categoryColor(ev.cat), flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: P.cream, fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
          {ev.where && <div style={{ color: P.mute, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, marginTop: 2 }}>{ev.where}</div>}
        </div>
      </div>
    </div>
  );
}

// Home-page teaser — next few posted events, linking to the full /events
// calendar (day-grid + photos). The month-tab full-calendar view that used to
// live here moved to /events so it isn't duplicated on the homepage.
export default function Bulletin() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await SB.from('events').select('*').eq('status', 'posted')
        .gte('date', today).order('date', { ascending: true }).limit(UPCOMING_COUNT);
      if (cancelled) return;
      setEvents((data || []).map(toCalendarItem));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section style={{ background: P.ink, padding: '56px 32px', borderBottom: `1px solid ${P.hairline}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: P.gold, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.32em', marginBottom: 10 }}>
              // S-5 SHOP · UPCOMING
            </div>
            <div style={{ color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 36, letterSpacing: '0.04em', lineHeight: 0.95 }}>
              WHAT'S NEXT
            </div>
          </div>
          <button onClick={() => navigate('/events')} style={viewAllBtn}>VIEW FULL CALENDAR →</button>
        </div>

        {loading ? (
          <div style={emptyStyle}>LOADING…</div>
        ) : events.length === 0 ? (
          <div style={emptyStyle}>NO UPCOMING EVENTS POSTED YET</div>
        ) : (
          <div style={{ borderTop: `1px solid ${P.hairline}` }}>
            {events.map((ev) => <TeaserRow key={ev.id} ev={ev} />)}
          </div>
        )}
      </div>
    </section>
  );
}

const viewAllBtn = {
  background: 'transparent', border: `1px solid ${P.hairline}`, color: P.gold,
  cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
  letterSpacing: '0.16em', padding: '10px 18px', whiteSpace: 'nowrap',
};
const emptyStyle = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.mute,
  letterSpacing: '0.16em', padding: '40px 0', textAlign: 'center',
};
