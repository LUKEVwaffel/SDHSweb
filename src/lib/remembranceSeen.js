// Once-per-device gate for the 9/11 remembrance popup
// (src/components/RemembrancePopup.jsx). Bump the version suffix to re-surface
// it to every device for a future anniversary.
const LS_KEY = 'tb_remembrance_popup_seen_v1';

export function hasSeenRemembrance() {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return true; // storage unavailable — fail closed, don't nag
  }
}

export function markRemembranceSeen() {
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    // ignore — worst case it can show again this session
  }
}
