import { useState } from 'react';
import { P, inter } from './theme';
import Sidebar from './nav/Sidebar';
import TopBar from './nav/TopBar';
import StatusBar from './nav/StatusBar';
import OverviewPanel from './panels/OverviewPanel';
import EventsPanel from './panels/EventsPanel';
import PeoplePanel from './panels/people/PeoplePanel';
import PhotosPanel from './panels/photos/PhotosPanel';
import EmailPanel from './panels/email/EmailPanel';
import MediaPanel from './panels/MediaPanel';
import AdvancedPanel from './panels/advanced/AdvancedPanel';

const SECTION_LABEL = {
  overview: 'OVERVIEW', events: 'EVENTS',
  people: 'PEOPLE', photos: 'PHOTOS', email: 'EMAIL LIST',
  media: 'MEDIA', advanced: 'ADVANCED',
};

export default function Dashboard({ onLogout, adminId }) {
  const [active, setActive] = useState('overview');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: P.ink, fontFamily: inter }}>
      <TopBar adminId={adminId} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar active={active} setActive={setActive} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {active === 'overview' && <OverviewPanel adminId={adminId} goto={setActive} />}
          {active === 'events'   && <EventsPanel adminId={adminId} />}
          {active === 'people'   && <PeoplePanel adminId={adminId} />}
          {active === 'photos'   && <PhotosPanel adminId={adminId} />}
          {active === 'email'    && <EmailPanel adminId={adminId} />}
          {active === 'media'    && <MediaPanel />}
          {active === 'advanced' && <AdvancedPanel adminId={adminId} />}
        </div>
      </div>
      <StatusBar sectionLabel={SECTION_LABEL[active] || active.toUpperCase()} />
    </div>
  );
}
