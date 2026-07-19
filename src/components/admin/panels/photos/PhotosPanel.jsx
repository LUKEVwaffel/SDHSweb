import { useState } from 'react';
import { TEAMS } from '../../../../lib/teams';
import { P, mono } from '../../theme';
import { Btn } from '../../shared/ui';
import RaiderPolls from './RaiderPolls';
import RaiderGallery from './RaiderGallery';

// Single home for all team photos. Polls are voting-teams-only (Raiders today —
// flip `voting: true` in lib/teams.js + add a tab to expand). Gallery is
// team-aware for every team via its own in-panel team picker.
const VOTING_TEAMS = TEAMS.filter((t) => t.voting);

export default function PhotosPanel({ adminId }) {
  const [tab, setTab] = useState('polls-raiders');

  const tabs = [
    ...VOTING_TEAMS.map((t) => ({ id: `polls-${t.id}`, label: `${t.label.toUpperCase()} POLLS` })),
    { id: 'gallery', label: 'GALLERY · ALL TEAMS' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <Btn key={t.id} variant={tab === t.id ? 'gold' : 'ghost'} onClick={() => setTab(t.id)} style={{ fontSize: 9 }}>{t.label}</Btn>
        ))}
      </div>
      {tab === 'polls-raiders' && <RaiderPolls adminId={adminId} />}
      {tab === 'gallery' && <RaiderGallery />}
      {tab.startsWith('polls-') && tab !== 'polls-raiders' && (
        <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 40 }}>
          POLLS FOR THIS TEAM NOT ENABLED YET
        </div>
      )}
    </div>
  );
}
