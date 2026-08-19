// Temporary "new bell schedule" callout for Range's welcome and planning
// screens — pulled automatically after END_DATE so nobody has to remember to
// go delete it once cadets are used to the new times.
const NY_TZ = 'America/New_York';
const END_DATE = '2026-08-22'; // shows through 2026-08-21 NY, hidden from this date on

export const NEW_SCHEDULE_MESSAGE = 'New bell schedule in effect';

/** @param {Date} now */
export function isNewScheduleAnnouncementActive(now) {
  const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(now);
  return nyDate < END_DATE;
}
