import { P, mono, fraunces, inter, fs, sp, radius } from '../../admin/theme.js';
import { BELL_SCHEDULES, formatHHMM } from '../../../lib/bellSchedules.js';
import TvRangePeriodProgressBar from './TvRangePeriodProgressBar.jsx';

// Fullscreen glanceable "rest of today's bells" for the whole 3rd period —
// no company/welcome pattern here per spec, just the schedule itself. Built
// straight from BELL_SCHEDULES, no new data source. Item 4: the old bare
// "next bell in X" line is now a progress bar scoped to 3rd period itself
// (bell.current), not the whole day — dayProgress() exists in
// bellSchedules.js for a whole-day bar but that's not what was asked for here.
export default function TvRangeStaffScheduleScreen({ scheduleKey, bell, now }) {
  const schedule = BELL_SCHEDULES[scheduleKey];
  const periods = schedule?.periods ?? [];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: `${sp[12]}px ${sp[10]}px`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[2] }}>
        <div style={{ width: 28, height: 2, background: P.gold }} />
        <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>
          TODAY'S SCHEDULE — {schedule?.label?.toUpperCase()}
        </span>
        <div style={{ width: 28, height: 2, background: P.gold }} />
      </div>

      {bell?.current && (
        <div style={{ marginBottom: sp[8] }}>
          <TvRangePeriodProgressBar period={bell.current} now={now} label="3RD PERIOD" />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3], width: '100%', maxWidth: 820 }}>
        {periods.map((period) => {
          const isCurrent = bell?.current?.name === period.name;
          return (
            <div
              key={period.name}
              style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                padding: `${sp[4]}px ${sp[6]}px`, borderRadius: radius.md,
                border: `1px solid ${isCurrent ? P.gold : P.hair}`,
                background: isCurrent ? P.goldWash : 'transparent',
              }}
            >
              <span style={{
                fontFamily: fraunces, fontWeight: 700, fontStyle: isCurrent ? 'italic' : 'normal',
                fontSize: fs.xl, color: isCurrent ? P.bright : P.cream,
              }}>
                {period.name}
              </span>
              <span style={{ fontFamily: mono, fontSize: fs.base, color: P.mute }}>
                {formatHHMM(period.start)} – {formatHHMM(period.end)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
