import { P, mono, inter, sp, ease } from '../admin/theme.js';
import { useBattalionCreed } from '../../hooks/useBattalionCreed.js';
import { useTvUpcomingEvents } from '../../hooks/useTvUpcomingEvents.js';
import { dayProgress } from '../../lib/bellSchedules.js';
import { getTeam } from '../../lib/teams.js';

const NY_TZ = 'America/New_York';

function daysUntil(dateStr, now) {
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(now);
  const start = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target - start) / 86400000);
}

function eventChipLabel(ev, now) {
  const d = daysUntil(ev.date, now);
  const when = d === 0 ? 'TODAY' : d === 1 ? 'TOMORROW' : `IN ${d}D`;
  const teamTag = ev.team ? getTeam(ev.team)?.label : null;
  return `${when} · ${ev.title}${teamTag ? ` (${teamTag})` : ''}`;
}

/**
 * Full-width instrument strip above the carousel/panel grid. Row one: the
 * battalion creed and a whole-day progress bar that reads as one continuous
 * line from first bell to last (tick marks at period boundaries, never
 * resets). Row two: an "upcoming" ticker — the nearest posted events with a
 * countdown on the first one — hidden entirely when nothing's scheduled so a
 * dead week doesn't leave an empty bar sitting there.
 */
export default function TvTopStrip({ scheduleKey, now }) {
  const creed = useBattalionCreed();
  const progress = scheduleKey ? dayProgress(scheduleKey, now) : null;
  const upcoming = useTvUpcomingEvents(4);

  return (
    <div style={{ flexShrink: 0, background: P.deep, borderBottom: `1px solid ${P.hairStrong}` }}>
      <div style={{
        height: 40, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 32, padding: '0 28px',
      }}>
        <div style={{
          fontFamily: mono, fontSize: 11, color: P.gold, opacity: 0.55,
          letterSpacing: '0.12em', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', minWidth: 0, flex: '1 1 auto',
        }}>
          {creed}
        </div>

        {progress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 220, height: 4, borderRadius: 999, background: P.hair }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 999,
                width: `${progress.pct}%`,
                background: `linear-gradient(90deg, ${P.gold}, ${P.bright})`,
                transition: `width 800ms ${ease}`,
              }} />
              {progress.ticks.map((pct, i) => (
                <div key={i} style={{
                  position: 'absolute', top: 0, bottom: 0, left: `${pct}%`,
                  width: 1, background: 'rgba(6,16,31,0.5)',
                }} />
              ))}
            </div>
            <span style={{ fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.06em', width: 30 }}>
              {Math.round(progress.pct)}%
            </span>
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div style={{
          height: 30, display: 'flex', alignItems: 'center', gap: sp[4],
          padding: '0 28px', borderTop: `1px solid ${P.hair}`,
        }}>
          <span style={{ fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.2em', flexShrink: 0 }}>
            UPCOMING
          </span>
          <div style={{ display: 'flex', gap: sp[5], overflow: 'hidden' }}>
            {upcoming.map((ev, i) => (
              <span
                key={ev.id}
                style={{
                  fontFamily: inter, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis', maxWidth: 280,
                  color: i === 0 ? P.bright : P.mute,
                  fontWeight: i === 0 ? 600 : 400,
                }}
              >
                {eventChipLabel(ev, now)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
