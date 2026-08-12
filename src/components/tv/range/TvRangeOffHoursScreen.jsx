import { formatHHMM } from '../../../lib/bellSchedules.js';
import TvRangeScreenBase from './TvRangeScreenBase.jsx';

// Dedicated fallback for outside the school day (before 1st period, after
// 6th period, or any other time the engine can't place in a period) — not a
// reuse of the Outside rotation, per product decision.
export default function TvRangeOffHoursScreen({ stage, bell }) {
  if (stage === 'before') {
    return (
      <TvRangeScreenBase
        kicker="BEFORE SCHOOL"
        title="Good morning, Range."
        sub={bell?.next ? `1st Period starts at ${formatHHMM(bell.next.start)}.` : null}
      />
    );
  }

  return (
    <TvRangeScreenBase
      kicker="SCHOOL DAY COMPLETE"
      title="See you tomorrow."
    />
  );
}
