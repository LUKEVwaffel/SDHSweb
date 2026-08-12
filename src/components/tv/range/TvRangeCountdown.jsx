import { P, mono, fraunces, inter, fs, sp } from '../../admin/theme.js';
import { formatMinutesUntil } from '../../../lib/bellSchedules.js';

// Shared countdown readout across Range screens — "next bell" on Planning/T2,
// "lunch ends in" on the Lunch screen. Generic on purpose: takes a kicker
// label + raw minutes rather than a bell object, so it isn't tied to
// nextBell()'s specific shape.
export default function TvRangeCountdown({ kicker = 'NEXT BELL IN', minutesUntil, sub }) {
  if (minutesUntil == null) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[2] }}>
      <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute, letterSpacing: '0.1em' }}>
        {kicker}
      </div>
      <div style={{
        fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', color: P.bright,
        fontSize: 'clamp(40px, 8vh, 96px)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>
        {formatMinutesUntil(minutesUntil)}
      </div>
      {sub && (
        <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream }}>
          {sub}
        </div>
      )}
    </div>
  );
}
