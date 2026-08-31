// Once-per-device gate for the post-competition congratulations popup
// (src/components/CongratsPopup.jsx). Bump the version suffix to re-surface it
// to every device after the next competition. Dismissing or clicking through
// only silences the current version.
const LS_KEY = 'tb_congrats_popup_seen_v1';

export function hasSeenCongrats() {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return true; // storage unavailable — fail closed, don't nag
  }
}

export function markCongratsSeen() {
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    // ignore — worst case it can show again this session
  }
}
