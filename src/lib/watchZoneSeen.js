// Once-per-device dismiss gate for the Watching Zone homepage banner
// (src/components/WatchZoneBanner.jsx). Bump the version suffix to re-surface
// it to every device the next time there's new film worth flagging.
const LS_KEY = 'tb_watchzone_banner_seen_v1';

export function hasSeenWatchZoneBanner() {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return true; // storage unavailable — fail closed, don't nag
  }
}

export function markWatchZoneBannerSeen() {
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    // ignore — worst case it can show again this session
  }
}
