import { useNavigate } from 'react-router-dom';
import { TEAMS } from '../../lib/teams';
import TeamGallery from '../TeamGallery';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
};

// Mobile-only page for specialty teams that have no dedicated desktop
// component yet (academic, drill — see TabPlaceholder.jsx). Rifle keeps its
// own real commander/season data and handles its own mobile layout inline;
// this shares only what's genuinely backed by data across all teams: the
// switcher, the team blurb from lib/teams.js, and the real photo gallery.
// No commander/season card here — that data doesn't exist yet for these two
// teams, so it's an honest "TBD" panel rather than fabricated content.
export default function TeamPageMobile({ teamId }) {
  const navigate = useNavigate();
  const switchable = TEAMS.filter((t) => t.id !== 'raiders');
  const current = TEAMS.find((t) => t.id === teamId) || switchable[0];

  return (
    <div style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '24px 20px 40px' }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.24em',
          padding: 0, marginBottom: 18,
        }}>← HOME</button>

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.28em', opacity: 0.8 }}>
          SPECIALTY TEAM
        </div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 44, color: P.cream, letterSpacing: '0.03em', lineHeight: 0.95, marginTop: 8 }}>
          {current.label.toUpperCase()} TEAM
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {switchable.map((t) => {
            const active = t.id === teamId;
            return (
              <button key={t.id} onClick={() => navigate(`/${t.route}`)} style={{
                background: active ? 'rgba(201,169,97,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(201,169,97,0.5)' : P.hair}`,
                color: active ? P.cream : P.mute,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
                padding: '8px 12px', cursor: 'pointer',
              }}>{t.label.toUpperCase()}</button>
            );
          })}
        </div>

        <p style={{ color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: '13.5px', lineHeight: 1.7, margin: '20px 0 0' }}>
          {current.blurb}.
        </p>

        <div style={{ border: `1px solid ${P.hair}`, background: P.deep, marginTop: 22, padding: '30px 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.24em', opacity: 0.75, marginBottom: 8 }}>
            // {current.label.toUpperCase()} · COMMANDER
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 18, color: P.cream, letterSpacing: '0.08em' }}>
            AWAITING ASSIGNMENT
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', color: P.mute, lineHeight: 1.6, marginTop: 8 }}>
            Team leadership posts here once entered.
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.2em', opacity: 0.75, marginBottom: 14 }}>
            // GALLERY
          </div>
          <TeamGallery teamId={teamId} />
        </div>
      </div>
    </div>
  );
}
