import { P, mono, fraunces, inter, fs, sp, radius } from '../../admin/theme.js';
import { BELL_SCHEDULES, formatHHMM, formatMinutesUntil } from '../../../lib/bellSchedules.js';

// Fullscreen glanceable "rest of today's bells" for the whole 3rd period —
// no company/welcome pattern here per spec, just the schedule itself. Built
// straight from BELL_SCHEDULES, no new data source.
export default function TvRangeStaffScheduleScreen({ scheduleKey, bell }) {
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

      {bell && !bell.done && (
        <div style={{ fontFamily: inter, fontSize: fs.md, color: P.mute, marginBottom: sp[8] }}>
          Next bell in <span style={{ color: P.bright }}>{formatMinutesUntil(bell.minutesUntil)}</span>
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
