import { useState } from 'react';
import { TEAMS } from '../../../../lib/teams';
import { P, mono, fs, sp } from '../../theme';
import { Btn } from '../../shared/ui';
import RaiderPolls from './RaiderPolls';
import PhotoSubmissions from './PhotoSubmissions';
import AdminBulkUpload from './AdminBulkUpload';
import TvPhotosPanel from '../tvphotos/TvPhotosPanel';

// Single home for all team photos. SUBMISSIONS is the default — that's where
// every public upload (battalion + specialty teams) lives. Polls are
// voting-teams-only (Raiders today). Bulk upload lets staff post a whole
// batch on behalf of the team, tied to one posted event. TV PHOTOS (Luke-only,
// gated by showTvPhotos from Dashboard.jsx) curates the folders that feed the
// /tv kiosk carousel — kept as one photo library, not a separate top-level tab.
const VOTING_TEAMS = TEAMS.filter((t) => t.voting);

export default function PhotosPanel({ adminId, showTvPhotos = false }) {
  const [tab, setTab] = useState('submissions');

  const tabs = [
    { id: 'submissions', label: 'SUBMISSIONS · ALL PHOTOS' },
    { id: 'bulk', label: 'BULK UPLOAD' },
    ...(showTvPhotos ? [{ id: 'tvphotos', label: 'TV PHOTOS' }] : []),
    ...VOTING_TEAMS.map((t) => ({ id: `polls-${t.id}`, label: `${t.label.toUpperCase()} POLLS` })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <Btn key={t.id} variant={tab === t.id ? 'gold' : 'ghost'} size="sm" onClick={() => setTab(t.id)}>{t.label}</Btn>
        ))}
      </div>
      {tab === 'submissions' && <PhotoSubmissions adminId={adminId} />}
      {tab === 'bulk' && <AdminBulkUpload adminId={adminId} />}
      {tab === 'tvphotos' && showTvPhotos && <TvPhotosPanel adminId={adminId} />}
      {tab === 'polls-raiders' && <RaiderPolls adminId={adminId} />}
      {tab.startsWith('polls-') && tab !== 'polls-raiders' && (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[10] }}>
          POLLS FOR THIS TEAM NOT ENABLED YET
        </div>
      )}
    </div>
  );
}
