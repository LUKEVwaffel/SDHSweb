// Every old per-portal login screen (BallDressLogin, RiflePortalLogin, etc.)
// was replaced by the unified /portal hub on 2026-09-17. For one week after
// that, someone hitting an old login screen sees PortalMovedNotice (15s
// countdown + a manual link) instead of being silently bounced. After the
// cutoff, the notice stops rendering and it's a plain instant redirect — the
// old address just doesn't work as its own destination anymore.
const PORTAL_UNIFY_DATE = new Date('2026-09-17T00:00:00Z').getTime();
const NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isPortalMoveNoticeActive() {
  return Date.now() < PORTAL_UNIFY_DATE + NOTICE_WINDOW_MS;
}
