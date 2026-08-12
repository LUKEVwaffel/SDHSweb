import { P, mono, fraunces, inter, fs, sp } from '../../admin/theme.js';
import { formatMinutesUntil } from '../../../lib/bellSchedules.js';

// Shared "next bell" countdown readout for Range's Planning and T2 screens —
// same data shape nextBell() already returns (bell.next, bell.minutesUntil).
export default function TvRangeCountdown({ bell }) {
  if (!bell || bell.done) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[2] }}>
      <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute, letterSpacing: '0.1em' }}>
        NEXT BELL IN
      </div>
      <div style={{
        fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', color: P.bright,
        fontSize: 'clamp(40px, 8vh, 96px)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>
        {formatMinutesUntil(bell.minutesUntil)}
      </div>
      <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream }}>
        {bell.next.name}
      </div>
    </div>
  );
}
