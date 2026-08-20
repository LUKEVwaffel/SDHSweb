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
      'Luke Vetsch', 'Makaio Roos', 'Griffin Blumeyer', 'Aiden Clifton', 'Zane Youngblood',
      'Blayne Frazier', 'Alex Johnson', "Logan O'Brien", 'Hayden Ogle', 'Riley Lyles',
      'Luke Mattison',
    ],
  },
  {
    key: 'coed',
    label: 'CO-ED VARSITY',
    accent: '#E8C77A',
    members: [
      'Zoe McCollum', 'Amber Davidson', 'Kylie Gray', 'Mya Sneideman', 'Maddie Bassett',
      'Bella Bassett', 'Raven Powers', 'Taylor King', 'Chase Otto', 'Levi Fosdick',
      'Bryson Frazier', 'Cooper Higginbotham', 'William Baker (Freshman)', 'Sean Layson',
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

// Cadets who go by a name other than their cadet_consent legal first name —
// normalizeName can't infer this from spelling alone, so map the roster's
// normalized key straight to the DB's normalized (first+last) key.
const NAME_ALIASES = {
  'zane youngblood': 'jason youngblood', // legal "Jason Zane Youngblood", goes by middle name
  'alex johnson': 'alexander johnson',   // legal "Alexander Lee Johnson"
  'maddie bassett': 'madalynn bassett',  // legal "Madalynn Alexa Bassett"
  'bella bassett': 'isabella bassett',   // legal "Isabella Bridget Bassett"
};

// Two different real cadets are both named "William Baker" (Senior, Male
// Varsity; Freshman, Co-Ed Varsity) — collapsing to first+last would merge
// them into one ambiguous key. cadet_consent has no senior/freshman marker,
// but personnel's role_short confirms the one with no middle name ("William
// Baker") is the Charlie Co. XO — Senior; the other ("William Alexander
// Baker") is the Freshman. Matched on the cadet_consent row's *exact* full
// name, checked before the general collapsed-key lookup.
const EXACT_NAME_OVERRIDES = {
  'william baker': { teamKey: 'male', display: 'William Baker' },
  'william alexander baker': { teamKey: 'coed', display: 'William Baker' },
};
const EXACT_OVERRIDE_KEYS = new Set(['william baker (senior)', 'william baker (freshman)']);

// Flat lookups keyed by normalized name: teams a cadet made (a cadet can
// appear on more than one roster, e.g. Hayden Ogle on both Male and JV), and
// the roster's own short display form — cadet_consent stores full legal
// names (middle names included), so showing the roster's "Hayden Ogle"
// instead of the DB's "Hayden Michael Ogle" keeps every card consistent.
// The two William Bakers are excluded here — they're handled exclusively via
// EXACT_NAME_OVERRIDES above, not the collapsed key both their names share.
const NAME_TO_TEAMS = new Map();
const NAME_TO_DISPLAY = new Map();
for (const team of RAIDER_TEAMS) {
  for (const rawName of team.members) {
    if (EXACT_OVERRIDE_KEYS.has(rawName.toLowerCase())) continue;
    const key = normalizeName(rawName);
    for (const k of [key, NAME_ALIASES[key]].filter(Boolean)) {
      const list = NAME_TO_TEAMS.get(k) || [];
      list.push(team);
      NAME_TO_TEAMS.set(k, list);
      if (!NAME_TO_DISPLAY.has(k)) NAME_TO_DISPLAY.set(k, rawName);
    }
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

function fullKey(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function teamsForName(name) {
  const override = EXACT_NAME_OVERRIDES[fullKey(name)];
  if (override) {
    const team = RAIDER_TEAMS.find((t) => t.key === override.teamKey);
    return team ? [team] : [];
  }
  return NAME_TO_TEAMS.get(normalizeName(name)) || [];
}

export function displayNameForName(name) {
  const override = EXACT_NAME_OVERRIDES[fullKey(name)];
  if (override) return override.display;
  return NAME_TO_DISPLAY.get(normalizeName(name)) || name;
}
