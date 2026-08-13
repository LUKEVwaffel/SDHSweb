import { mono, fs, sp, radius } from '../admin/theme.js';
import { getPreviewAt } from '../../hooks/useNowTicker.js';

// Renders only when this tab was opened via TV Remote's Preview Mode control
// (?previewAt=<ISO> in the URL) — never on a real kiosk, which always loads
// the bare route. Exists so a preview tab is never mistaken for the live feed
// if screenshotted or shared.
export default function TvPreviewBadge() {
  const previewAt = getPreviewAt();
  if (!previewAt) return null;

  const parsed = new Date(previewAt);
  const label = Number.isNaN(parsed.getTime())
    ? previewAt
    : new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
      }).format(parsed);

  return (
    <div style={{
      position: 'fixed', top: sp[3], left: sp[3], zIndex: 999,
      padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.pill,
      background: 'rgba(192,57,43,0.92)', border: '1px solid rgba(255,255,255,0.3)',
      fontFamily: mono, fontSize: fs.xs, color: '#fff', letterSpacing: '0.12em',
      pointerEvents: 'none',
    }}>
      PREVIEWING · {label}
    </div>
  );
}
