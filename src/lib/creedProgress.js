// localStorage-only progress tracking for /creed — no login, no server.
// Every cadet on the shared machine gets their own browser's local record.
const KEY = 'tb.creed.progress.v1';

const DEFAULT_PROGRESS = {
  fillBlank: { bestScore: 0, attempts: 0, lastPlayed: null },
  sequencing: { bestTimeMs: null, attempts: 0, lastPlayed: null },
  scramble: { bestScore: 0, attempts: 0, lastPlayed: null },
  recall: { bestAccuracy: 0, hintLevelCleared: null, blankPageCleared: false, attempts: 0, lastPlayed: null },
  speed: { bestWpm: 0, bestAccuracy: 0, attempts: 0, lastPlayed: null },
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return deepClone(DEFAULT_PROGRESS);
    const parsed = JSON.parse(raw);
    return { ...deepClone(DEFAULT_PROGRESS), ...parsed };
  } catch {
    return deepClone(DEFAULT_PROGRESS);
  }
}

function save(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable (private browsing, quota) — progress just won't persist.
  }
}

export function getProgress() {
  return load();
}

// Merges a single game's result in, keeping the best score seen and bumping
// attempt count / lastPlayed. `updater` receives the game's current record
// and returns the new one — caller decides what "best" means for that game.
export function recordResult(gameKey, updater) {
  const progress = load();
  const current = progress[gameKey] || DEFAULT_PROGRESS[gameKey];
  const next = updater(current);
  const merged = {
    ...progress,
    [gameKey]: { ...current, ...next, attempts: (current.attempts || 0) + 1, lastPlayed: Date.now() },
  };
  save(merged);
  return merged;
}

// Mastery badge shown on the hub card: NOT_STARTED / IN_PROGRESS / MASTERED.
// Thresholds are deliberately generous — this is a confidence signal, not a gate.
export function masteryLevel(gameKey, progress) {
  const g = progress[gameKey];
  if (!g || !g.attempts) return 'NOT_STARTED';
  switch (gameKey) {
    case 'fillBlank':
      return g.bestScore >= 100 ? 'MASTERED' : 'IN_PROGRESS';
    case 'sequencing':
      return g.bestTimeMs != null ? 'MASTERED' : 'IN_PROGRESS';
    case 'scramble':
      return g.bestScore >= 100 ? 'MASTERED' : 'IN_PROGRESS';
    case 'recall':
      return g.blankPageCleared ? 'MASTERED' : 'IN_PROGRESS';
    case 'speed':
      return g.bestAccuracy >= 95 ? 'MASTERED' : 'IN_PROGRESS';
    default:
      return 'NOT_STARTED';
  }
}
