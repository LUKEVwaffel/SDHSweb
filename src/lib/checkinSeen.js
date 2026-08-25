import { CAMPAIGN_ID } from './checkinQuestions';

// Once-per-device gate for the check-in popup. Keyed by CAMPAIGN_ID so a
// deliberate bump of that constant (new round, ~twice a year) makes every
// device eligible again — dismissing or submitting only silences the
// *current* campaign, never re-nags within it.
const LS_KEY = `tb_checkin_seen_${CAMPAIGN_ID}`;

export function hasSeenCheckin() {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return true; // storage unavailable — fail closed, don't show the popup
  }
}

export function markCheckinSeen() {
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    // ignore — worst case the popup can show again this session
  }
}
