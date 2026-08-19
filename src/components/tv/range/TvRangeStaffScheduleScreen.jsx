import { P, mono, inter, fs, sp } from '../../admin/theme.js';
import { BELL_SCHEDULES } from '../../../lib/bellSchedules.js';
import TvRangePeriodProgressBar from './TvRangePeriodProgressBar.jsx';

// Fullscreen glanceable 3rd-period status — just the progress bar (elapsed/
// remaining + time left), no full-day schedule list. Built straight from
// BELL_SCHEDULES, no new data source.
export default function TvRangeStaffScheduleScreen({ scheduleKey, bell, now }) {
  const schedule = BELL_SCHEDULES[scheduleKey];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `${sp[12]}px ${sp[10]}px`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[8] }}>
        <div style={{ width: 28, height: 2, background: P.gold }} />
        <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>
          TODAY'S SCHEDULE — {schedule?.label?.toUpperCase()}
        </span>
        <div style={{ width: 28, height: 2, background: P.gold }} />
      </div>

      {bell?.current && (
        <TvRangePeriodProgressBar period={bell.current} now={now} label="3RD PERIOD" size="lg" />
      )}
    </div>
  );
}
