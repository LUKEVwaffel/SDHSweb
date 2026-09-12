import { useEffect, useState } from 'react';
import { hasSeenRemembrance, markRemembranceSeen } from '../lib/remembranceSeen';
import posthog from '../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.62)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.28)',
};

const SHOW_DELAY_MS = 600;

// September 11th remembrance takeover — honors those who died and thanks
// every service member who answered after. Fires once per device (see
// remembranceSeen.js), ahead of CongratsPopup's own timer so it reads first
// if both are due; a viewer dismisses this one to reveal whatever's behind it.
export default function RemembrancePopup() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenRemembrance()) return undefined;
    const t = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setOpen(true));
      posthog.capture('remembrance_popup_shown');
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function close() {
    markRemembranceSeen();
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
      aria-label="September 11th Remembrance"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 9600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(4,10,20,0.85)', backdropFilter: 'blur(6px)',
        opacity: open ? 1 : 0, transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className={`rp-pop ${open ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 600, overflow: 'hidden',
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

        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(201,169,97,0.03) 3px 4px)',
        }} />

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

        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(28px, 5vw, 46px)', textAlign: 'center' }}>
          <div className="rp-row" style={{ '--d': '0.05s', fontSize: 30, marginBottom: 10 }}>🎗️</div>

          <div className="rp-row" style={{ '--d': '0.1s',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.32em',
            color: P.gold,
          }}>
            NEVER FORGET
          </div>

          <h2 className="rp-row" style={{ '--d': '0.16s',
            fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(26px, 6vw, 40px)', letterSpacing: '0.02em',
            color: P.cream, lineHeight: 1.15, margin: '14px 0 16px',
          }}>
            HONORING THOSE WE LOST<br /><span style={{ color: P.bright }}>AND ALL WHO SERVED</span>
          </h2>

          <p className="rp-row" style={{ '--d': '0.24s',
            fontFamily: 'Inter, sans-serif', fontSize: 14.5, lineHeight: 1.7,
            color: P.mute, maxWidth: 460, margin: '0 auto 14px',
          }}>
            We remember the nearly 3,000 lives lost on September 11th, 2001 — and we
            honor every service member who answered the call in the years since to
            defend the freedoms we hold today.
          </p>

          <p className="rp-row" style={{ '--d': '0.3s',
            fontFamily: 'Inter, sans-serif', fontSize: 14.5, lineHeight: 1.7,
            color: P.mute, maxWidth: 460, margin: '0 auto 26px',
          }}>
            To every veteran and every family who sacrificed for this country — thank
            you. Our nation is stronger, safer, and freer because of you.
          </p>

          <div className="rp-row" style={{ '--d': '0.4s', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { posthog.capture('remembrance_popup_dismissed'); close(); }}
              style={{
                background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.16em', fontWeight: 700,
                padding: '15px 26px', transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = P.bright; e.currentTarget.style.boxShadow = '0 12px 30px -12px rgba(201,169,97,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = P.gold; e.currentTarget.style.boxShadow = 'none'; }}
            >THANK YOU FOR YOUR SERVICE</button>
          </div>
        </div>
      </div>

      <style>{`
        .rp-pop { transform: translateY(18px) scale(0.98); opacity: 0; transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease; }
        .rp-pop.is-open { transform: translateY(0) scale(1); opacity: 1; }
        .rp-row { opacity: 0; transform: translateY(10px); }
        .rp-pop.is-open .rp-row { animation: rpIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: var(--d, 0s); }
        @keyframes rpIn { to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .rp-pop, .rp-pop.is-open { transition: opacity 0.2s ease; transform: none; }
          .rp-row { opacity: 1; transform: none; animation: none !important; }
        }
      `}</style>
    </div>
  );
}
