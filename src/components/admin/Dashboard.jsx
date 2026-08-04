import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { P, inter, sp } from './theme';
import Sidebar from './nav/Sidebar';
import TopBar from './nav/TopBar';
import StatusBar from './nav/StatusBar';
import OverviewPanel from './panels/OverviewPanel';
import EventsPanel from './panels/EventsPanel';
import AarsPanel from './panels/aars/AarsPanel';
import PeoplePanel from './panels/people/PeoplePanel';
import PhotosPanel from './panels/photos/PhotosPanel';
import QuestionsPanel from './panels/QuestionsPanel';
import EmailPanel from './panels/email/EmailPanel';
import MediaPanel from './panels/MediaPanel';
import AdvancedPanel from './panels/advanced/AdvancedPanel';
import SelfAccountPanel from './panels/SelfAccountPanel';

const SECTION_LABEL = {
  overview: 'OVERVIEW', events: 'EVENTS', aars: 'AAR TRACKER',
  people: 'PEOPLE', photos: 'PHOTOS', questions: 'FAQ QUESTIONS', email: 'EMAIL LIST',
  media: 'MEDIA', advanced: 'ADVANCED', account: 'MY ACCOUNT',
};

// Which sections each role may see. s5 is scoped to the battalion calendar
// plus the Raiders team calendar (OpticSend requires S-5 to tag Raiders
// events as photo events — see supabase/opticsend.sql SECTION 9). AAR
// tracking is S-5 only (is_s5() on RLS, see supabase/aars.sql) — s6 gets no
// nav entry and no RLS grant. s5 has no Advanced access, so 'account' gives
// them a self-only PIN/Touch ID surface without the full roster tool — same
// self-only enforcement AccountsPanel uses.
const ROLE_SECTIONS = {
  s6: ['overview', 'events', 'people', 'photos', 'questions', 'email', 'media', 'advanced'],
  s5: ['events', 'aars', 'account'],
};

// team values s5 may create/edit/view events for. '' = battalion (team NULL).
// Matches the RLS grant in opticsend.sql SECTION 9 exactly — expand both
// together if s5's scope ever grows.
const S5_ALLOWED_TEAMS = ['', 'raiders'];

export default function Dashboard({ onLogout, adminId, role = 's6' }) {
  const allowed = ROLE_SECTIONS[role] || ROLE_SECTIONS.s6;
  const allowedTeams = role === 's5' ? S5_ALLOWED_TEAMS : undefined;
  const navigate = useNavigate();
  const location = useLocation();

  const section = location.pathname.replace(/^\/admin\/?/, '');
  const goto = (next) => navigate(`/admin/${next}`);

  // A bare /admin hit, an unknown section, or a role-disallowed section
  // (e.g. s5 typing /admin/advanced directly) redirects synchronously —
  // before any panel below ever mounts — instead of rendering then bouncing.
  if (!allowed.includes(section)) {
    return <Navigate to={`/admin/${allowed[0]}`} replace />;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: P.ink, fontFamily: inter }}>
      <TopBar adminId={adminId} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar active={section} allowed={allowed} />
        <div style={{ flex: 1, overflowY: 'auto', padding: `${sp[6]}px ${sp[8]}px`, maxWidth: 1500, width: '100%', margin: '0 auto' }}>
          {section === 'overview' && <OverviewPanel adminId={adminId} goto={goto} />}
          {section === 'events'   && <EventsPanel adminId={adminId} allowedTeams={allowedTeams} />}
          {section === 'aars'     && <AarsPanel adminId={adminId} />}
          {section === 'people'   && <PeoplePanel adminId={adminId} />}
          {section === 'photos'   && <PhotosPanel adminId={adminId} />}
          {section === 'questions' && <QuestionsPanel />}
          {section === 'email'    && <EmailPanel adminId={adminId} />}
          {section === 'media'    && <MediaPanel adminId={adminId} />}
          {section === 'advanced' && <AdvancedPanel adminId={adminId} />}
          {section === 'account'  && <SelfAccountPanel adminId={adminId} />}
        </div>
      </div>
      <StatusBar sectionLabel={SECTION_LABEL[section] || section.toUpperCase()} />
    </div>
  );
}
