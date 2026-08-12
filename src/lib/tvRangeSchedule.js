import { BELL_SCHEDULES, nextBell, toMinutes, nyMinutesOfDay } from './bellSchedules.js';

// Range TV's period-based programming engine. Pure function, no React — same
// shape/contract as nextBell() (built directly on top of it), so it's
// unit-testable with a fixed `now` and composes instead of re-deriving period
// math. `config` is tv_daily_settings.range_schedule_config on the 'range'
// row — every string this engine surfaces is a template from that config,
// editable from TV Remote's Schedule Editor tab, never hardcoded here.
//
// Deliberately does NOT know about weekends/holidays — same limitation
// bellSchedules.js already has (nextBell reasons about wall-clock time only,
// not day-of-week). A Saturday reads as "off-hours" only outside the normal
// 7:15am-2:15pm window, same as any other day; true calendar-awareness would
// need a separate "is there school today" source of truth this codebase
// doesn't have yet.

const PERIOD_NUM_RE = /^(\d+)(?:st|nd|rd|th) Period$/;

function periodNumber(name) {
  const m = PERIOD_NUM_RE.exec(name);
  return m ? Number(m[1]) : null;
}

/** Minutes elapsed since `period` started, as of `now`. */
function elapsedMinutes(period, now) {
  return nyMinutesOfDay(now) - toMinutes(period.start);
}

/** Minutes elapsed since wall-clock `hhmm`, as of `now`. */
function minutesSince(hhmm, now) {
  return nyMinutesOfDay(now) - toMinutes(hhmm);
}

const DEFAULT_WELCOME_WINDOW = 20;

/**
 * @param {'normal'|'t2'} scheduleKey
 * @param {Date} now
 * @param {object|null} config - tv_daily_settings.range_schedule_config
 * @returns {{ phase: string, bell: object|null, [key: string]: any }}
 */
export function getRangePhase(scheduleKey, now, config) {
  const schedule = BELL_SCHEDULES[scheduleKey];
  if (!schedule) return { phase: 'off-hours', stage: null, bell: null };

  const bell = nextBell(scheduleKey, now);

  if (bell.done) return { phase: 'off-hours', stage: 'after', bell };

  if (!bell.current) {
    // No current period. True "before school starts" only when the very
    // NEXT period is the day's first — any other current:null moment is a
    // passing period between two in-session periods, which should keep
    // showing normal rotation, not an off-hours screen.
    const isBeforeSchoolDay = bell.next === schedule.periods[0];
    return isBeforeSchoolDay
      ? { phase: 'off-hours', stage: 'before', bell }
      : { phase: 'rotation', bell };
  }

  const period = bell.current;
  const periodNum = periodNumber(period.name);
  const welcomeWindow = config?.welcome_window_minutes ?? DEFAULT_WELCOME_WINDOW;

  if (periodNum === 1) return { phase: 'planning', bell };
  if (period.name === 'T2 Block') return { phase: 't2', bell };
  if (periodNum === 3) return { phase: 'staff-schedule', bell };

  if (periodNum === 4) {
    const lunch1 = period.lunches?.find((l) => l.name === '1st Lunch');
    if (lunch1) {
      const nowMin = nyMinutesOfDay(now);
      const startMin = toMinutes(lunch1.start);
      const endMin = toMinutes(lunch1.end);

      if (nowMin >= startMin && nowMin < endMin) {
        return { phase: 'lunch1', bell };
      }
      // Bravo's welcome is anchored to lunch END, not to 4th period's start —
      // lunch end differs Normal (11:05) vs T2 (11:15), and reading it
      // straight off this schedule's own lunches array keeps that correct
      // for both without a separate T2-specific branch.
      const sinceLunchEnd = minutesSince(lunch1.end, now);
      if (sinceLunchEnd >= 0 && sinceLunchEnd < welcomeWindow) {
        return { phase: 'company-welcome', company: config?.period_company?.['4'], bell };
      }
    }
    return { phase: 'rotation', bell };
  }

  // 2nd / 5th / 6th — welcome window anchored to period start.
  const company = config?.period_company?.[String(periodNum)];
  if (company && elapsedMinutes(period, now) < welcomeWindow) {
    return { phase: 'company-welcome', company, bell };
  }
  return { phase: 'rotation', bell };
}

/** Fill `{placeholder}` tokens in a range_schedule_config template string. */
export function renderTemplate(template, vars = {}) {
  if (!template) return '';
  return Object.entries(vars).reduce(
    (str, [key, value]) => str.replaceAll(`{${key}}`, value),
    template
  );
}
