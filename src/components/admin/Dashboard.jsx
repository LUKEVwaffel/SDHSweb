import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { P, inter, sp, ease, glass } from './theme';
import Sidebar from './nav/Sidebar';
import { SIDEBAR_CONTENT_OFFSET } from './nav/navItems';
import TopBar from './nav/TopBar';
import useViewportBand from '../../hooks/useViewportBand';
import TicketDeliveryPanel from './panels/TicketDeliveryPanel';
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
import RaiderTvPanel from './panels/raidertv/RaiderTvPanel';
import BetaFeaturesPanel from './panels/beta/BetaFeaturesPanel';
import RaftingPanel from './panels/rafting/RaftingPanel';
import CheckinPanel from './panels/CheckinPanel';
import OpticSurveyPanel from './panels/OpticSurveyPanel';
import EventFeedbackPanel from './panels/feedback/EventFeedbackPanel';
import BallPanel from './panels/ball/BallPanel';
import BallAllergyPanel from './panels/ball/BallAllergyPanel';
import RifleSignupsPanel from './panels/RifleSignupsPanel';
import PortalAccessPanel from './panels/portal/PortalAccessPanel';
import HalloweenMoviePollPanel from './panels/HalloweenMoviePollPanel';
import ChristmasMusicPollPanel from './panels/ChristmasMusicPollPanel';
import BoardsPanel from './panels/boards/BoardsPanel';
import PausedDispatchAiPanel from './panels/ai/PausedDispatchAiPanel';

// Push-to-TV / TV Photos is intentionally restricted to this one account —
// a deliberate departure from DISPATCH's usual "no per-email logic"
// convention (see admin_roles.sql), per explicit product decision. Matches
// public.is_luke() in supabase/tv_photos.sql; keep both in sync if this ever
// changes. This is a render-gate ONLY — the real enforcement is server-side
// RLS/edge functions, same split as every other admin surface here.
const LUKE_EMAIL = 'lukevetsch77@gmail.com';

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
// 'feedback' (cadet/staff event feedback + DISPATCH AI analysis, see
// supabase/event_feedback.sql) is now S-5's — they are the AAR/feedback
// owners. Full parity with S-6: view submissions + run DISPATCH AI. Matching
// server-side grants: event_feedback_select_s5 / event_feedback_analysis_select_s5
// in event_feedback.sql, and the caller.role check in
// supabase/functions/analyze-event-feedback (both accept s5 now).
// 'bc' = Battalion Commander (Aiden O'Brien). Range TV control ONLY - the TV
// Remote panel and nothing else. Inside that panel he is further scoped to
// the Range screen (see TvRemotePanel's isBC handling). Server-side match:
// supabase/dispatch_bc_role.sql widens ONLY the tv_notices write policy + the
// tv_daily_settings emergency guard to accept is_bc(); is_admin()/is_s6()/
// is_s5() are untouched, so every other admin table stays locked to him.
// 'ai' (DISPATCH AI, supabase/functions/dispatch-ai-chat) is S-6/S-5 only,
// matching is_admin() server side (admin_roles.sql) — not given to bc, same
// one-section restriction as every other bc account. Listed second in both
// arrays (not first) deliberately — allowed[0] sets the default route for
// a bare /admin hit (Ticket Delivery for S-6, Events for S-5). Sidebar.jsx
// still pins DISPATCH AI at the top regardless of this array's order.
const ROLE_SECTIONS = {
  s6: ['ticketdelivery', 'ai', 'account', 'events', 'people', 'photos', 'questions', 'email', 'media', 'messages', 'advanced', 'tvremote', 'raidertv', 'beta', 'feedback', 'ball', 'ballallergy', 'riflesignups', 'portalaccess', 'halloween', 'poll', 'boards'],
  s5: ['events', 'ai', 'aars', 'feedback', 'messages', 'account', 'tvremote', 'ballallergy', 'poll'],
  bc: ['tvremote'],
};

