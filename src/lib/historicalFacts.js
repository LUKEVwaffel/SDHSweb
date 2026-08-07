import onThisDay from '../data/onThisDay.json';

const NY_TZ = 'America/New_York';

/** "MM-DD" key for `now`, read in America/New_York (matches how the JSON was keyed at build time). */
export function todayKey(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ, month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const mm = parts.find(p => p.type === 'month').value;
  const dd = parts.find(p => p.type === 'day').value;
  return `${mm}-${dd}`;
}

/** @returns {{year: number, text: string}[]} facts for today, or [] if none bundled. */
export function todaysFacts(now) {
  return onThisDay[todayKey(now)] ?? [];
}
