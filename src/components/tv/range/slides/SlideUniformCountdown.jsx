import { P, mono, fraunces, inter, fs, sp } from '../../../admin/theme.js';
import { useTvNextUniformDay } from '../../../../hooks/useTvNextUniformDay.js';
import { useTvUpcomingEvents } from '../../../../hooks/useTvUpcomingEvents.js';

function uniformDateLabel(event) {
  const d = new Date(`${event.date}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(d);
}

function targetDate(event) {
  return new Date(`${event.date}T${event.event_time || '00:00:00'}`);
}

function Segment({ value, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{
        fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(56px, 11vh, 140px)',
        color: P.cream, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{ fontFamily: mono, fontSize: 'clamp(11px, 1.6vh, 16px)', color: P.gold, letterSpacing: '0.24em', marginTop: sp[2] }}>
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span style={{ fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(40px, 8vh, 96px)', color: P.hairStrong }}>:</span>
  );
}

// Two things staff wants cadets seeing when nothing else is running: what to
// wear next, and how long until the thing everyone's counting down to.
// `config.countdownEventId` picks which upcoming event drives the second
// half — null falls back to whatever's soonest, so this never sits blank
// just because nobody's picked an event yet (see StepRangeSlideshow.jsx).
export default function SlideUniformCountdown({ config }) {
  const { event: uniformDay } = useTvNextUniformDay();
  const upcoming = useTvUpcomingEvents(20);
  const countdownEvent = config?.countdownEventId
    ? upcoming.find((e) => e.id === config.countdownEventId) ?? null
    : upcoming[0] ?? null;

  const diffMs = countdownEvent ? targetDate(countdownEvent) - Date.now() : null;
  const showCountdown = countdownEvent && diffMs > 0;
  const days = showCountdown ? Math.floor(diffMs / 86400000) : 0;
  const hours = showCountdown ? Math.floor((diffMs % 86400000) / 3600000) : 0;
  const minutes = showCountdown ? Math.floor((diffMs % 3600000) / 60000) : 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: sp[12], textAlign: 'center', gap: sp[12], boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[4] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <div style={{ width: 28, height: 2, background: P.gold }} />
          <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>NEXT UNIFORM DAY</span>
          <div style={{ width: 28, height: 2, background: P.gold }} />
        </div>
        <div style={{ fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.cream, fontSize: 'clamp(40px, 7vh, 96px)', lineHeight: 1.05 }}>
          {uniformDay ? uniformDateLabel(uniformDay) : 'Nothing scheduled.'}
        </div>
        {uniformDay?.title && (
          <div style={{ fontFamily: inter, fontSize: fs.lg, color: P.mute }}>{uniformDay.title}</div>
        )}
      </div>

      {showCountdown && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[5] }}>
          <div style={{ fontFamily: inter, fontSize: fs.xl, fontWeight: 700, color: P.bright }}>{countdownEvent.title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: sp[6] }}>
            <Segment value={days} label="DAYS" />
            <Colon />
            <Segment value={String(hours).padStart(2, '0')} label="HRS" />
            <Colon />
            <Segment value={String(minutes).padStart(2, '0')} label="MIN" />
          </div>
        </div>
      )}
    </div>
  );
}
