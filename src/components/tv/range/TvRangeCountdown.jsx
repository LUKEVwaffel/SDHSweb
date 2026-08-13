import { P, mono, fraunces, inter, fs, sp } from '../../admin/theme.js';
import { msUntilHHMM, formatCountdownClock } from '../../../lib/bellSchedules.js';

// Shared countdown readout across Range screens — "next bell" on T2, "lunch
// ends in", the last-5-min warning, the pre-7am countdown. Takes a wall-clock
// `target` ("HH:MM") + the live `now` tick rather than a pre-truncated
// minutes-until number, so it can show real seconds instead of just minutes —
// nextBell()/getRangePhase() only resolve to whole-minute precision.
export default function TvRangeCountdown({ kicker = 'NEXT BELL IN', target, now, sub }) {
  if (!target || !now) return null;
  const ms = msUntilHHMM(target, now);
  if (ms <= 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[2] }}>
      <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute, letterSpacing: '0.1em' }}>
        {kicker}
      </div>
      <div style={{
        fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', color: P.bright,
        fontSize: 'clamp(40px, 8vh, 96px)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>
        {formatCountdownClock(ms)}
      </div>
      {sub && (
        <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream }}>
          {sub}
        </div>
      )}
    </div>
  );
}
