// Once-per-device gate for the OPTIC launch popup. Bump the version suffix to
// re-surface it to every device (e.g. a major OPTIC feature drop). Dismissing
// or clicking through only silences the current version.
const LS_KEY = 'tb_optic_popup_seen_v1';

export function hasSeenOptic() {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return true; // storage unavailable — fail closed, don't nag
  }
}

export function markOpticSeen() {
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    // ignore — worst case it can show again this session
  }
}
