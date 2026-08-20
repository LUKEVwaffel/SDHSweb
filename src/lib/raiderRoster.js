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
      'Jayden Walker', 'Veronica Coyer', 'Elizabeth Morris', 'Annabelle Settles',
      'Hayden Lee', 'James Shelby', 'Miles Holloway', 'Bryson Dodd', 'Luke Chambers',
      'Landon McClure', 'Ian Thompson',
    ],
  },
];

// Flat lookup: normalized name -> array of teams that name made (a cadet can
// appear on more than one roster, e.g. Hayden Ogle on both Male and JV).
const NAME_TO_TEAMS = new Map();
for (const team of RAIDER_TEAMS) {
  for (const rawName of team.members) {
    const key = normalizeName(rawName);
    const list = NAME_TO_TEAMS.get(key) || [];
    list.push(team);
    NAME_TO_TEAMS.set(key, list);
  }
}

// Roster names carry parenthetical disambiguators ("(Senior)") personnel
// records won't have — strip those, plus case/whitespace, for matching.
export function normalizeName(name) {
  return (name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function teamsForName(name) {
  return NAME_TO_TEAMS.get(normalizeName(name)) || [];
}
