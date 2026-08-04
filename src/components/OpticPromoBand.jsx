import { useNavigate } from 'react-router-dom';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', faint: 'rgba(244,236,216,0.4)',
  hairline: 'rgba(201,169,97,0.25)',
};

// Home-page photo-upload promo — introduces the OPTIC brand name. Sits
// between the calendar teaser (Bulletin) and the newsletter band: "here's
// what's next" naturally leads into "here's how photos from what already
// happened get seen by everyone." Links straight to /submit — no form here.
export default function OpticPromoBand() {
  const navigate = useNavigate();

  return (
    <section className="optic-section" style={{
      background: `linear-gradient(160deg, ${P.navy} 0%, ${P.deep} 60%, ${P.ink} 100%)`,
      padding: '72px 32px', borderBottom: `1px solid ${P.hairline}`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(135deg, ${P.gold} 0 2px, transparent 2px 22px)`,
      }} />

      <div style={{
        maxWidth: 1400, margin: '0 auto', position: 'relative',
        display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)',
        gap: 56, alignItems: 'center',
      }} className="optic-grid">
        {/* pitch */}
        <div>
          <div style={{
            color: P.gold, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, letterSpacing: '0.32em', marginBottom: 14,
          }}>// PAO · OPTIC PHOTO NETWORK</div>
          <h2 style={{
            color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(34px, 5vw, 52px)', letterSpacing: '0.03em',
            lineHeight: 0.98, margin: '0 0 18px',
          }}>SEEN BY THE<br />WHOLE BATTALION</h2>
          <p style={{
            color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 16,
            lineHeight: 1.7, maxWidth: 480, margin: 0,
          }}>
            Every practice, competition, and formation now feeds <strong style={{ color: P.gold }}>OPTIC</strong>,
            the Official Photo Tracking &amp; Image Collection system. Upload from your phone in
            seconds and it's visible to the whole battalion, not just your team.
          </p>
          <div style={{
            display: 'flex', gap: 20, marginTop: 26, flexWrap: 'wrap',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            letterSpacing: '0.16em', color: P.faint,
          }}>
            <span>◦ PARENTS &amp; CADETS</span>
            <span>◦ EVERY SPECIALTY TEAM</span>
            <span>◦ SECONDS TO UPLOAD</span>
          </div>
        </div>

        {/* CTA card */}
        <div style={{
          background: 'rgba(10,22,40,0.72)', border: `1px solid ${P.hairline}`,
          padding: 32, textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}>
          <div style={{
            fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 44,
            color: P.gold, letterSpacing: '0.06em', lineHeight: 1,
          }}>OPTIC</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute,
            letterSpacing: '0.18em', margin: '10px 0 24px',
          }}>OFFICIAL PHOTO TRACKING &amp; IMAGE COLLECTION</div>
          <button onClick={() => navigate('/submit')} style={{
            background: P.gold, color: P.ink, border: 'none', cursor: 'pointer', width: '100%',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.18em',
            fontWeight: 700, padding: '15px', transition: 'background 0.15s, transform 0.1s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.bright; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = P.gold; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
          >UPLOAD TO OPTIC →</button>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) { .optic-grid { grid-template-columns: 1fr !important; gap: 36px !important; } }
        @media (max-width: 767px) { .optic-section { padding: 32px 20px !important; } }
      `}</style>
    </section>
  );
}
