import { formatHHMM } from '../../../lib/bellSchedules.js';
import { P, mono, fraunces, fs, sp } from '../../admin/theme.js';
import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangeCountdown from './TvRangeCountdown.jsx';

// 2026-09-11 only: 9/11 tribute banner on the "Good morning" screen.
function NeverForgetBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: sp[3],
      padding: `${sp[2]}px ${sp[5]}px`, border: `1px solid ${P.hairStrong}`,
      borderRadius: 999, background: 'rgba(192,57,43,0.08)',
    }}>
      <span style={{ fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.cream, fontSize: fs.xl }}>
        Never Forget
      </span>
      <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.gold, letterSpacing: '0.18em' }}>9.11.2001</span>
    </div>
  );
}

// Item 2: inside the last 15 minutes before 1st period, the static "good
// morning" screen becomes a live countdown to the first bell — derived from
// bell.minutesUntil (itself derived from BELL_SCHEDULES' 1st-period start),
// not a hardcoded 7:00 literal, so it stays correct if the bell schedule ever
// changes.
const FIRST_BELL_COUNTDOWN_WINDOW = 15;

// Dedicated fallback for outside the school day (before 1st period, after
// 6th period, or any other time the engine can't place in a period) — not a
// reuse of the Outside rotation, per product decision.
export default function TvRangeOffHoursScreen({ stage, bell, now }) {
  if (stage === 'before') {
    const inCountdownWindow = bell && !bell.done && bell.minutesUntil <= FIRST_BELL_COUNTDOWN_WINDOW;
    return (
      <TvRangeScreenBase
        kicker="BEFORE SCHOOL"
        title="Good morning, Range."
        sub={!inCountdownWindow && bell?.next ? `1st Period starts at ${formatHHMM(bell.next.start)}.` : null}
      >
        {inCountdownWindow && <TvRangeCountdown kicker="1ST PERIOD STARTS IN" target={bell.next.start} now={now} />}
        <NeverForgetBanner />
      </TvRangeScreenBase>
    );
  }

  return (
    <TvRangeScreenBase
      kicker="SCHOOL DAY COMPLETE"
      title="See you tomorrow."
    />
  );
}
