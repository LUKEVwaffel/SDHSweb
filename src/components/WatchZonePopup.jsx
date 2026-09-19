import { useEffect, useState } from 'react';
import { hasSeenWatchZoneBanner, markWatchZoneBannerSeen } from '../lib/watchZoneSeen';
import posthog from '../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.62)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.28)',
};

const SHOW_DELAY_MS = 3400;

// First-open takeover pointing visitors at the new Raider film. Fires after
// CongratsPopup's own 2600ms timer so it stacks on top if that's still up —
// dismissing it reveals whatever's behind, same layering as
// RemembrancePopup. Fires once per device (see watchZoneSeen.js).
export default function WatchZonePopup() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenWatchZoneBanner()) return undefined;
    const t = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setOpen(true));
      posthog.capture('watchzone_popup_shown');
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function close() {
    markWatchZoneBannerSeen();
    setOpen(false);
    setTimeout(() => setVisible(false), 300);
  }

  useEffect(() => {
    if (!visible) return undefined;
    function onKey(e) { if (e.key === 'Escape') close(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New Raider film"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 9550,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(4,10,20,0.85)', backdropFilter: 'blur(6px)',
        opacity: open ? 1 : 0, transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className={`wz-pop ${open ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 460, overflow: 'hidden',
          background: `linear-gradient(165deg, ${P.navy} 0%, ${P.deep} 55%, ${P.ink} 100%)`,
          border: `1px solid ${P.hair}`,
          boxShadow: '0 40px 120px -20px rgba(0,0,0,0.7), 0 0 60px -20px rgba(201,169,97,0.25)',
        }}
      >
        {[
          { top: 10, left: 10, bt: 1, bl: 1 },
          { top: 10, right: 10, bt: 1, br: 1 },
          { bottom: 10, left: 10, bb: 1, bl: 1 },
          { bottom: 10, right: 10, bb: 1, br: 1 },
        ].map((c, i) => (
          <div key={i} aria-hidden="true" style={{
            position: 'absolute', width: 16, height: 16, ...c,
            borderTop: c.bt ? `1px solid ${P.gold}` : undefined,
            borderBottom: c.bb ? `1px solid ${P.gold}` : undefined,
            borderLeft: c.bl ? `1px solid ${P.gold}` : undefined,
            borderRight: c.br ? `1px solid ${P.gold}` : undefined,
            opacity: 0.6,
          }} />
        ))}

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 3,
            width: 32, height: 32, cursor: 'pointer', lineHeight: 1, fontSize: 16,
            background: 'transparent', border: `1px solid ${P.hair}`, color: P.mute,
          }}
        >×</button>

        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(28px, 6vw, 40px)', textAlign: 'center' }}>
          <div className="wz-row" style={{ '--d': '0.05s', fontSize: 30, marginBottom: 10 }}>🎥</div>

          <div className="wz-row" style={{ '--d': '0.1s',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.3em',
            color: P.gold, textTransform: 'uppercase',
          }}>
            New Raider Film
          </div>

          <h2 className="wz-row" style={{ '--d': '0.16s',
            fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 700, color: P.cream,
            fontSize: 'clamp(26px, 6vw, 36px)', lineHeight: 1.1, margin: '14px 0 14px',
          }}>
            The OC film is up
          </h2>

          <p className="wz-row" style={{ '--d': '0.22s',
            fontFamily: 'Inter, sans-serif', fontSize: 14.5, lineHeight: 1.65,
            color: P.mute, maxWidth: 380, margin: '0 auto 26px',
          }}>
            Full send from Male Raider — both parts, full screen, and a
            slow-mo rail so you don&apos;t miss a thing.
          </p>

          <div className="wz-row" style={{ '--d': '0.3s', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href="/watchzone"
              onClick={() => { posthog.capture('watchzone_popup_clicked'); markWatchZoneBannerSeen(); }}
              style={{
                display: 'block', background: P.gold, color: P.ink, textDecoration: 'none',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.16em', fontWeight: 700,
                padding: '15px 26px', transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = P.bright; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = P.gold; }}
            >WATCH NOW →</a>
            <button
              type="button"
              onClick={close}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em',
                color: P.faint, padding: '4px',
              }}
            >NOT NOW</button>
          </div>
        </div>
      </div>

      <style>{`
        .wz-pop { transform: translateY(18px) scale(0.98); opacity: 0; transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease; }
        .wz-pop.is-open { transform: translateY(0) scale(1); opacity: 1; }
        .wz-row { opacity: 0; transform: translateY(10px); }
        .wz-pop.is-open .wz-row { animation: wzIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: var(--d, 0s); }
        @keyframes wzIn { to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .wz-pop, .wz-pop.is-open { transition: opacity 0.2s ease; transform: none; }
          .wz-row { opacity: 1; transform: none; animation: none !important; }
        }
      `}</style>
    </div>
  );
}
