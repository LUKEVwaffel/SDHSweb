import { useState } from 'react';
import { P, inter, sp } from './theme';
import Sidebar from './nav/Sidebar';
import TopBar from './nav/TopBar';
import StatusBar from './nav/StatusBar';
import OverviewPanel from './panels/OverviewPanel';
import EventsPanel from './panels/EventsPanel';
import PeoplePanel from './panels/people/PeoplePanel';
import PhotosPanel from './panels/photos/PhotosPanel';
import EmailPanel from './panels/email/EmailPanel';
import MediaPanel from './panels/MediaPanel';
import AchievementsPanel from './panels/achievements/AchievementsPanel';
import AdvancedPanel from './panels/advanced/AdvancedPanel';

const SECTION_LABEL = {
  overview: 'OVERVIEW', events: 'EVENTS',
  people: 'PEOPLE', photos: 'PHOTOS', email: 'EMAIL LIST',
  media: 'MEDIA', achievements: 'ACHIEVEMENTS', advanced: 'ADVANCED',
};

// Which sections each role may see. s5 is scoped to the battalion calendar only.
const ROLE_SECTIONS = {
  s6: ['overview', 'events', 'people', 'photos', 'email', 'media', 'achievements', 'advanced'],
  s5: ['events'],
};

export default function Dashboard({ onLogout, adminId, role = 's6' }) {
  const allowed = ROLE_SECTIONS[role] || ROLE_SECTIONS.s6;
  const [active, setActive] = useState(allowed[0]);
  const battalionOnly = role === 's5';

  // Never render a panel the role isn't allowed (guards a stale active id too).
  const current = allowed.includes(active) ? active : allowed[0];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: P.ink, fontFamily: inter }}>
      <TopBar adminId={adminId} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar active={current} setActive={setActive} allowed={allowed} />
        <div style={{ flex: 1, overflowY: 'auto', padding: `${sp[6]}px ${sp[8]}px`, maxWidth: 1500, width: '100%', margin: '0 auto' }}>
          {current === 'overview' && <OverviewPanel adminId={adminId} goto={setActive} />}
          {current === 'events'   && <EventsPanel adminId={adminId} battalionOnly={battalionOnly} />}
          {current === 'people'   && <PeoplePanel adminId={adminId} />}
          {current === 'photos'   && <PhotosPanel adminId={adminId} />}
          {current === 'email'    && <EmailPanel adminId={adminId} />}
          {current === 'media'    && <MediaPanel adminId={adminId} />}
          {current === 'achievements' && <AchievementsPanel adminId={adminId} />}
          {current === 'advanced' && <AdvancedPanel adminId={adminId} />}
        </div>
      </div>
      <StatusBar sectionLabel={SECTION_LABEL[current] || current.toUpperCase()} />
    </div>
  );
}
