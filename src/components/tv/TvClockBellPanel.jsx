import { P, mono, oswald, inter, fs, sp, radius, shadow } from '../admin/theme.js';
import { useNowTicker } from '../../hooks/useNowTicker.js';
import { nextBell, BELL_SCHEDULES } from '../../lib/bellSchedules.js';

const NY_TZ = 'America/New_York';

function formatClock(now) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(now);
}

function formatDate(now) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ, weekday: 'long', month: 'long', day: 'numeric',
  }).format(now);
}

function formatHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatCountdown(minutesUntil) {
  const h = Math.floor(minutesUntil / 60);
  const m = minutesUntil % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function TvClockBellPanel({ scheduleKey }) {
  const now = useNowTicker();
  const clock = formatClock(now);
  const [time, meridiem] = clock.split(' ');

  const scheduleLabel = scheduleKey ? BELL_SCHEDULES[scheduleKey]?.label : null;
  const bell = scheduleKey ? nextBell(scheduleKey, now) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[5] }}>
      <div>
        <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, marginBottom: sp[1] }}>
          {formatDate(now)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: sp[2] }}>
          <span style={{
            fontFamily: mono, fontSize: 58, fontWeight: 600, color: P.cream,
            letterSpacing: '0.01em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {time}
          </span>
          <span style={{ fontFamily: mono, fontSize: fs.lg, color: P.gold, letterSpacing: '0.08em' }}>
            {meridiem}
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: P.hair }} />

      {!scheduleKey ? (
        <div style={{ fontFamily: inter, fontSize: fs.base, color: P.mute }}>
          Schedule not set for today.
        </div>
      ) : bell.done ? (
        <div>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
            {scheduleLabel?.toUpperCase()} SCHEDULE
          </div>
          <div style={{ fontFamily: oswald, fontSize: fs.lg, color: P.cream }}>
            School day complete
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
            {scheduleLabel?.toUpperCase()} SCHEDULE
          </div>
          <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, marginBottom: 2 }}>
            {bell.current ? 'Next bell in' : `${bell.next.name} starts in`}
          </div>
          <div style={{
            fontFamily: oswald, fontSize: fs.display, fontWeight: 600, color: P.cream,
            lineHeight: 1.05, fontVariantNumeric: 'tabular-nums',
          }}>
            {formatCountdown(bell.minutesUntil)}
          </div>
          <div style={{ fontFamily: inter, fontSize: fs.base, color: P.bright, marginTop: sp[1] }}>
            {bell.current ? `${bell.current.name} in session` : bell.next.name}
          </div>
          {bell.activeLunches && (
            <div style={{
              marginTop: sp[3], padding: `${sp[2]}px ${sp[3]}px`, background: P.goldWash,
              border: `1px solid ${P.hair}`, borderRadius: radius.sm, boxShadow: shadow.sm,
              fontFamily: inter, fontSize: fs.xs, color: P.mute, lineHeight: 1.6,
            }}>
              Lunch rotations: {bell.activeLunches.map((l) => `${l.name} ${formatHHMM(l.start)}`).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