export default function Dashboard({ onLogout, adminId, role = 's6' }) {
  const isLuke = (adminId || '').toLowerCase() === LUKE_EMAIL;
  const allowed = [...(ROLE_SECTIONS[role] || ROLE_SECTIONS.s6), ...(isLuke ? ['checkin', 'aars', 'opticsurvey'] : [])];
  // S-5 has full events parity with S-6 (every team) — see
  // supabase/events_s5_full_access.sql for the matching RLS grant.
  const allowedTeams = undefined;
  const location = useLocation();

  // Sidebar display mode (see Sidebar.jsx): desktop honors the user's own
  // collapse toggle, tablet starts as an expandable rail, and phone is a
  // slide-over drawer that reserves no layout width. Lifted here (rather
  // than owned inside Sidebar) because TopBar's new drawer-open button and
  // the content area's left offset both need to agree with Sidebar on the
  // current mode.
  const band = useViewportBand();
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarMode = band === 'phone' ? 'drawer' : band === 'tablet' ? (tabletExpanded ? 'expanded' : 'rail') : (manualCollapsed ? 'rail' : 'expanded');
  const contentOffset = SIDEBAR_CONTENT_OFFSET[sidebarMode];

  const requestedSection = location.pathname.replace(/^\/admin\/?/, '');
  const section = requestedSection === 'overview' ? 'ticketdelivery' : requestedSection;

  // A bare /admin hit, an unknown section, or a role-disallowed section
  // (e.g. s5 typing /admin/advanced directly) redirects synchronously —
  // before any panel below ever mounts — instead of rendering then bouncing.
  if (requestedSection === 'overview') {
    return <Navigate to="/admin/ticketdelivery" replace />;
  }
  if (!allowed.includes(section)) {
    return <Navigate to={`/admin/${allowed[0]}`} replace />;
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: inter,
      position: 'relative', background: `${glass.bgGlow}, ${P.ink}`,
    }}>
      {/* Faint grid texture, masked to a soft radial so it fades out toward
          the edges instead of tiling harshly to the corners — matches the
          mockup exactly. Sits above the glow, below everything else. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.22, zIndex: 0,
        backgroundImage: glass.gridTexture, backgroundSize: '64px 64px',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 55% 15%, black 0%, transparent 75%)',
        maskImage: 'radial-gradient(ellipse 60% 50% at 55% 15%, black 0%, transparent 75%)',
      }} />
      <TopBar accountKey={adminId} notificationsEnabled={role === 's6' || role === 's5'} showMenuButton={band === 'phone'} onOpenMenu={() => setDrawerOpen(true)} contentOffset={contentOffset}  />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          active={section} allowed={allowed} role={role} adminId={adminId} onLogout={onLogout} band={band}
          manualCollapsed={band === 'tablet' ? !tabletExpanded : manualCollapsed} onToggleCollapsed={() => band === 'tablet' ? setTabletExpanded(expanded => !expanded) : setManualCollapsed(collapsed => !collapsed)}
          drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)}
        />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: section === 'ai' ? 'hidden' : 'auto', padding: section === 'ai' ? '8px 20px 12px' : `${sp[6]}px ${sp[8]}px`, paddingLeft: contentOffset + (section === 'ai' ? (band === 'phone' ? 12 : 20) : sp[8]), transition: `padding-left 0.28s ${ease}` }}>
        <div style={{ maxWidth: 1500, width: '100%', margin: '0 auto', ...(section === 'ai' ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' } : {}) }}>
          {section === 'ai'       && <PausedDispatchAiPanel role={role} />}
          {section === 'ticketdelivery' && <TicketDeliveryPanel />}
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
          {section === 'tvremote' && <TvRemotePanel adminId={adminId} role={role} />}
          {section === 'raidertv' && <RaiderTvPanel adminId={adminId} />}
          {section === 'beta'     && <BetaFeaturesPanel adminId={adminId} />}
          {section === 'rafting'  && <RaftingPanel adminId={adminId} />}
          {section === 'checkin'  && isLuke && <CheckinPanel />}
          {section === 'opticsurvey' && isLuke && <OpticSurveyPanel />}
          {section === 'feedback' && <EventFeedbackPanel />}
          {section === 'ball'     && <BallPanel adminId={adminId} />}
          {section === 'ballallergy' && <BallAllergyPanel />}
          {section === 'riflesignups' && <RifleSignupsPanel />}
          {section === 'boards' && <BoardsPanel />}
          {section === 'portalaccess' && <PortalAccessPanel />}
          {section === 'halloween' && <HalloweenMoviePollPanel />}
          {section === 'poll' && <ChristmasMusicPollPanel canManage={role === 's6'} />}
        </div>
        </div>
      </div>
    </div>
  );
}
