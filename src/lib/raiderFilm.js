// Public-facing view of the raider_videos library, shared by /watchzone
// (desktop + mobile viewing) and /videotv (hallway-TV loop).
//
// A "film" is one logical video: multi-part uploads ("P1 Gauntlet (Male)" +
// "P2 Gauntlet (Male)", "Hurricane Haul — Part 1" + "— Part 2") collapse into
// a single film whose parts always play back-to-back.

// Audio restricted at the request of the cadets in the clip. The stored file
// is also stripped of its audio track; this is the belt-and-braces UI side
// so no player ever offers an unmute.
const AUDIO_RESTRICTED_IDS = new Set([
  '3db04f05-a3d4-4590-abda-4740c7326355', // PTT (Co-ed)
]);

export function isAudioRestricted(video) {
  return AUDIO_RESTRICTED_IDS.has(video?.id);
}

// Event buckets for filter chips — first keyword match wins.
const CATEGORIES = [
  { key: 'oc', label: 'Obstacle Course', match: /obstacle|\bOC\b|hurricane/i },
  { key: 'rope', label: 'One Rope Bridge', match: /one rope/i },
  { key: 'ptt', label: 'PTT', match: /\bPTT\b/i },
  { key: 'ccr', label: 'Cross Country Rescue', match: /\bCCR\b|cross country/i },
  { key: 'gauntlet', label: 'Gauntlet', match: /gauntlet/i },
];
const OTHER = { key: 'other', label: 'Other' };

function categoryOf(title) {
  return CATEGORIES.find((c) => c.match.test(title)) || OTHER;
}

// "P2 Gauntlet (Male)" → { base: 'Gauntlet (Male)', part: 2 }
// "Hurricane Haul — Part 1" → { base: 'Hurricane Haul', part: 1 }
function parsePart(title) {
  const prefix = /^P(\d+)\s+(.+)$/i.exec(title);
  if (prefix) return { base: prefix[2].trim(), part: Number(prefix[1]) };
  const suffix = /^(.+?)\s*[—–-]\s*Part\s*(\d+)$/i.exec(title);
  if (suffix) return { base: suffix[1].trim(), part: Number(suffix[2]) };
  return { base: title.trim(), part: null };
}

/**
 * Collapse raider_videos rows into films, newest first.
 * @returns {Array<{ key, title, category, parts, duration_sec, created_at, audioRestricted }>}
 */
export function buildFilms(videos) {
  const byKey = new Map();
  videos.forEach((v) => {
    const { base, part } = parsePart(v.title || '');
    const key = base.toLowerCase();
    const entry = byKey.get(key) || { key, title: base, parts: [] };
    byKey.set(key, { ...entry, parts: [...entry.parts, { ...v, part }] });
  });

  return [...byKey.values()]
    .map((f) => {
      const parts = [...f.parts].sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
      const created = parts.map((p) => p.created_at).sort().at(-1);
      return {
        ...f,
        parts,
        category: categoryOf(f.title),
        duration_sec: parts.reduce((n, p) => n + (Number(p.duration_sec) || 0), 0),
        created_at: created,
        audioRestricted: parts.some(isAudioRestricted),
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function categoriesIn(films) {
  const present = new Set(films.map((f) => f.category.key));
  return [...CATEGORIES, OTHER].filter((c) => present.has(c.key));
}
