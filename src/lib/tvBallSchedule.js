import { BELL_SCHEDULES, nextBell, nyMinutesOfDay, toMinutes } from './bellSchedules.js';

// /balltv's period-based programming engine. Pure function, no React — same
// shape/contract as getRangePhase() (src/lib/tvRangeSchedule.js), built
// directly on nextBell(). `periodCompany` is the same '2'..'6' -> company-name
// map the Range screen's Schedule Editor already writes to
// tv_daily_settings('range').range_schedule_config.period_company — reused
// as-is rather than duplicated, since it's the same companies rotating
// through the same periods. Ball has no settings row of its own; it only
// reads Range's for the bell-schedule override + company map.
//
// Same weekend/holiday limitation as tvRangeSchedule.js: this reasons about
// wall-clock time only, not day-of-week or the calendar.

const PERIOD_NUM_RE = /^(\d+)(?:st|nd|rd|th) Period$/;
const WELCOME_WINDOW_MINUTES = 5;

function periodNumber(name) {
  const m = PERIOD_NUM_RE.exec(name);
  return m ? Number(m[1]) : null;
}

/**
 * @param {'normal'|'t2'} scheduleKey
 * @param {Date} now
 * @param {Record<string,string>} periodCompany - e.g. { '2': 'Alpha', '4': 'Bravo', ... }
 * @returns {{ phase: 'off'|'lunch'|'welcome'|'company'|'rotation', stage?: string, company?: string, bell: object|null }}
 */
export function getBallPhase(scheduleKey, now, periodCompany) {
  const schedule = BELL_SCHEDULES[scheduleKey];
  if (!schedule) return { phase: 'off', stage: null, bell: null };

  const bell = nextBell(scheduleKey, now);

  if (bell.done) return { phase: 'off', stage: 'after', bell };

  if (!bell.current) {
    // No current period: true "before school" only when the next period is
    // the day's first — any other current:null moment is a passing period
    // between two in-session periods, which should keep running the full
    // slideshow, not shut off mid-day.
    const isBeforeSchoolDay = bell.next === schedule.periods[0];
    return isBeforeSchoolDay ? { phase: 'off', stage: 'before', bell } : { phase: 'rotation', bell };
  }

  const period = bell.current;

  // 4th Period covers all three staggered lunches back-to-back — the whole
  // period is "lunch" for this screen's purposes, not just the sub-windows.
  if (period.name === '4th Period') return { phase: 'lunch', bell };

  const periodNum = periodNumber(period.name);
  const company = periodNum != null ? periodCompany?.[String(periodNum)] : null;

  // No company assigned to this block (1st Planning, T2 Block, unmapped
  // periods) — run the full slideshow same as lunch instead of guessing.
  if (!company) return { phase: 'rotation', bell };

  const elapsedMinutes = nyMinutesOfDay(now) - toMinutes(period.start);
  if (elapsedMinutes < WELCOME_WINDOW_MINUTES) return { phase: 'welcome', company, bell };
  return { phase: 'company', company, bell };
}
