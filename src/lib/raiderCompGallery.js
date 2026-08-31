import { RHEA_EVENT_ID, RHEA_EVENT_TITLE } from './rheaComp';

// ── "View Competition" gallery - shared constants (display-only) ────────────
// Public surface: /raiders/comp (components/raiders/CompGallery.jsx), linked
// from a card on /raiders.
//
// This pass is READ-ONLY. It shows photos that already exist in `photos`,
// tagged to a raider_sub_events row via photos.sub_event_id, uploaded by Luke
// (photos.source = 'luke'). Parent uploads are intentionally excluded. No new
// tables, no schema change, no uploader - that's a later step.

export const COMP_EVENT_ID = RHEA_EVENT_ID;
export const COMP_EVENT_TITLE = RHEA_EVENT_TITLE;

// Canonical order (chronological - the way the day actually ran) + blurb for
// every Rhea County event. Matched to the raider_sub_events rows by normalised
// name or leading phrase, so Luke's real labels ("CCR", "Tire Stacker (Both
// Team)") still line up. `hasVideo` = run footage exists for this event (drops
// later). A bucket not listed here still shows; it just sorts after these.
export const COMP_EVENTS = [
  { key: 'pre-comp',        name: 'Pre Comp',            aliases: ['pre comp', 'precomp', 'pre-comp'],                     blurb: 'Kit checks and staging before the first event.',      hasVideo: false },
  { key: 'setup',           name: 'Setup',               aliases: ['setup', 'set up'],                                     blurb: 'Course build and gear layout.',                        hasVideo: false },
  { key: 'waiting',         name: 'Waiting',             aliases: ['waiting', 'wait'],                                     blurb: 'Downtime between staging and the first whistle.',      hasVideo: false },
  { key: 'tire-stacker',    name: 'Tire Stacker',        aliases: ['tire stacker', 'tirestacker'],                         blurb: 'Timed stack-and-reset against the clock.',             hasVideo: false },
  { key: 'gauntlet',        name: 'Gauntlet',            aliases: ['gauntlet', 'the gauntlet'],                            blurb: 'Team sprint through the obstacle lane.',               hasVideo: true },
  { key: 'ccr',             name: 'Cross Country Rescue', aliases: ['ccr', 'cross country rescue', 'cross-country rescue'], blurb: 'Litter carry over the cross-country course.',          hasVideo: true },
  { key: 'obstacle-course', name: 'Obstacle Course',      aliases: ['oc', 'obstacle course', 'obstacle'],                  blurb: 'Individual run of the fixed obstacle set.',            hasVideo: true },
  { key: 'one-rope-bridge', name: 'One Rope Bridge',      aliases: ['one rope bridge', 'orb', 'rope bridge', 'one-rope bridge'], blurb: 'Rig, cross, and break down a single-rope bridge.', hasVideo: true },
  { key: 'highland-games',  name: 'Highland Games',       aliases: ['highland games', 'highland'],                         blurb: 'Strength medley: carries, drags, and throws.',          hasVideo: true },
];

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const ALIAS_ENTRIES = COMP_EVENTS.flatMap((e, i) =>
  [e.name, ...e.aliases].map((a) => [norm(a), { i, e }]),
);
const ALIAS_MAP = Object.fromEntries(ALIAS_ENTRIES);

// Match a raider_sub_events row to a canonical event. Exact normalised name
// first; then "alias is a leading phrase" so Luke's real labels like
// "Tire Stacker (Both Team)" still line up - but NOT a bare word match, so a
// separate bucket like "Before CCR" stays its own thing.
function matchMeta(name) {
  const n = norm(name);
  if (!n) return null;
  if (ALIAS_MAP[n]) return ALIAS_MAP[n];
  for (const [alias, meta] of ALIAS_ENTRIES) {
    if (n === alias || n.startsWith(`${alias} `)) return meta;
  }
  return null;
}

/** Canonical meta (order index + blurb) for a sub-event row, or null. */
export function compEventMeta(subEvent) {
  return matchMeta(subEvent?.name)?.e || null;
}

/** Sort raider_sub_events rows into the canonical event order, unknowns last. */
export function sortSubEvents(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ai = matchMeta(a.name)?.i ?? 900;
    const bi = matchMeta(b.name)?.i ?? 900;
    if (ai !== bi) return ai - bi;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
}
