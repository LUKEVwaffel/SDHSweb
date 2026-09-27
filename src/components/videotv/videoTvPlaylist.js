// Per-TV loop config for /videotv, kept in the TV browser's localStorage so
// whoever sets up a given screen decides what it plays and in what order.
// Shape: { order: [filmKey], hidden: [filmKey] }. Films uploaded after the
// loop was saved aren't in `order` yet — they join at the end, visible.

const LS_KEY = 'tb_videotv_loop_v1';

export function loadLoopConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!raw || !Array.isArray(raw.order) || !Array.isArray(raw.hidden)) return null;
    return { order: raw.order.filter((k) => typeof k === 'string'), hidden: raw.hidden.filter((k) => typeof k === 'string') };
  } catch {
    return null;
  }
}

export function saveLoopConfig(config) {
  try {
    if (config) localStorage.setItem(LS_KEY, JSON.stringify(config));
    else localStorage.removeItem(LS_KEY);
  } catch {
    // storage blocked — loop still works this session, just won't persist
  }
}

/** Every film in loop order, each flagged with whether it's in the loop. */
export function orderedFilms(films, config) {
  if (!config) return films.map((f) => ({ film: f, included: true }));
  const byKey = new Map(films.map((f) => [f.key, f]));
  const hidden = new Set(config.hidden);
  const known = config.order.filter((k) => byKey.has(k));
  const fresh = films.filter((f) => !config.order.includes(f.key)).map((f) => f.key);
  return [...known, ...fresh].map((k) => ({ film: byKey.get(k), included: !hidden.has(k) }));
}

export function configFrom(rows) {
  return {
    order: rows.map((r) => r.film.key),
    hidden: rows.filter((r) => !r.included).map((r) => r.film.key),
  };
}
