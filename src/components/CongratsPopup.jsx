import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasSeenCongrats, markCongratsSeen } from '../lib/congratsSeen';
import { CONGRATS_MEET, CONGRATS_TROPHIES } from '../lib/tvCongratsData';
import posthog from '../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.62)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.28)',
};

const SHOW_DELAY_MS = 2600;

// First-open takeover celebrating the Rhea County meet result. Replaces the
// OPTIC launch popup (dormant between comps). Fires once per device (see
// congratsSeen.js) a few seconds after first load. Primary CTA drops the
// visitor onto the /vote ballot for the Picture of the Comp.
export default function CongratsPopup() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenCongrats()) return undefined;
    const t = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setOpen(true));
      posthog.capture('congrats_popup_shown');
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function close() {
    markCongratsSeen();
    setOpen(false);
    setTimeout(() => setVisible(false), 300);
  }

  function goVote() {
    posthog.capture('congrats_popup_cta_clicked');
    markCongratsSeen();
    setOpen(false);
    navigate('/vote');
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
      aria-label={`Congratulations, Trojan Battalion — ${CONGRATS_MEET.label}`}
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(4,10,20,0.82)', backdropFilter: 'blur(6px)',
        opacity: open ? 1 : 0, transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className={`cg-pop ${open ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 640, overflow: 'hidden',
          background: `linear-gradient(165deg, ${P.navy} 0%, ${P.deep} 55%, ${P.ink} 100%)`,
          border: `1px solid ${P.hair}`,
          boxShadow: '0 40px 120px -20px rgba(0,0,0,0.7), 0 0 60px -20px rgba(201,169,97,0.25)',
        }}
      >
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

        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(28px, 5vw, 46px)' }}>
          <div className="cg-row" style={{ '--d': '0.05s',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.32em',
            color: P.gold, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="cg-blink">●</span> {CONGRATS_MEET.label.toUpperCase()} · {CONGRATS_MEET.date.toUpperCase()}
          </div>

          <h2 className="cg-row" style={{ '--d': '0.12s',
            fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(34px, 7vw, 56px)', letterSpacing: '0.02em',
            color: P.cream, lineHeight: 1, margin: '16px 0 6px',
          }}>
            CONGRATULATIONS,<br /><span style={{ color: P.bright }}>TROJAN BATTALION</span>
          </h2>

          <p className="cg-row" style={{ '--d': '0.18s',
            fontFamily: 'Inter, sans-serif', fontSize: 14.5, lineHeight: 1.6,
            color: P.mute, maxWidth: 460, margin: '0 0 20px',
          }}>
            {CONGRATS_MEET.kicker} at {CONGRATS_MEET.label}. To every cadet who competed and every
            family in the stands — thank you.
          </p>

          <div style={{ display: 'grid', gap: 8, marginBottom: 26 }}>
            {CONGRATS_TROPHIES.map((t, i) => (
              <div key={`${t.place}-${t.event}`} className="cg-row" style={{ '--d': `${0.24 + i * 0.05}s`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
                  color: t.tier === 1 ? P.ink : P.gold,
                  background: t.tier === 1 ? P.bright : 'transparent',
                  border: `1px solid ${t.tier === 1 ? P.bright : P.hair}`,
                  padding: '3px 8px', flexShrink: 0, minWidth: 34, textAlign: 'center',
                }}>{t.place}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.cream }}>
                  {t.event} <span style={{ color: P.faint }}>· {t.detail}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="cg-row" style={{ '--d': '0.55s', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={goVote}
              style={{
                background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.16em', fontWeight: 700,
                padding: '15px 26px', transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = P.bright; e.currentTarget.style.boxShadow = '0 12px 30px -12px rgba(201,169,97,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = P.gold; e.currentTarget.style.boxShadow = 'none'; }}
            >VOTE FOR THE PICTURE OF THE COMP →</button>
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
      </div>

      <style>{`
        .cg-pop { transform: translateY(18px) scale(0.98); opacity: 0; transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease; }
        .cg-pop.is-open { transform: translateY(0) scale(1); opacity: 1; }
        .cg-row { opacity: 0; transform: translateY(10px); }
        .cg-pop.is-open .cg-row { animation: cgIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: var(--d, 0s); }
        @keyframes cgIn { to { opacity: 1; transform: translateY(0); } }
        .cg-blink { animation: cgBlink 1.4s steps(1) infinite; }
        @keyframes cgBlink { 50% { opacity: 0.25; } }
        @media (prefers-reduced-motion: reduce) {
          .cg-pop, .cg-pop.is-open { transition: opacity 0.2s ease; transform: none; }
          .cg-row { opacity: 1; transform: none; animation: none !important; }
          .cg-blink { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
