import { useEffect, useState } from 'react';
import { hasSeenWatchZoneBanner, markWatchZoneBannerSeen } from '../lib/watchZoneSeen';
import posthog from '../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', gold: '#C9A961', bright: '#E8C77A',
  cream: '#F4ECD8', hair: 'rgba(201,169,97,0.28)',
};

const SHOW_DELAY_MS = 400;

// Slim, non-blocking notification bar pointing new visitors at /watchzone —
// unlike CongratsPopup/RemembrancePopup this never takes over the screen, so
// it can safely show alongside whichever modal popup is currently live.
// Fires once per device (see watchZoneSeen.js).
export default function WatchZoneBanner() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenWatchZoneBanner()) return undefined;
    const t = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setOpen(true));
      posthog.capture('watchzone_banner_shown');
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    markWatchZoneBannerSeen();
    setOpen(false);
    setTimeout(() => setVisible(false), 250);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="New Raider film"
      style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: `linear-gradient(90deg, ${P.navy}, ${P.ink})`,
        borderBottom: `1px solid ${P.hair}`,
        maxHeight: open ? 60 : 0, opacity: open ? 1 : 0,
        overflow: 'hidden', transition: 'max-height 0.3s ease, opacity 0.25s ease',
      }}
    >
      <div style={{
        maxWidth: 1240, margin: '0 auto', padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span aria-hidden="true" style={{ fontSize: 16 }}>🎥</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em',
          color: P.cream, textTransform: 'uppercase', flex: '1 1 auto',
        }}>
          New Raider OC film is up — full send, slow-mo and all
        </span>
        <a
          href="/watchzone"
          onClick={() => posthog.capture('watchzone_banner_clicked')}
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: P.ink, background: P.gold, padding: '7px 14px', borderRadius: 999, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = P.bright; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = P.gold; }}
        >
          WATCH NOW →
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent', border: 'none', color: 'rgba(244,236,216,0.5)',
            fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 4,
          }}
        >×</button>
      </div>
    </div>
  );
}
