import { useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';
import { getTeam } from '../lib/teams';
import TeamPageMobile from './team/TeamPageMobile';

const P = {
  ink: '#06101F',
  navyDeep: '#0A1628',
  gold: '#C9A961',
  cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)',
  hairline: 'rgba(201,169,97,0.25)',
};

export default function TabPlaceholder({ tab }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Specialty teams without a dedicated desktop page yet (academic, drill)
  // get the shared mobile team template instead of the generic placeholder.
  // Desktop keeps the exact placeholder below, unchanged.
  if (isMobile && getTeam(tab.id)) {
    return <TeamPageMobile teamId={tab.id} />;
  }

  return (
    <section style={{
      background: P.ink, minHeight: 720, padding: '80px 32px',
      borderBottom: `1px solid ${P.hairline}`,
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <button onClick={() => navigate('/')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: P.gold, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, letterSpacing: '0.28em', padding: 0, marginBottom: 24,
          }}>← BACK TO HOME</button>

        <div style={{
          color: P.gold, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, letterSpacing: '0.32em', marginBottom: 16,
        }}>// {tab.short}</div>
        <h1 style={{
          color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
          fontSize: 88, letterSpacing: '0.02em', margin: 0, lineHeight: 0.92,
        }}>{tab.label.toUpperCase()}</h1>
        <p style={{
          color: P.mute, fontFamily: 'Inter, sans-serif',
          fontSize: 16, lineHeight: 1.6, marginTop: 24, maxWidth: 640,
        }}>
          This section is reserved for the {tab.label} content. Tell me what to put
          here: rosters, schedules, photo archives, downloadable PDFs, instructor
          bios, and I'll build the full layout.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, marginTop: 64,
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: P.navyDeep, border: `1px solid ${P.hairline}`,
              padding: '28px 22px', minHeight: 200,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                letterSpacing: '0.28em', color: P.gold, opacity: 0.6,
              }}>PLACEHOLDER · 0{i}</div>
              <div style={{
                color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                fontSize: 22, letterSpacing: '0.06em', marginTop: 'auto',
              }}>CONTENT BLOCK</div>
              <div style={{
                color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 12,
                marginTop: 8, lineHeight: 1.5,
              }}>Awaiting content for {tab.label.toLowerCase()}.</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
