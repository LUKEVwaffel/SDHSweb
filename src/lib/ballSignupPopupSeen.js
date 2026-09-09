// Once-per-device gate for the homepage Military Ball signup popup
// (src/components/ball/BallSignupPopup.jsx). Dismissing it, clicking through to
// the signup, or closing it any other way all count as "seen" — it never
// re-surfaces on that device. Bump the version suffix to show it again to
// everyone (e.g. a reminder push closer to the deadline).
const LS_KEY = 'tb_ball_signup_popup_seen_v1';

export function hasSeenBallSignupPopup() {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return true; // storage unavailable — fail closed, don't nag
  }
}

export function markBallSignupPopupSeen() {
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    // ignore — worst case it can show again this session
  }
}
