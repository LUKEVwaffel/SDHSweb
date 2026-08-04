// Shared calendar vocabulary — the single source for event categories, their
// colors, and the team list. Both the public calendar (Bulletin) and the admin
// EventsPanel read from here so a category/color change happens in one place.

export const EVENT_CATEGORIES = [
  { id: 'FOOTBALL',  color: '#7FA8D6' },
  { id: 'RAIDER',    color: '#7EC87E' },
  { id: 'PRACTICE',  color: '#4E8F52' }, // recurring team practice — dimmer than RAIDER so competitions still pop
  { id: 'RIFLE',     color: '#C9A961' },
  { id: 'DRILL',     color: '#D69B6B' },
  { id: 'ACADEMIC',  color: '#B48FD4' },
  { id: 'JROTC',     color: '#6BC7C0' },
  { id: 'BATTALION', color: '#E8C77A' },
  { id: 'CEREMONY',  color: '#D6889B' },
  { id: 'BREAK',       color: 'rgba(244,236,216,0.55)' },
  { id: 'UNIFORM_DAY', color: '#8FA9C9' },
  { id: 'EVENT',       color: '#C9A961' }, // neutral fallback for untagged rows
];

export const CATEGORY_COLOR = Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.id, c.color]));
export const categoryColor = (cat) => CATEGORY_COLOR[cat] || CATEGORY_COLOR.EVENT;

// The 3 uniform types — event_ironclad.sql / events_uniform_khaki_polo_merge.sql
// constrain `uniform` to exactly these.
export const UNIFORM_TYPES = ['Class A', 'Class B', 'Khaki and Polo'];

// Default POC every new event is pre-filled with (editable per-event) — Chief/SAI,
// the standing point of contact when no one more specific is set. Only email is
// on file. EventDetailCard links this exact name to mailto; any other poc text
// (admin overwrote the default) renders as plain text like before.
export const DEFAULT_POC = { name: 'Michael Thrasher (Chief/SAI)', email: 'thrasher_michael@hcde.org' };

// DB stores event_time as postgres `time` ("HH:MM:SS"); render AM/PM for humans.
export function formatEventTime(event_time) {
  if (!event_time) return null;
  const [h, m] = event_time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// "2:30 PM – 4:30 PM" when both start and end are set; falls back to just the
// start time (old single-time behavior) when end_time is absent.
export function formatEventTimeRange(event_time, end_time) {
  const start = formatEventTime(event_time);
  const end = formatEventTime(end_time);
  if (start && end) return `${start} – ${end}`;
  return start;
}

// team '' = battalion-wide (stored as NULL). The 4 specialty teams map to their
// own calendars.
export const EVENT_TEAMS = [
  { id: '',         label: 'Battalion', color: '#E8C77A' },
  { id: 'raiders',  label: 'Raiders',   color: '#7EC87E' },
  { id: 'rifle',    label: 'Rifle',     color: '#C9A961' },
  { id: 'academic', label: 'Academic',  color: '#B48FD4' },
  { id: 'drill',    label: 'Drill',     color: '#D69B6B' },
];
export const teamLabel = (id) => EVENT_TEAMS.find((t) => t.id === (id || ''))?.label || 'Battalion';

export const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
export const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// JS Date.getDay() order (0=Sun...6=Sat) — indexes match `recurrence_days`.
export const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Does `event` occur on calendar day `dateStr` ('YYYY-MM-DD')? An exact match
// on `date` always counts (covers normal one-off events and a recurring
// series' own start day). A recurring series (recurrence_days + end_date set)
// also matches any day within [date, end_date] whose weekday is listed.
// Expansion is opt-in per calendar — see events_recurrence.sql for why this
// keeps recurrence rendering scoped to whichever calendar actually calls it.
export function eventOccursOnDate(event, dateStr) {
  if (event.date === dateStr) return true;
  if (!event.recurrence_days?.length || !event.end_date) return false;
  if (dateStr < event.date || dateStr > event.end_date) return false;
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  return event.recurrence_days.includes(dow);
}

// "MON-THU" for a contiguous run, "MON, WED, FRI" otherwise.
export function formatRecurrenceDays(days) {
  if (!days?.length) return '';
  const sorted = [...days].sort((a, b) => a - b);
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isContiguous && sorted.length > 1) {
    return `${WEEKDAY_SHORT[sorted[0]]}-${WEEKDAY_SHORT[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

// A DB event row -> render-friendly shape used by the public calendar.
export function toCalendarItem(row) {
  const d = row.date ? new Date(`${row.date}T00:00:00`) : null;
  const end = row.end_date ? new Date(`${row.end_date}T00:00:00`) : null;
  return {
    id: row.id,
    y: d ? d.getFullYear() : 0,
    m: d ? d.getMonth() : 0,
    d: d ? d.getDate() : 0,
    d2: end ? end.getDate() : undefined,
    cat: row.category && CATEGORY_COLOR[row.category] ? row.category : 'EVENT',
    title: row.title,
    where: row.location || undefined,
  };
}

// Group date-sorted rows into ordered {y,m,items} month buckets.
export function groupByMonth(items) {
  const groups = [];
  let current = null;
  items.forEach((ev) => {
    const key = `${ev.y}-${ev.m}`;
    if (!current || current.key !== key) {
      current = { key, y: ev.y, m: ev.m, items: [] };
      groups.push(current);
    }
    current.items.push(ev);
  });
  return groups;
}
