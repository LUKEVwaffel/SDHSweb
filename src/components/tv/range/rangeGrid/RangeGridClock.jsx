import { P, mono, fraunces, inter, fs, sp, radius, shadow, ease } from '../../../admin/theme.js';
import { useNowTicker } from '../../../../hooks/useNowTicker.js';
import { nextBell, BELL_SCHEDULES, formatMinutesUntil, formatHHMM } from '../../../../lib/bellSchedules.js';

const NY_TZ = 'America/New_York';
const URGENT_MIN = 5;

function RgClockStyles() {
  return (
    <style>{`
      @keyframes rgClockColonBlink { 0%, 45% { opacity: 1; } 50%, 95% { opacity: 0.15; } 100% { opacity: 1; } }
      @keyframes rgClockUrgentPulse {
        0%, 100% { filter: drop-shadow(0 0 0px rgba(232,199,122,0)); }
        50% { filter: drop-shadow(0 0 10px rgba(232,199,122,0.65)); }
      }
      @keyframes rgClockDotPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.6); opacity: 0.35; }
      }
      .rg-clock-colon { animation: rgClockColonBlink 2s steps(1) infinite; }
      .rg-clock-ring-urgent { animation: rgClockUrgentPulse 1.6s ease-in-out infinite; }
      .rg-clock-live-dot { animation: rgClockDotPulse 1.8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .rg-clock-colon, .rg-clock-ring-urgent, .rg-clock-live-dot { animation: none; }
      }
    `}</style>
  );
}

function timeParts(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ, hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return { h: get('hour'), m: get('minute'), period: get('dayPeriod').toUpperCase() };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function elapsedFraction(bell) {
  if (!bell?.current) return null;
  const total = toMinutes(bell.current.end) - toMinutes(bell.current.start);
  if (total <= 0) return null;
  const elapsed = total - bell.minutesUntil;
  return Math.min(1, Math.max(0, elapsed / total));
}

function BellRing({ fraction, urgent }) {
  const R = 26, C = 2 * Math.PI * R;
  const size = 'clamp(38px, 18cqw, 64px)';
  if (fraction == null) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div className="rg-clock-live-dot" style={{ width: '18%', aspectRatio: '1', borderRadius: '50%', background: P.gold }} />
      </div>
    );
  }
  const offset = C * (1 - fraction);
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className={urgent ? 'rg-clock-ring-urgent' : ''} style={{ flexShrink: 0 }}>
      <circle cx="30" cy="30" r={R} fill="none" stroke={P.hair} strokeWidth="4" />
      <circle
        cx="30" cy="30" r={R} fill="none" stroke={urgent ? P.bright : P.gold} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 30 30)" style={{ transition: `stroke-dashoffset 900ms ${ease}` }}
      />
    </svg>
  );
}

// Range-native equivalent of TvClockBellPanel.jsx — same visual language
// (fraunces time, gold ring, bell status) but sized from its own container
// (containerType + cqw) instead of TvClockBellPanel's vh-based clamps, which
// look wrong crammed into a grid tile that's a fraction of the viewport.
// TvClockBellPanel itself is untouched — Outside's kiosk still uses it as-is.
export default function RangeGridClock({ settings }) {
  const now = useNowTicker();
  const scheduleKey = settings?.bell_schedule ?? 'normal';
  const { h, m, period } = timeParts(now);

  const scheduleLabel = BELL_SCHEDULES[scheduleKey]?.label;
  const bell = nextBell(scheduleKey, now);
  const fraction = bell && !bell.done ? elapsedFraction(bell) : null;
  const urgent = bell && !bell.done && bell.minutesUntil <= URGENT_MIN;

  return (
    <div style={{
      height: '100%', width: '100%', containerType: 'inline-size', containerName: 'rgClock',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[2],
    }}>
      <RgClockStyles />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 14, height: 2, background: P.gold }} />
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.28em' }}>LOCAL TIME</div>
        <div style={{ flex: 1, height: 1, background: P.hair }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{
          fontFamily: fraunces, fontWeight: 800, fontSize: 'clamp(26px, 15cqw, 96px)', color: P.cream,
          letterSpacing: '-0.03em', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums',
        }}>
          {h}
        </span>
        <span className="rg-clock-colon" style={{ fontFamily: fraunces, fontWeight: 800, fontSize: 'clamp(26px, 15cqw, 96px)', color: P.gold, lineHeight: 0.95 }}>:</span>
        <span style={{
          fontFamily: fraunces, fontWeight: 800, fontSize: 'clamp(26px, 15cqw, 96px)', color: P.cream,
          letterSpacing: '-0.03em', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums',
        }}>
          {m}
        </span>
        <span style={{ fontFamily: mono, fontSize: 'clamp(10px, 3cqw, 17px)', color: P.gold, letterSpacing: '0.1em', marginLeft: sp[2] }}>
          {period}
        </span>
      </div>

      {bell.done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <BellRing fraction={1} urgent={false} />
          <div style={{ fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, fontSize: fs.md, color: P.cream }}>
            School day complete
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], minWidth: 0 }}>
          <BellRing fraction={fraction} urgent={urgent} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em', marginBottom: 2 }}>
              {scheduleLabel?.toUpperCase()} SCHEDULE
            </div>
            <div style={{
              fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(15px, 5cqw, 26px)',
              color: urgent ? P.bright : P.cream, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums',
            }}>
              {bell.current ? formatMinutesUntil(bell.minutesUntil) : `${bell.next.name} in ${formatMinutesUntil(bell.minutesUntil)}`}
            </div>
            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.bright }}>
              {bell.current ? `${bell.current.name} in session` : ''}
            </div>
            {bell.activeLunches && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[1], marginTop: sp[1] }}>
                {bell.activeLunches.map((l) => (
                  <span key={l.name} style={{
                    padding: `2px ${sp[2]}px`, background: P.goldWash,
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
