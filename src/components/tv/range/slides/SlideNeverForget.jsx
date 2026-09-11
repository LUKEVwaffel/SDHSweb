import { P } from '../../../admin/theme.js';

// 9/11 tribute slide — full-screen "Never Forget" graphic (the actual
// tribute image, not a text mockup). Added 2026-09-11 for Range TV's
// rotation + intro on the anniversary; no admin config, no slideRegistry
// entry (not meant to be added/removed via the slide builder). Same asset
// used by the outside kiosk (TvKiosk.jsx) for /tv.
export default function SlideNeverForget() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <img
        src="/images/tv/never-forget-911.png"
        alt="Never Forget — September 11, 2001"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
