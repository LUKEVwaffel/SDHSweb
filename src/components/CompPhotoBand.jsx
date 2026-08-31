import { useNavigate } from 'react-router-dom';
import { useCompPhotoPoll } from '../hooks/useCompPhotoPoll';
import { CONGRATS_MEET } from '../lib/tvCongratsData';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.25)',
};

// Home-page band that replaces the OPTIC hero strip + promo band between
// competitions. While voting is open it's a "you can't miss it" bar pointing
// at /vote; once Luke declares a winner in DISPATCH it becomes the winning
// photo. Renders nothing until a ballot exists, so the home page stays clean.
export default function CompPhotoBand() {
  const navigate = useNavigate();
  const { poll, candidates, winner, isOpen, isClosed, loading } = useCompPhotoPoll();

  if (loading || !poll || !candidates.length) return null;

  // ── Closed + winner declared → the winning photo ──────────────────────
  if (isClosed && winner) {
    return (
      <section
        onClick={() => navigate('/vote')}
        style={{
          cursor: 'pointer', position: 'relative', overflow: 'hidden',
          borderBottom: `1px solid ${P.hair}`, background: P.deep,
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
        }}
        className="cpb-winner"
      >
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.24em', color: P.gold }}>
            // PICTURE OF THE COMP
          </span>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3.4vw, 40px)', color: P.cream, letterSpacing: '0.03em', lineHeight: 1 }}>
            VOTED BY THE BATTALION
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute }}>
            {CONGRATS_MEET.label} · {winner.voteCount} vote{winner.voteCount === 1 ? '' : 's'}
            {winner.uploaderName ? ` · 📷 ${winner.uploaderName}` : ''}
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: P.gold, borderBottom: `1px solid ${P.gold}`, paddingBottom: 2, alignSelf: 'flex-start', marginTop: 6 }}>
            SEE FULL STANDINGS →
          </span>
        </div>
        <div style={{ minHeight: 200, background: P.navy }}>
          <img src={winner.photoUrl || winner.thumbUrl} alt="Winning photo of the competition"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <style>{`
          @media (max-width: 720px) { .cpb-winner { grid-template-columns: 1fr !important; } }
        `}</style>
      </section>
    );
  }

  // ── Closed, winner not declared yet ──────────────────────────────────
  if (isClosed) {
    return (
      <section style={{
        borderBottom: `1px solid ${P.hair}`, padding: '18px 32px',
        background: `linear-gradient(90deg, ${P.deep} 0%, ${P.navy} 50%, ${P.deep} 100%)`,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em', color: P.ink, background: P.gold, padding: '5px 9px' }}>
            PICTURE OF THE COMP
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute }}>
            Voting has closed — the winning photo will be posted here soon.
          </span>
        </div>
      </section>
    );
  }

  // ── Open (or paused) → vote CTA ──────────────────────────────────────
  return (
    <section
      onClick={() => navigate('/vote')}
      className="cpb-strip"
      style={{
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(90deg, ${P.deep} 0%, ${P.navy} 50%, ${P.deep} 100%)`,
        borderBottom: `1px solid ${P.hair}`, padding: '18px 32px',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.2em',
          color: P.ink, background: P.gold, padding: '5px 9px', flexShrink: 0,
        }}>{isOpen ? 'VOTE NOW' : 'SOON'}</span>

        <span style={{
          fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 22,
          letterSpacing: '0.12em', color: P.cream, flexShrink: 0,
        }}>PICTURE OF THE COMP</span>

        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute,
          flex: 1, minWidth: 200, lineHeight: 1.5,
        }}>
          {candidates.length} finalist shots from {CONGRATS_MEET.label}. Cadets and parents — pick the
          one that wins. Voting closes Friday.
        </span>

        <span className="cpb-cta" style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.16em',
          fontWeight: 700, color: P.gold, flexShrink: 0, whiteSpace: 'nowrap',
          borderBottom: `1px solid ${P.gold}`, paddingBottom: 2,
        }}>{isOpen ? 'CAST YOUR VOTE →' : 'DETAILS →'}</span>
      </div>

      <style>{`
        .cpb-strip:hover .cpb-cta { color: ${P.bright}; }
        @media (max-width: 640px) { .cpb-strip { padding: 14px 20px !important; } }
      `}</style>
    </section>
  );
}
