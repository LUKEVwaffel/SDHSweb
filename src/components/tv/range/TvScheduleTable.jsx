import { P, mono, inter, fs, sp, radius } from '../../admin/theme.js';
import { BELL_SCHEDULES, formatHHMM } from '../../../lib/bellSchedules.js';

// Renders the actual bell times for `scheduleKey` — not just "schedule
// changed" text — so a cadet reading the welcome/planning screen during the
// rollout window sees exactly what moved. Periods on top, lunches broken out
// on their own row underneath since those are the times that actually
// changed (see bellSchedules.js — periods themselves are unchanged, lunches
// picked up 5min gaps between them).
export default function TvScheduleTable({ scheduleKey }) {
  const schedule = BELL_SCHEDULES[scheduleKey] ?? BELL_SCHEDULES.normal;
  const lunches = schedule.periods.flatMap((p) => p.lunches ?? []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3], alignItems: 'center', maxWidth: '85vw' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[2] }}>
        {schedule.periods.map((period) => (
          <ScheduleChip key={period.name} name={period.name} start={period.start} end={period.end} />
        ))}
      </div>

      {lunches.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[2] }}>
          {lunches.map((lunch) => (
            <ScheduleChip key={lunch.name} name={lunch.name} start={lunch.start} end={lunch.end} highlight />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleChip({ name, start, end, highlight }) {
  return (
    <div style={{
      padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.md,
      border: `1px solid ${highlight ? P.gold : P.hair}`,
      background: highlight ? P.goldWash : 'transparent',
      fontFamily: inter, fontSize: fs.sm, color: P.cream, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.08em', marginRight: sp[2] }}>
        {name.toUpperCase()}
      </span>
      {formatHHMM(start)}–{formatHHMM(end)}
    </div>
  );
}
