import { useState } from 'react';
import { TEAMS } from '../../../../lib/teams';
import { P, mono, fs, sp } from '../../theme';
import { Btn } from '../../shared/ui';
import RaiderPolls from './RaiderPolls';
import RaiderGallery from './RaiderGallery';
import PhotoSubmissions from './PhotoSubmissions';

// Single home for all team photos. SUBMISSIONS is the default — that's where
// every public upload (battalion + specialty teams) lives. Polls are
// voting-teams-only (Raiders today). Gallery is the curated "last year" set.
const VOTING_TEAMS = TEAMS.filter((t) => t.voting);

export default function PhotosPanel({ adminId }) {
  const [tab, setTab] = useState('submissions');

  const tabs = [
    { id: 'submissions', label: 'SUBMISSIONS · ALL PHOTOS' },
    ...VOTING_TEAMS.map((t) => ({ id: `polls-${t.id}`, label: `${t.label.toUpperCase()} POLLS` })),
    { id: 'gallery', label: 'CURATED GALLERY' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <Btn key={t.id} variant={tab === t.id ? 'gold' : 'ghost'} size="sm" onClick={() => setTab(t.id)}>{t.label}</Btn>
        ))}
      </div>
      {tab === 'submissions' && <PhotoSubmissions adminId={adminId} />}
      {tab === 'polls-raiders' && <RaiderPolls adminId={adminId} />}
      {tab === 'gallery' && <RaiderGallery />}
      {tab.startsWith('polls-') && tab !== 'polls-raiders' && (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[10] }}>
          POLLS FOR THIS TEAM NOT ENABLED YET
        </div>
      )}
    </div>
  );
}
