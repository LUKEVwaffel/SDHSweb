import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';

// Public, no-login landing for sdhsjrotc.com/feedback — lists every event
// currently open for feedback so a cadet without a direct link can still
// find one. The direct /feedback/:eventId token link (texted out, QR'd,
// whatever) keeps working untouched — see EventFeedbackForm.jsx.

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.22)',
};

export default function EventFeedbackPicker() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(undefined); // undefined=loading, []=none

  useEffect(() => {
    (async () => {
      const { data } = await SB.from('events')
        .select('id,title,date')
        .eq('feedback_enabled', true)
        .order('date', { ascending: false });
      setEvents(data || []);
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 18px 60px' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.2em', marginBottom: 6 }}>
          EVENT FEEDBACK
        </div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 24, color: P.cream, fontWeight: 600, letterSpacing: '0.01em' }}>
          Pick an event
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute, marginTop: 12, lineHeight: 1.6 }}>
          Feedback is open for the events below. Choose the one you went to.
        </div>

        <div style={{ marginTop: 26 }}>
          {events === undefined && (
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, textAlign: 'center', padding: '40px 0' }}>
              Loading…
            </div>
          )}
          {events && events.length === 0 && (
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, textAlign: 'center', padding: '40px 0' }}>
              No events are open for feedback right now. Check back after your next event.
            </div>
          )}
          {events && events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => navigate(`/feedback/${ev.id}`)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: P.deep,
                border: `1px solid ${P.hair}`, color: P.cream, padding: '16px 18px',
                marginBottom: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 500 }}>{ev.title}</div>
              {ev.date && (
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.faint, marginTop: 5, letterSpacing: '0.04em' }}>
                  {new Date(ev.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
