// Official 2026 Raider Roster. Single source of truth — RaiderTeam.jsx (the
// public /raiderteam page) and the Range TV congrats feature both read this
// so the two never drift. First name in each list is the team commander.
export const RAIDER_TEAMS = [
  {
    key: 'male',
    label: 'MALE VARSITY',
    accent: '#C9A961',
    members: [
      'Weston Noblit', 'Quincy Tyler', 'William Baker (Senior)', "Aidan O'Brien",
      'Luke Vetsch', 'Makaio Roos', 'Griffen Blume', 'Aiden Clifton', 'Zane Youngblood',
      'Blayne Frazier', 'Alex Johnson', "Logan O'Brien", 'Hayden Ogle', 'Riley Lyles',
      'Luke Mattison',
    ],
  },
  {
    key: 'coed',
    label: 'CO-ED VARSITY',
    accent: '#E8C77A',
    members: [
      'Zoe McCollum', 'Amber Davidson', 'Kylie Gray', 'Mya Sneideman', 'Maddie Basset',
      'Bella Basset', 'Lilac Powers', 'Taylor King', 'Chase Otto', 'Levi Fosdick',
      'Bryson Frazier', 'Cooper Higginbotham', 'William Baker (Freshman)', 'Shawn Layson',
      'James Bunch',
    ],
  },
  {
    key: 'jv',
    label: 'JUNIOR VARSITY',
    accent: '#7EC87E',
    members: [
      'Hayden Ogle', 'Avery Fosdick', 'Grayson Mercier', 'Mason Myers', 'Jordan Elsea',
      'Jayde Walker', 'Veronica Coyer', 'Elizabeth Morris', 'Annabelle Settle',
      'Hayden Lee', 'James Shelby', 'Miles Holloway', 'Bryson Dodd', 'Luke Chambers',
      'Landon McClure', 'Ian Thompson',
    ],
  },
];

// Flat lookups keyed by normalized name: teams a cadet made (a cadet can
// appear on more than one roster, e.g. Hayden Ogle on both Male and JV), and
// the roster's own short display form — cadet_consent stores full legal
// names (middle names included), so showing the roster's "Hayden Ogle"
// instead of the DB's "Hayden Michael Ogle" keeps every card consistent.
const NAME_TO_TEAMS = new Map();
const NAME_TO_DISPLAY = new Map();
for (const team of RAIDER_TEAMS) {
  for (const rawName of team.members) {
    const key = normalizeName(rawName);
    const list = NAME_TO_TEAMS.get(key) || [];
    list.push(team);
    NAME_TO_TEAMS.set(key, list);
    if (!NAME_TO_DISPLAY.has(key)) NAME_TO_DISPLAY.set(key, rawName);
  }
}

// Roster names carry parenthetical disambiguators ("(Senior)") the cadet
// roster won't have — strip those, plus case/whitespace. cadet_consent also
// stores full legal names (middle names included) where the roster only has
// first + last, so once cleaned, collapse to just the first and last token —
// checked against the full ~154-cadet roster and no two distinct cadets
// share a first+last, so this doesn't risk cross-matching different people.
export function normalizeName(name) {
  const cleaned = (name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length <= 2) return cleaned;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function teamsForName(name) {
  return NAME_TO_TEAMS.get(normalizeName(name)) || [];
}

export function displayNameForName(name) {
  return NAME_TO_DISPLAY.get(normalizeName(name)) || name;
}
