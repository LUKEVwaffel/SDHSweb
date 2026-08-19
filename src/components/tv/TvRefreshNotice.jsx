import { P, mono, inter, fs, sp, radius, shadow } from '../admin/theme.js';
import { useTvRefreshNotice } from '../../hooks/useTvRefreshNotice.js';

// Sits over whatever phase/layout is currently showing (mounted as a sibling
// at the kiosk root, same spot as TvPreviewBadge) once useTvRefreshNotice
// detects this tab is running an older build than what's actually deployed.
// Clickable — kiosk machines have a mouse/keyboard nearby (see TvRemotePanel),
// so "Refresh now" can reload in place instead of just telling someone to.
export default function TvRefreshNotice() {
  const needsRefresh = useTvRefreshNotice();
  if (!needsRefresh) return null;

  return (
    <div style={{
      position: 'fixed', bottom: sp[6], right: sp[6], zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: sp[5],
      padding: `${sp[4]}px ${sp[5]}px`, borderRadius: radius.lg,
      background: P.bright, boxShadow: shadow.lg,
      border: '1px solid rgba(255,255,255,0.4)',
    }}>
      <div>
        <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.2em', color: '#3A2E0F' }}>
          UPDATE AVAILABLE
        </div>
        <div style={{ fontFamily: inter, fontSize: fs.md, fontWeight: 700, color: '#1A1408', marginTop: 2 }}>
          This screen needs a refresh to show current info.
        </div>
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          flexShrink: 0, padding: `${sp[3]}px ${sp[5]}px`, borderRadius: radius.md,
          border: 'none', background: P.ink, color: P.bright,
          fontFamily: mono, fontSize: fs.xs, letterSpacing: '0.1em',
          cursor: 'pointer',
        }}
      >
        REFRESH NOW
      </button>
    </div>
  );
}
