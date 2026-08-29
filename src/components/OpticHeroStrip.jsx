import { useNavigate } from 'react-router-dom';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.25)',
};

// Sits directly under the hero on the home page — a high-visibility launch
// bar for OPTIC. The full pitch lives lower in OpticPromoBand; this is the
// "you can't miss it" announcement, wired straight to the /submit uploader.
export default function OpticHeroStrip() {
  const navigate = useNavigate();

  return (
    <section
      className="optic-strip"
      onClick={() => navigate('/submit')}
      style={{
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(90deg, ${P.deep} 0%, ${P.navy} 50%, ${P.deep} 100%)`,
        borderBottom: `1px solid ${P.hair}`,
        padding: '18px 32px',
      }}
    >
      <div aria-hidden="true" className="optic-strip-shine" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(105deg, transparent 40%, rgba(201,169,97,0.14) 50%, transparent 60%)',
      }} />

      <div style={{
        maxWidth: 1400, margin: '0 auto', position: 'relative',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em',
          color: P.ink, background: P.gold, padding: '5px 9px', flexShrink: 0,
        }}>NEW</span>

        <span className="optic-strip-word" style={{
          fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 22,
          letterSpacing: '0.14em', color: P.cream, flexShrink: 0,
        }}>OPTIC</span>

        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute,
          flex: 1, minWidth: 200, lineHeight: 1.5,
        }}>
          The battalion photo network is live — upload from your phone, seen by everyone.
        </span>

        <span className="optic-strip-cta" style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.16em',
          fontWeight: 700, color: P.gold, flexShrink: 0, whiteSpace: 'nowrap',
          borderBottom: `1px solid ${P.gold}`, paddingBottom: 2,
        }}>UPLOAD TO OPTIC →</span>
      </div>

      <style>{`
        .optic-strip:hover .optic-strip-cta { color: ${P.bright}; }
        .optic-strip:hover .optic-strip-word { color: ${P.bright}; }
        .optic-strip-shine { animation: opticStripSweep 4.5s ease-in-out infinite; }
        @keyframes opticStripSweep {
          0%, 100% { transform: translateX(-30%); opacity: 0; }
          45%, 55% { opacity: 1; }
          50% { transform: translateX(30%); }
        }
        @media (max-width: 640px) {
          .optic-strip { padding: 14px 20px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .optic-strip-shine { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </section>
  );
}
