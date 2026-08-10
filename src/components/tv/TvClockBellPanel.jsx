import { P, mono, fraunces, inter, fs, sp, radius, shadow, ease } from '../admin/theme.js';
import { useNowTicker } from '../../hooks/useNowTicker.js';
import { nextBell, BELL_SCHEDULES } from '../../lib/bellSchedules.js';

const NY_TZ = 'America/New_York';
const URGENT_MIN = 5;
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

function PanelStyles() {
  return (
    <style>{`
      @keyframes tvColonBlink { 0%, 45% { opacity: 1; } 50%, 95% { opacity: 0.15; } 100% { opacity: 1; } }
      @keyframes tvUrgentPulse {
        0%, 100% { filter: drop-shadow(0 0 0px rgba(232,199,122,0)); }
        50% { filter: drop-shadow(0 0 10px rgba(232,199,122,0.65)); }
      }
      @keyframes tvDotPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.6); opacity: 0.35; }
      }
      .tv-colon { animation: tvColonBlink 2s steps(1) infinite; }
      .tv-ring-urgent { animation: tvUrgentPulse 1.6s ease-in-out infinite; }
      .tv-live-dot { animation: tvDotPulse 1.8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .tv-colon, .tv-ring-urgent, .tv-live-dot { animation: none; }
      }
    `}</style>
  );
}

function timeParts(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return { h: get('hour'), m: get('minute'), s: get('second'), period: get('dayPeriod').toUpperCase() };
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

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatCountdown(minutesUntil) {
  const h = Math.floor(minutesUntil / 60);
  const m = minutesUntil % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Fraction of the *current* period already elapsed — the ring reads as a dial
// filling toward the next bell, not a generic countdown, when a period is
// actually in session. There's no "elapsed" concept before the school day
// starts, so it stays unrendered (a plain pulsing dot instead) for that case.
function elapsedFraction(bell) {
  if (!bell?.current) return null;
  const total = toMinutes(bell.current.end) - toMinutes(bell.current.start);
  if (total <= 0) return null;
  const elapsed = total - bell.minutesUntil;
  return Math.min(1, Math.max(0, elapsed / total));
}

function BellRing({ fraction, urgent }) {
  if (fraction == null) {
    return (
      <div style={{ width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div className="tv-live-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: P.gold }} />
      </div>
    );
  }
  const offset = RING_C * (1 - fraction);
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className={urgent ? 'tv-ring-urgent' : ''} style={{ flexShrink: 0 }}>
      <circle cx="34" cy="34" r={RING_R} fill="none" stroke={P.hair} strokeWidth="4" />
      <circle
        cx="34" cy="34" r={RING_R} fill="none" stroke={urgent ? P.bright : P.gold} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={offset}
        transform="rotate(-90 34 34)" style={{ transition: `stroke-dashoffset 900ms ${ease}` }}
      />
    </svg>
  );
}

export default function TvClockBellPanel({ scheduleKey }) {
  const now = useNowTicker();
  const { h, m, s, period } = timeParts(now);

  const scheduleLabel = scheduleKey ? BELL_SCHEDULES[scheduleKey]?.label : null;
  const bell = scheduleKey ? nextBell(scheduleKey, now) : null;
  const fraction = bell && !bell.done ? elapsedFraction(bell) : null;
  const urgent = bell && !bell.done && bell.minutesUntil <= URGENT_MIN;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[4] }}>
      <PanelStyles />

      <div>
        <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, marginBottom: sp[2], letterSpacing: '0.01em' }}>
          {formatDate(now)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{
            fontFamily: fraunces, fontWeight: 800, fontSize: 'clamp(32px, 6.5vh, 66px)', color: P.cream,
            letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {h}
          </span>
          <span className="tv-colon" style={{ fontFamily: fraunces, fontWeight: 800, fontSize: 'clamp(32px, 6.5vh, 66px)', color: P.gold, lineHeight: 1 }}>:</span>
          <span style={{
            fontFamily: fraunces, fontWeight: 800, fontSize: 'clamp(32px, 6.5vh, 66px)', color: P.cream,
            letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {m}
          </span>
          <span style={{
            fontFamily: mono, fontSize: fs.sm, color: P.faint, marginLeft: 6,
            fontVariantNumeric: 'tabular-nums', minWidth: '2ch', display: 'inline-block',
          }}>
            :{s}
          </span>
          <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.1em', marginLeft: sp[2] }}>
            {period}
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: P.hair }} />

      {!scheduleKey ? (
        <div style={{ fontFamily: inter, fontSize: fs.base, color: P.mute }}>
          Schedule not set for today.
        </div>
      ) : bell.done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[4] }}>
          <BellRing fraction={1} urgent={false} />
          <div>
            <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[1] }}>
              {scheduleLabel?.toUpperCase()} SCHEDULE
            </div>
            <div style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, fontSize: fs.xl, color: P.cream }}>
              School day complete
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[4] }}>
          <BellRing fraction={fraction} urgent={urgent} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[1] }}>
              {scheduleLabel?.toUpperCase()} SCHEDULE
            </div>
            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, marginBottom: 2 }}>
              {bell.current ? 'Next bell in' : `${bell.next.name} starts in`}
            </div>
            <div style={{
              fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(26px, 5.5vh, 44px)',
              color: urgent ? P.bright : P.cream, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              {formatCountdown(bell.minutesUntil)}
            </div>
            <div style={{ fontFamily: inter, fontSize: fs.base, color: P.bright, marginTop: sp[1] }}>
              {bell.current ? `${bell.current.name} in session` : bell.next.name}
            </div>
            {bell.activeLunches && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[1], marginTop: sp[3] }}>
                {bell.activeLunches.map((l) => (
                  <span key={l.name} style={{
                    padding: `${sp[1]}px ${sp[2]}px`, background: P.goldWash,
                    border: `1px solid ${P.hair}`, borderRadius: radius.pill, boxShadow: shadow.sm,
                    fontFamily: inter, fontSize: fs.xs, color: P.mute, whiteSpace: 'nowrap',
                  }}>
                    {l.name} <span style={{ color: P.faint }}>{formatHHMM(l.start)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
