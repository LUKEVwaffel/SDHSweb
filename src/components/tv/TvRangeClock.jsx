import { P, mono, fs, sp, radius } from '../admin/theme.js';

// Range shows countdowns (time remaining) everywhere but never actual
// time-of-day — Outside has that via TvClockBellPanel, Range didn't. Mounted
// once in TvRangeKiosk.jsx above the phase switch so it persists across all
// 8 phase screens without touching each one. Bottom-right corner: the
// countdown band (TvCountdownBand) owns the top, TvRangeCountdown/
// TvRangePeriodProgressBar render centered within their own phase screens —
// this stays clear of both.
export default function TvRangeClock({ now }) {
  if (!now) return null;

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  }).format(now);

  return (
    <div style={{
      position: 'fixed', bottom: sp[4], right: sp[4], zIndex: 50,
      padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.pill,
      background: 'rgba(6,16,31,0.72)', border: `1px solid ${P.hairStrong}`,
      backdropFilter: 'blur(6px)',
      fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.08em',
      fontVariantNumeric: 'tabular-nums', pointerEvents: 'none',
    }}>
      {time}
    </div>
  );
}
