// Bell schedule data for the /tv kiosk. All times are wall-clock
// America/New_York (Chattanooga/Soddy-Daisy/Hamilton County is Eastern,
// despite most of TN being Central).
//
// Only top-level `periods` entries count as "bells" for the main countdown.
// 4th period's nested `lunches` are secondary/informational — the kiosk is
// broadcasting to the whole lobby, not one student's lunch shift, so the
// headline countdown shouldn't fixate on whichever lunch is next.
export const BELL_SCHEDULES = {
  normal: {
    label: 'Normal',
    periods: [
      { name: '1st Period', start: '07:15', end: '08:20' },
      { name: '2nd Period', start: '08:25', end: '09:25' },
      { name: '3rd Period', start: '09:30', end: '10:30' },
      {
        name: '4th Period', start: '10:35', end: '12:05',
        lunches: [
          { name: '1st Lunch', start: '10:35', end: '11:05' },
          { name: '2nd Lunch', start: '11:05', end: '11:35' },
          { name: '3rd Lunch', start: '11:35', end: '12:05' },
        ],
      },
      { name: '5th Period', start: '12:10', end: '13:10' },
      { name: '6th Period', start: '13:15', end: '14:15' },
    ],
  },
  t2: {
    label: 'T2',
    periods: [
      { name: '1st Period', start: '07:15', end: '08:10' },
      { name: '2nd Period', start: '08:15', end: '09:10' },
      { name: 'T2 Block', start: '09:10', end: '09:40' },
      { name: '3rd Period', start: '09:45', end: '10:40' },
      {
        name: '4th Period', start: '10:45', end: '12:15',
        lunches: [
          { name: '1st Lunch', start: '10:45', end: '11:15' },
          { name: '2nd Lunch', start: '11:15', end: '11:45' },
          { name: '3rd Lunch', start: '11:45', end: '12:15' },
        ],
      },
      { name: '5th Period', start: '12:20', end: '13:15' },
      { name: '6th Period', start: '13:20', end: '14:15' },
    ],
  },
};

const NY_TZ = 'America/New_York';

/** "HH:MM" (24h, schedule wall-clock time) -> "8:25 AM". */
export function formatHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "HH:MM" (schedule wall-clock time) -> minutes since midnight. */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Current minutes-since-midnight for `now`, read in America/New_York. */
export function nyMinutesOfDay(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find(p => p.type === 'hour').value);
  const m = Number(parts.find(p => p.type === 'minute').value);
  return h * 60 + m;
}

/**
 * @param {'normal'|'t2'} scheduleKey
 * @param {Date} now
 * @returns {{ done: true } | { done: false, current: object|null, next: object, minutesUntil: number, activeLunches: object[]|null }}
 */
export function nextBell(scheduleKey, now) {
  const schedule = BELL_SCHEDULES[scheduleKey];
  if (!schedule) return { done: true };

  const nowMin = nyMinutesOfDay(now);
  const periods = schedule.periods;
  const last = periods[periods.length - 1];

  if (nowMin >= toMinutes(last.end)) return { done: true };

  for (const period of periods) {
    const startMin = toMinutes(period.start);
    const endMin = toMinutes(period.end);

    if (nowMin < startMin) {
      return {
        done: false,
        current: null,
        next: period,
        minutesUntil: startMin - nowMin,
        activeLunches: null,
      };
    }

    if (nowMin >= startMin && nowMin < endMin) {
      return {
        done: false,
        current: period,
        next: period,
        minutesUntil: endMin - nowMin,
        activeLunches: period.lunches ?? null,
      };
    }
  }

  return { done: true };
}

/** "95" -> "1h 35m", "8" -> "8m". Shared by every countdown display. */
export function formatMinutesUntil(minutesUntil) {
  const h = Math.floor(minutesUntil / 60);
  const m = minutesUntil % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Millisecond-precise "now" within the NY wall-clock day — nyMinutesOfDay()
 * truncates to whole minutes (Intl only exposes hour/minute), so the
 * sub-minute part is read straight off `now` itself. Safe regardless of the
 * browser's local timezone: America/New_York's UTC offset is always a whole
 * number of hours, so seconds/ms never shift between UTC and NY wall-clock
 * time — only the hour/minute component needs the Intl round-trip.
 */
export function nyMillisOfDay(now) {
  return nyMinutesOfDay(now) * 60000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
}

/** Precise ms remaining until "HH:MM" (today, NY wall clock), from `now`. */
export function msUntilHHMM(hhmm, now) {
  return toMinutes(hhmm) * 60000 - nyMillisOfDay(now);
}

/** ms -> "7:42" (< 1hr) or "1:07:42" (>= 1hr) — countdown clock, seconds always shown. */
export function formatCountdownClock(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Whole-instructional-day progress, first period's start to last period's end.
 * Deliberately does NOT reset per-period — it's meant to read as one continuous
 * bar with tick marks at period boundaries, not a countdown that restarts.
 * @param {'normal'|'t2'} scheduleKey
 * @param {Date} now
 * @returns {{ state: 'before'|'during'|'after', pct: number, ticks: number[] } | null}
 */
export function dayProgress(scheduleKey, now) {
  const schedule = BELL_SCHEDULES[scheduleKey];
  if (!schedule) return null;

  const periods = schedule.periods;
  const dayStartMin = toMinutes(periods[0].start);
  const dayEndMin = toMinutes(periods[periods.length - 1].end);
  const span = dayEndMin - dayStartMin;
  const nowMin = nyMinutesOfDay(now);

  // Tick per period boundary (period starts after the first, which is pct 0 already).
  const ticks = periods.slice(1).map((p) => ((toMinutes(p.start) - dayStartMin) / span) * 100);

  if (nowMin <= dayStartMin) return { state: 'before', pct: 0, ticks };
  if (nowMin >= dayEndMin) return { state: 'after', pct: 100, ticks };
  return { state: 'during', pct: ((nowMin - dayStartMin) / span) * 100, ticks };
}
