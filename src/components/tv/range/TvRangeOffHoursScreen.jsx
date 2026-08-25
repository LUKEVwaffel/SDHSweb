import { formatHHMM } from '../../../lib/bellSchedules.js';
import { sp } from '../../admin/theme.js';
import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangeCountdown from './TvRangeCountdown.jsx';

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
      </TvRangeScreenBase>
    );
  }

  return (
    <TvRangeScreenBase
      kicker="IN MEMORY"
      title="RIP Dolly Parton"
      sub="Zoe McCollum loved her music."
    >
      <div style={{ display: 'flex', gap: sp[8], alignItems: 'center', justifyContent: 'center' }}>
        <img
          src="https://tpracdgjahzmqtzjsiol.supabase.co/storage/v1/object/public/cadet-photos/c2d84ef7-067c-4240-80cf-dfdd7859f601.jpg"
          alt="Zoe McCollum"
          style={{ height: '42vh', width: 'auto', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 12 }}
        />
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/3/3a/Dolly_Parton_in_Nashville_2.jpg"
          alt="Dolly Parton"
          style={{ height: '42vh', width: 'auto', borderRadius: 12, objectFit: 'cover' }}
        />
      </div>
    </TvRangeScreenBase>
  );
}
