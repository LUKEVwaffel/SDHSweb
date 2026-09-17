import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import '../review/review.css';

const REDIRECT_SECONDS = 15;

// Shown at an old portal login screen for one week after the /portal
// unification (see portalMoveConfig.js) so regular users/bookmarks aren't
// silently bounced with no explanation. Counts down, then redirects itself;
// the manual link covers anyone who doesn't want to wait.
export default function PortalMovedNotice({ portalName }) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  if (secondsLeft <= 0) return <Navigate to="/portal" replace />;

  return (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion &middot; {portalName}</div>
        <div className="rv-panel">
          <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 10 }}>This sign-in page moved</h1>
          <p className="rv-sub" style={{ marginTop: 0 }}>
            {portalName} now lives inside the unified Staff Portal — one email
            sign-in for every staff portal you have access to, instead of a
            separate login page for each. This address stops working in a
            week; update any bookmark you have for it.
          </p>
          <a
            className="rv-btn primary"
            href="/portal"
            style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none', marginTop: 8 }}
          >
            Go to the Staff Portal now
          </a>
          <p className="rv-sub" style={{ marginTop: 14, fontSize: 12 }}>
            Redirecting automatically in {secondsLeft}s&hellip;
          </p>
        </div>
      </div>
    </div>
  );
}
