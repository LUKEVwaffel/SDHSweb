import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../theme';

// "Front door" of DISPATCH. At-a-glance status of what genuinely needs action,
// with progress on consent collection, then a compact roll-up of standing counts.
// Every card clicks through to the tool that resolves it. Queries are defensive:
// tables added later (email_messages, cadet_consent) may not exist — those cards
// degrade to a dash rather than erroring.
async function safeCount(table, apply) {
  try {
    let q = SB.from(table).select('*', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Priority action card — larger, colored accent, hover lift, clicks through.
function ActionCard({ value, label, hint, tone, alert, onClick }) {
  const [hover, setHover] = useState(false);
  const accent = alert ? tone : P.hair;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: hover ? P.navy : P.deep,
        border: `1px solid ${hover ? tone : accent}`,
        borderLeft: `3px solid ${alert ? tone : P.hair}`,
        padding: '16px 18px', transition: 'all 0.15s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? `0 6px 20px rgba(0,0,0,0.35)` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: alert ? tone : P.gold, letterSpacing: '0.15em', lineHeight: 1.5, maxWidth: '80%' }}>{label}</div>
        {alert && <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone, marginTop: 3, boxShadow: `0 0 8px ${tone}` }} />}
      </div>
      <div style={{ fontFamily: oswald, fontSize: 48, color: alert ? P.bright : P.cream, lineHeight: 1, margin: '8px 0 6px' }}>{value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{hint}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: hover ? tone : P.mute, transition: 'all 0.15s' }}>{hover ? '→' : '›'}</span>
      </div>
    </button>
  );
}

// Compact standing-count chip.
function StatChip({ value, label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', cursor: 'pointer', flex: '1 1 140px',
        background: hover ? P.navy : 'transparent',
        border: `1px solid ${hover ? P.gold : P.hair}`,
        padding: '10px 14px', transition: 'all 0.15s',
      }}
    >
      <div style={{ fontFamily: oswald, fontSize: 26, color: P.cream, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.15em', marginTop: 4 }}>{label}</div>
    </button>
  );
}

export default function OverviewPanel({ adminId, goto }) {
  const [stats, setStats] = useState(null);
  const now = useClock();

  useEffect(() => {
    (async () => {
      const [openPolls, events, people, photos, pendingEmail, consentTotal, consentCollected, consentPending] = await Promise.all([
        safeCount('polls', (q) => q.eq('status', 'open')),
        safeCount('upcoming_events'),
        safeCount('personnel'),
        safeCount('photos'),
        safeCount('email_messages', (q) => q.eq('status', 'pending_signature')),
        safeCount('cadet_consent'),
        safeCount('cadet_consent', (q) => q.eq('consent_status', 'collected')),
        safeCount('cadet_consent', (q) => q.eq('consent_status', 'pending')),
      ]);
      setStats({ openPolls, events, people, photos, pendingEmail, consentTotal, consentCollected, consentPending });
    })();
  }, []);

  const fmt = (v) => (v === null || v === undefined ? '—' : v);

  if (!stats) {
    return <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 60 }}>LOADING…</div>;
  }

  const hour = now.getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const consentPct = stats.consentTotal ? Math.round((stats.consentCollected / stats.consentTotal) * 100) : 0;

  const actions = [
    { value: fmt(stats.pendingEmail), label: 'EMAILS AWAITING SIGNATURE', hint: 'Printed · pending SAI/1SG signature', tone: P.red,   to: 'email',  alert: stats.pendingEmail > 0 },
    { value: fmt(stats.openPolls),    label: 'OPEN PHOTO POLLS',           hint: 'Raider voting live now',              tone: P.gold,  to: 'photos', alert: stats.openPolls > 0 },
    { value: fmt(stats.consentPending), label: 'CONSENT FORMS PENDING',    hint: 'Cadets without photo consent',        tone: P.blue,  to: 'people', alert: stats.consentPending > 0 },
  ];

  // Sort alerts first so the front door leads with what's actionable.
  const orderedActions = [...actions].sort((a, b) => Number(b.alert) - Number(a.alert));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* header band */}
      <div style={{
        background: `linear-gradient(135deg, ${P.navy} 0%, ${P.deep} 70%)`,
        border: `1px solid ${P.hair}`, padding: '18px 22px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.3em' }}>{greeting} · {adminId}</div>
          <div style={{ fontFamily: oswald, fontSize: 30, color: P.cream, letterSpacing: '0.06em', lineHeight: 1.1, marginTop: 4 }}>NET CONTROL</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: oswald, fontSize: 24, color: P.bright, lineHeight: 1 }}>{timeStr}</div>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.15em', marginTop: 4 }}>{dateStr}</div>
        </div>
      </div>

      {/* priority actions */}
      <div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.25em', marginBottom: 8 }}>NEEDS ATTENTION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {orderedActions.map((a) => (
            <ActionCard key={a.label} value={a.value} label={a.label} hint={a.hint} tone={a.tone} alert={a.alert} onClick={() => goto?.(a.to)} />
          ))}
        </div>
      </div>

      {/* consent progress */}
      <button
        onClick={() => goto?.('people')}
        style={{
          textAlign: 'left', cursor: 'pointer', background: P.navy,
          border: `1px solid ${P.hair}`, padding: '16px 20px', transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.gold; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.hair; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em' }}>PHOTO CONSENT · CADET DATABASE</div>
          <div style={{ fontFamily: oswald, fontSize: 22, color: P.cream }}>
            {fmt(stats.consentCollected)} <span style={{ fontSize: 13, color: P.mute }}>/ {fmt(stats.consentTotal)}</span>
            <span style={{ fontSize: 15, color: P.gold, marginLeft: 8 }}>{stats.consentTotal ? `${consentPct}%` : ''}</span>
          </div>
        </div>
        <div style={{ height: 10, background: P.deep, border: `1px solid ${P.hair}`, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${consentPct}%`, background: `linear-gradient(90deg, ${P.gold}, ${P.bright})`, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, marginTop: 8, letterSpacing: '0.1em' }}>
          {stats.consentTotal ? `${stats.consentPending} pending · click to work the roster →` : 'roster not imported yet · click to set up →'}
        </div>
      </button>

      {/* standing counts */}
      <div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.25em', marginBottom: 8 }}>STANDING COUNTS</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatChip value={fmt(stats.events)} label="UPCOMING EVENTS" onClick={() => goto?.('events')} />
          <StatChip value={fmt(stats.people)} label="PEOPLE ON ROSTER" onClick={() => goto?.('people')} />
          <StatChip value={fmt(stats.photos)} label="PHOTOS STORED" onClick={() => goto?.('photos')} />
        </div>
      </div>
    </div>
  );
}
