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
import MessagesPanel from './panels/messages/MessagesPanel';
import TvRemotePanel from './panels/tvremote/TvRemotePanel';
import BetaFeaturesPanel from './panels/beta/BetaFeaturesPanel';
import CheckinPanel from './panels/CheckinPanel';

// Push-to-TV / TV Photos is intentionally restricted to this one account —
// a deliberate departure from DISPATCH's usual "no per-email logic"
// convention (see admin_roles.sql), per explicit product decision. Matches
// public.is_luke() in supabase/tv_photos.sql; keep both in sync if this ever
// changes. This is a render-gate ONLY — the real enforcement is server-side
// RLS/edge functions, same split as every other admin surface here.
const LUKE_EMAIL = 'lukevetsch77@gmail.com';

const SECTION_LABEL = {
  overview: 'OVERVIEW', events: 'EVENTS', aars: 'AAR TRACKER',
  people: 'PEOPLE', photos: 'PHOTOS', questions: 'FAQ QUESTIONS', email: 'EMAIL LIST',
  media: 'MEDIA', advanced: 'ADVANCED', account: 'MY ACCOUNT', messages: 'MESSAGES',
  tvremote: 'TV REMOTE', beta: 'BETA FEATURES', checkin: 'SITE CHECK-IN',
};

// Which sections each role may see. s5 is scoped to the battalion calendar
// plus the Raiders team calendar (OpticSend requires S-5 to tag Raiders
// events as photo events — see supabase/opticsend.sql SECTION 9). AAR
// tracking is S-5 only (is_s5() on RLS, see supabase/aars.sql) — s6 gets no
// nav entry and no RLS grant. s5 has no Advanced access, so 'account' gives
// them a self-only PIN/Touch ID surface without the full roster tool — same
// self-only enforcement AccountsPanel uses. 'messages' is the one section
// every admin gets regardless of role — DISPATCH chat is internal staff
// coordination, not tied to the s6/s5 permission split.
// 'tvremote' is on every role's list — any signed-in admin can use it, no
// gate. Every /tv kiosk is now a pure display with no on-site control at
// all, so DISPATCH is the ONLY way to change the schedule, featured team,
// widget, shoutout, or push an Emergency message — restricting it to one
// role would mean nobody else could fix a wrong schedule or push a same-day
// cancellation.
// TV Photos is not a section of its own — it's a Luke-only tab inside the
// 'photos' section (see showTvPhotos below), since it's restricted to one
// account rather than a role.
// 'checkin' (site feedback survey responses, see site_checkin.sql) IS its
// own top-level section but is appended to `allowed` only for isLuke below,
// not listed in either role's array — same one-account restriction as TV
// Photos, matching public.is_luke() RLS on site_checkin_responses.
// 'aars' is appended for isLuke too, same pattern — but unlike checkin/TV
// Photos this is read-only (AarsPanel's `readOnly` prop below), not full
// access: S-5 stays the only role that can draft/upload/edit/archive AARs,
// matching aars_select_luke (SELECT only) vs aars_all_s5 (ALL) in aars.sql.
const ROLE_SECTIONS = {
  s6: ['overview', 'events', 'people', 'photos', 'questions', 'email', 'media', 'messages', 'advanced', 'tvremote', 'beta'],
  s5: ['events', 'aars', 'messages', 'account', 'tvremote'],
};

export default function Dashboard({ onLogout, adminId, role = 's6' }) {
  const isLuke = (adminId || '').toLowerCase() === LUKE_EMAIL;
  const allowed = [...(ROLE_SECTIONS[role] || ROLE_SECTIONS.s6), ...(isLuke ? ['checkin', 'aars'] : [])];
  // S-5 has full events parity with S-6 (every team) — see
  // supabase/events_s5_full_access.sql for the matching RLS grant.
  const allowedTeams = undefined;
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
          {section === 'aars'     && <AarsPanel adminId={adminId} readOnly={role !== 's5'} />}
          {section === 'people'   && <PeoplePanel adminId={adminId} />}
          {section === 'photos'   && <PhotosPanel adminId={adminId} showTvPhotos={isLuke} />}
          {section === 'questions' && <QuestionsPanel />}
          {section === 'email'    && <EmailPanel adminId={adminId} />}
          {section === 'media'    && <MediaPanel adminId={adminId} />}
          {section === 'advanced' && <AdvancedPanel adminId={adminId} />}
          {section === 'account'  && <SelfAccountPanel adminId={adminId} />}
          {section === 'messages' && <MessagesPanel adminId={adminId} />}
          {section === 'tvremote' && <TvRemotePanel />}
          {section === 'beta'     && <BetaFeaturesPanel adminId={adminId} />}
          {section === 'checkin'  && isLuke && <CheckinPanel />}
        </div>
      </div>
      <StatusBar sectionLabel={SECTION_LABEL[section] || section.toUpperCase()} />
    </div>
  );
}
