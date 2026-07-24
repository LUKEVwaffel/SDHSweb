// Shared calendar vocabulary — the single source for event categories, their
// colors, and the team list. Both the public calendar (Bulletin) and the admin
// EventsPanel read from here so a category/color change happens in one place.

export const EVENT_CATEGORIES = [
  { id: 'FOOTBALL',  color: '#7FA8D6' },
  { id: 'RAIDER',    color: '#7EC87E' },
  { id: 'RIFLE',     color: '#C9A961' },
  { id: 'DRILL',     color: '#D69B6B' },
  { id: 'ACADEMIC',  color: '#B48FD4' },
  { id: 'JROTC',     color: '#6BC7C0' },
  { id: 'BATTALION', color: '#E8C77A' },
  { id: 'CEREMONY',  color: '#D6889B' },
  { id: 'BREAK',     color: 'rgba(244,236,216,0.55)' },
  { id: 'EVENT',     color: '#C9A961' }, // neutral fallback for untagged rows
];

export const CATEGORY_COLOR = Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.id, c.color]));
export const categoryColor = (cat) => CATEGORY_COLOR[cat] || CATEGORY_COLOR.EVENT;

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
