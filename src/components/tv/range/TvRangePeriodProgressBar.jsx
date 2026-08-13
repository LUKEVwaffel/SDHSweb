import { P, mono, fs, sp, radius, ease } from '../../admin/theme.js';
import { toMinutes, formatHHMM, nyMillisOfDay, formatCountdownClock } from '../../../lib/bellSchedules.js';

// Item 4: visual elapsed/remaining bar for the current period, replacing the
// bare "time until next class" number on Planning/Staff. transform: scaleX
// (not width) so the tick-driven redraw stays compositor-friendly — same
// animation-only-properties convention as the weather icons. Uses
// millisecond-precise math (nyMillisOfDay), not whole-minute, so both the
// fill and the "X LEFT" readout show real seconds.
export default function TvRangePeriodProgressBar({ period, now, label = 'PERIOD PROGRESS' }) {
  if (!period || !now) return null;

  const startMs = toMinutes(period.start) * 60000;
  const endMs = toMinutes(period.end) * 60000;
  const span = endMs - startMs;
  const nowMs = nyMillisOfDay(now);
  const pct = Math.min(1, Math.max(0, (nowMs - startMs) / span));
  const remainingMs = Math.max(0, endMs - nowMs);

  return (
    <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: sp[3] }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute, letterSpacing: '0.1em' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.gold, letterSpacing: '0.1em' }}>
          {formatCountdownClock(remainingMs)} LEFT
        </span>
      </div>

      <div style={{ position: 'relative', height: 14, borderRadius: radius.pill, background: P.hair, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, ${P.gold}, ${P.bright})`,
          borderRadius: radius.pill,
          transform: `scaleX(${pct})`, transformOrigin: 'left',
          transition: `transform 800ms ${ease}`,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint }}>{formatHHMM(period.start)}</span>
        <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint }}>{formatHHMM(period.end)}</span>
      </div>
    </div>
  );
}
