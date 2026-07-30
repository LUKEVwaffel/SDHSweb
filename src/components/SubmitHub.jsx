import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoUploader from './PhotoUploader';
import RaiderVoting from './RaiderVoting';
import TeamGallery from './TeamGallery';
import { TEAMS, getTeam } from '../lib/teams';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
const inter = 'Inter, sans-serif';

export default function SubmitHub() {
  const navigate = useNavigate();
  const [browseTeam, setBrowseTeam] = useState('raiders');
  const [refreshKey, setRefreshKey] = useState(0);
  const team = getTeam(browseTeam);

  return (
    <section style={{ background: P.ink, minHeight: '100vh', fontFamily: inter }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.hair}`, padding: '60px 40px 36px', maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => navigate('/')} style={backBtn}>← HOME</button>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.32em', marginBottom: 12 }}>
          // OPTIC · PHOTO SUBMISSIONS
        </div>
        <h1 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 66, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.9 }}>
          SUBMIT PHOTOS
        </h1>
        <p style={{ color: P.mute, fontSize: 15, lineHeight: 1.7, maxWidth: 640, margin: '18px 0 0' }}>
          Parents, photographers, and cadets — add your competition and practice photos for any
          specialty team. Raider event photos go straight into the Funny / Aura / Team-Leading vote.
          You don't have to be a raider to submit or to vote.
        </p>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 40px 90px' }}>
        {/* Uploader */}
        <div style={{ maxWidth: 640, margin: '0 auto 56px' }}>
          <PhotoUploader onUploaded={(photo) => { setBrowseTeam(photo.team); setRefreshKey((k) => k + 1); }} />
        </div>

        {/* Browse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 22, letterSpacing: '0.06em', color: P.cream }}>BROWSE PHOTOS</div>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
        </div>

        {/* Team tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
          {TEAMS.map((t) => {
            const on = browseTeam === t.id;
            return (
              <button key={t.id} onClick={() => setBrowseTeam(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  background: on ? 'rgba(201,169,97,0.08)' : 'transparent',
                  border: `1px solid ${on ? P.hairStrong : P.hair}`,
                  color: on ? P.cream : P.mute, padding: '9px 16px',
                  fontFamily: mono, fontSize: 11, letterSpacing: '0.12em',
                }}>
                <span style={{ width: 8, height: 8, background: t.accent }} />
                {t.label.toUpperCase()}
                {t.voting && <span style={{ fontSize: 8, color: P.gold }}>· VOTE</span>}
              </button>
            );
          })}
        </div>

        {/* Voting for raiders, plain gallery otherwise */}
        {team?.voting
          ? <RaiderVoting key={`vote-${refreshKey}`} compact />
          : <TeamGallery key={`gal-${browseTeam}-${refreshKey}`} teamId={browseTeam} showSubmit={false} />}
      </div>
    </section>
  );
}

const backBtn = { background: 'none', border: 'none', color: P.gold, cursor: 'pointer', fontFamily: mono, fontSize: 10, letterSpacing: '0.28em', padding: 0, marginBottom: 20, display: 'block' };
