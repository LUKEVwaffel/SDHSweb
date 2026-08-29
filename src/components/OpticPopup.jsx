import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasSeenOptic, markOpticSeen } from '../lib/opticSeen';
import posthog from '../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.62)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.28)',
};

const SHOW_DELAY_MS = 3200;

const FEATURES = [
  ['SEC', 'Upload from your phone in seconds'],
  ['ALL', 'Seen by the whole battalion, not just your team'],
  ['ANY', 'Every practice, competition, and formation'],
];

// Full-screen launch takeover for OPTIC — the Official Photo Tracking & Image
// Collection network. Replaces the old check-in survey popup. Fires once per
// device (see opticSeen.js), a few seconds after first load. Primary CTA drops
// the visitor straight into the /submit uploader.
export default function OpticPopup() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenOptic()) return;
    const t = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setOpen(true));
      posthog.capture('optic_popup_shown');
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function close() {
    markOpticSeen();
    setOpen(false);
    setTimeout(() => setVisible(false), 300);
  }

  function goUpload() {
    posthog.capture('optic_popup_cta_clicked');
    markOpticSeen();
    setOpen(false);
    navigate('/submit');
  }

  useEffect(() => {
    if (!visible) return;
    function onKey(e) { if (e.key === 'Escape') close(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Introducing OPTIC — the battalion photo network"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(4,10,20,0.82)', backdropFilter: 'blur(6px)',
        opacity: open ? 1 : 0, transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className={`optic-pop ${open ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 680, overflow: 'hidden',
          background: `linear-gradient(165deg, ${P.navy} 0%, ${P.deep} 55%, ${P.ink} 100%)`,
          border: `1px solid ${P.hair}`,
          boxShadow: '0 40px 120px -20px rgba(0,0,0,0.7), 0 0 60px -20px rgba(201,169,97,0.25)',
        }}
      >
        {/* radar sweep + rings */}
        <div aria-hidden="true" style={{ position: 'absolute', right: -160, top: -160, width: 520, height: 520, pointerEvents: 'none', opacity: 0.9 }}>
          <svg viewBox="0 0 200 200" width="520" height="520" style={{ position: 'absolute', inset: 0 }}>
            {[45, 68, 90].map((r, i) => (
              <circle key={i} cx="100" cy="100" r={r} fill="none" stroke={P.gold} strokeWidth="0.5" opacity={0.1 + i * 0.05} />
            ))}
          </svg>
          <svg viewBox="0 0 200 200" width="520" height="520" className="optic-sweep" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="opticSweep" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={P.gold} stopOpacity="0" />
                <stop offset="100%" stopColor={P.gold} stopOpacity="0.22" />
              </linearGradient>
            </defs>
            <path d="M 100 100 L 100 8 A 92 92 0 0 1 192 100 Z" fill="url(#opticSweep)" />
          </svg>
        </div>

        {/* scanlines */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(201,169,97,0.03) 3px 4px)',
        }} />

        {/* corner brackets */}
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

        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(28px, 5vw, 48px)' }}>
          <div className="optic-row" style={{ '--d': '0.05s',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.34em',
            color: P.gold, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="optic-blink">●</span> NOW LIVE · BATTALION-WIDE
          </div>

          <div className="optic-row optic-wordmark" style={{ '--d': '0.12s',
            fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(64px, 13vw, 108px)', letterSpacing: '0.08em',
            color: P.cream, lineHeight: 0.9, margin: '16px 0 4px',
          }}>OPTIC</div>

          <div className="optic-row" style={{ '--d': '0.18s',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.2em',
            color: P.mute, marginBottom: 20,
          }}>OFFICIAL PHOTO TRACKING &amp; IMAGE COLLECTION</div>

          <p className="optic-row" style={{ '--d': '0.24s',
            fontFamily: 'Inter, sans-serif', fontSize: 15.5, lineHeight: 1.65,
            color: P.mute, maxWidth: 460, margin: '0 0 22px',
          }}>
            Every photo the battalion takes now feeds one network. Parents, cadets, and
            photographers upload straight from a phone — and the <strong style={{ color: P.gold }}>whole
            battalion</strong> sees it, not just one team.
          </p>

          <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
            {FEATURES.map(([tag, text], i) => (
              <div key={tag} className="optic-row" style={{ '--d': `${0.3 + i * 0.06}s`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: '0.16em',
                  color: P.gold, border: `1px solid ${P.hair}`, padding: '3px 6px', flexShrink: 0,
                }}>{tag}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.cream }}>{text}</span>
              </div>
            ))}
          </div>

          <div className="optic-row" style={{ '--d': '0.5s', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={goUpload}
              className="optic-cta"
              style={{
                background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.18em', fontWeight: 700,
                padding: '15px 28px', transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = P.bright; e.currentTarget.style.boxShadow = '0 12px 30px -12px rgba(201,169,97,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = P.gold; e.currentTarget.style.boxShadow = 'none'; }}
            >UPLOAD TO OPTIC →</button>
            <button
              type="button"
              onClick={close}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: P.faint, textDecoration: 'underline',
              }}
            >Maybe later</button>
          </div>
        </div>

        <div aria-hidden="true" style={{
          position: 'relative', zIndex: 2,
          borderTop: `1px solid ${P.hair}`, background: 'rgba(0,0,0,0.3)',
          padding: '10px 20px', display: 'flex', justifyContent: 'space-between',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: '0.2em',
          color: P.gold, opacity: 0.7,
        }}>
          <span>PAO // PHOTO NET</span>
          <span>UNIT TN-051</span>
          <span className="optic-blink">[ ONLINE ]</span>
        </div>
      </div>

      <style>{`
        .optic-pop { transform: translateY(18px) scale(0.98); opacity: 0; transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease; }
        .optic-pop.is-open { transform: translateY(0) scale(1); opacity: 1; }
        .optic-row { opacity: 0; transform: translateY(10px); }
        .optic-pop.is-open .optic-row { animation: opticIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: var(--d, 0s); }
        @keyframes opticIn { to { opacity: 1; transform: translateY(0); } }
        .optic-wordmark { text-shadow: 0 0 40px rgba(201,169,97,0.35); animation: opticGlow 3.2s ease-in-out infinite alternate; }
        @keyframes opticGlow { from { text-shadow: 0 0 24px rgba(201,169,97,0.2); } to { text-shadow: 0 0 52px rgba(201,169,97,0.5); } }
        .optic-sweep { transform-origin: 100px 100px; animation: opticSpin 4s linear infinite; }
        @keyframes opticSpin { to { transform: rotate(360deg); } }
        .optic-blink { animation: opticBlink 1.4s steps(1) infinite; }
        @keyframes opticBlink { 50% { opacity: 0.25; } }
        @media (prefers-reduced-motion: reduce) {
          .optic-pop, .optic-pop.is-open { transition: opacity 0.2s ease; transform: none; }
          .optic-row { opacity: 1; transform: none; animation: none !important; }
          .optic-wordmark, .optic-sweep, .optic-blink { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
