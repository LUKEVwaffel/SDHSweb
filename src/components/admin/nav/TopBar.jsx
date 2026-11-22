import { useState, useEffect } from 'react';
import NotificationBell from './NotificationBell';
import { P, mono, fs, sp, radius, glass } from '../theme';

// Matches the DISPATCH Glass mockup's header (design/dispatch-ai/DISPATCH
// Glass.dc.html, "MAIN" section): Live status + clock + a notification bell
// on the right. No wordmark and no section title — the Sidebar's own
// header has the wordmark, and its active-item highlight already shows
// which section is current, so a repeated section label up here
// was pure duplication. No account chip/logout either (moved to the
// Sidebar footer) — this bar is deliberately minimal.
//
// showMenuButton/onOpenMenu are only passed (phone band) when the sidebar is
// a slide-over drawer — see Dashboard.jsx, which owns the drawer-open state
// so Sidebar and this button agree on it.
export default function TopBar({ showMenuButton = false, onOpenMenu, contentOffset = 0, onNewAiConversation, accountKey = '', notificationsEnabled = true }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);

  return (
    <div style={{
      height: showMenuButton ? 48 : 44, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: sp[3], padding: `0 20px 0 ${showMenuButton ? 12 : contentOffset + 20}px`,
    }}>
      {showMenuButton && (
        <button
          onClick={onOpenMenu}
          aria-label="Open navigation"
          style={{
            width: 34, height: 34, borderRadius: radius.md, border: glass.border,
            background: glass.hoverWash, color: P.cream, fontSize: fs.md, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          ☰
        </button>
      )}

      {onNewAiConversation && <button onClick={onNewAiConversation} style={{ minHeight: showMenuButton ? 44 : 36, padding: '0 4px', border: 'none', background: 'transparent', color: P.gold, fontFamily: mono, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>← New conversation</button>}

      <div style={{
        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        fontFamily: mono, fontWeight: 600, fontSize: fs.tiny, color: P.green,
        padding: '5px 10px', borderRadius: radius.pill, background: 'rgba(39,174,96,0.12)', whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.green, boxShadow: `0 0 8px ${P.green}` }} />
        LIVE
      </div>
      {!showMenuButton && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, fontVariantNumeric: 'tabular-nums', padding: '0 4px', whiteSpace: 'nowrap' }}>
        {time.toLocaleTimeString()}
      </div>}
      {notificationsEnabled && <NotificationBell accountKey={accountKey} />}
    </div>
  );
}
