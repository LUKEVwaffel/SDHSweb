import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import TopNav from './components/TopNav';
import Hero from './components/Hero';
// "Picture of the Comp" vote taken down 2026-09-08 — home band, /vote route and
// the TopNav 'vote' entry removed. Files kept on disk (CompPhotoBand,
// CompPhotoVote, useCompPhotoPoll, DISPATCH CompPhotoBallot) so a future comp
// can restore it by re-adding this import + the band + the /vote route.
// import CompPhotoBand from './components/CompPhotoBand';
import TabGrid from './components/TabGrid';
import Bulletin from './components/Bulletin';
import EventSpotlightBand from './components/EventSpotlightBand';
import RaftingPhotoBand from './components/RaftingPhotoBand';
// OPTIC homepage promo (hero strip + promo band) restored 2026-09-18 for the
// next comp — East Hamilton, 2026-09-19. Popup stays suppressed, see the
// BallSignupPopup/OpticPopup note below (separate decision about not
// stacking nag popups behind CongratsPopup).
import OpticHeroStrip from './components/OpticHeroStrip';
import OpticPromoBand from './components/OpticPromoBand';
// import OpticPopup from './components/OpticPopup'; — see BallSignupPopup note above.
import HomeNewsletterBand from './components/HomeNewsletterBand';
import Footer from './components/Footer';
import TabPlaceholder from './components/TabPlaceholder';
import CadetManual from './components/CadetManual';
import CreedHub from './components/creed/CreedHub';
import Raiders from './components/Raiders';
import CompGallery from './components/raiders/CompGallery';
import RaftingGallery from './components/rafting/RaftingGallery';
import RaiderTeam from './components/RaiderTeam';
import Rifle from './components/Rifle';
import RifleSignup from './components/rifle/RifleSignup';
import RifleSignupsPortal from './components/rifle/RifleSignupsPortal';
import RiflePortal from './components/rifle/portal/RiflePortal';
import Staff from './components/Staff';
import EventsPage from './components/EventsPage';
import SubmitHub from './components/SubmitHub';
import Companies from './components/Companies';
import About from './components/About';
import CommandProfile from './components/CommandProfile';
import BattalionCommand from './components/BattalionCommand';
import Admin from './components/admin';
import ReviewPortal from './components/review/ReviewPortal';
import TvKiosk from './components/tv/TvKiosk';
import TvRangeKiosk from './components/tv/TvRangeKiosk';
import RaiderParentWelcome from './components/tv/RaiderParentWelcome';
import CongratsPopup from './components/CongratsPopup';
// "Picture of the Comp" vote taken down 2026-09-08 — see the CompPhotoBand note
// up top. Restore this import + the /vote route below to bring it back.
// import CompPhotoVote from './components/CompPhotoVote';
import EventFeedbackForm from './components/EventFeedbackForm';
import EventFeedbackPicker from './components/EventFeedbackPicker';
import OpticSurvey from './components/OpticSurvey';
import HalloweenMoviePoll from './components/HalloweenMoviePoll';
import BallLanding from './components/ball/BallLanding';
// BallSignupPopup + OpticPopup suppressed 2026-09-12 so the Spring Hill
// Raider Congrats popup (CongratsPopup, always-on) is the only homepage
// takeover for now instead of queuing behind two more nag popups. Files kept
// on disk; re-add these imports + their <Route>-sibling renders below to
// bring them back.
// import BallSignupPopup from './components/ball/BallSignupPopup';
import BallSignupWizard from './components/ball/signup/BallSignupWizard';
import BallVipSignup from './components/ball/signup/BallVipSignup';
import BallGuestVerify from './components/ball/BallGuestVerify';
import BallOpsPortal from './components/ball/ops/BallOpsPortal';
import BallDressPortal from './components/ball/dress/BallDressPortal';
import BallAttirePortal from './components/ball/attire/BallAttirePortal';
import PortalHub from './components/portal/PortalHub';
import Optic from './components/optic/Optic';
import LukeUploadRoute from './components/optic/LukeUpload';
import LukePwaRoute from './components/optic/LukePwa';
import RaiderTv from './components/raidertv/RaiderTv';
import RaiderRemote from './components/raidertv/RaiderRemote';
import WatchingZone from './components/watchzone/WatchingZone';
// import WatchZonePopup from './components/WatchZonePopup'; — taken down 2026-09-26, see the homepage route.
import BallTv from './components/balltv/BallTv';
import VideoTv from './components/videotv/VideoTv';
import RollCounter from './components/rolls/RollCounter';

const TABS = [
  { id: 'cadet-manual', label: 'Cadet Manual',  short: 'MANUAL' },
  { id: 'raiders',      label: 'Raiders',       short: 'RAIDERS' },
  { id: 'rifle',        label: 'Rifle',         short: 'RIFLE' },
  { id: 'academic',     label: 'Academic',      short: 'ACADEMIC' },
  { id: 'drill',        label: 'Drill',         short: 'DRILL' },
];

// /:tabId catch-all — only ever reached for ids not covered by a static
// route above (currently academic/drill). Anything not in TABS redirects
// home instead of rendering a placeholder for an arbitrary string.
function TabRoute() {
  const { tabId } = useParams();
  const tab = TABS.find(t => t.id === tabId);
  if (!tab) return <Navigate to="/" replace />;
  return <TabPlaceholder tab={tab} />;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Admin and Review are self-contained subtrees (own auth gate, own chrome)
  // — bypass TopNav/Footer entirely, same as the old hash early-return.
  if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) return <Admin />;
  if (location.pathname === '/review' || location.pathname.startsWith('/review/')) return <ReviewPortal />;
  // Unified staff-portal login — every non-DISPATCH portal below redirects
  // here instead of showing its own login screen (see each portal's
  // phase === 'login' branch). DISPATCH (/admin) is not part of this.
  if (location.pathname === '/portal' || location.pathname.startsWith('/portal/')) return <PortalHub />;
  // OPTIC comp photo system — three self-contained surfaces, each its own
  // auth/chrome, same early-return pattern as /admin. /rhea is the pre-2.0
  // route name; kept as a redirect for one comp so old installed-PWA links
  // and bookmarks still land in the app.
  if (location.pathname === '/rhea') return <Navigate to="/optic" replace />;
  if (location.pathname === '/optic') return <Optic />;
  if (location.pathname === '/lukeupload') return <LukeUploadRoute />;
  if (location.pathname === '/lukepwa' || location.pathname.startsWith('/lukepwa/')) return <LukePwaRoute />;
  if (location.pathname === '/tv') return <TvKiosk />;
  if (location.pathname === '/tv/range') return <TvRangeKiosk />;
  // Raider film-review: /raidertv is the display (shows a pair code),
  // /raiderremote is the phone that drives it. Self-contained anon routes.
  if (location.pathname === '/raidertv') return <RaiderTv />;
  if (location.pathname === '/raiderremote') return <RaiderRemote />;
  // /watchzone — public Raider film archive, no pairing required. Fullscreen
  // + slow-mo player over the same raider_videos library.
  if (location.pathname === '/watchzone') return <WatchingZone />;
  // /balltv — hallway-TV promo loop for the Military Ball. Read-only slideshow,
  // no remote; reads ball_config + ball_gallery like /ball.
  if (location.pathname === '/balltv') return <BallTv />;
  // /videotv — hallway-TV loop of the East Hamilton OC run (both clips, muted,
  // no remote) followed by the season trophy case. Reads raider_videos (same
  // library /watchzone features from) + RaiderCompetitionResults' SEASON data.
  if (location.pathname === '/videotv') return <VideoTv />;
  if (location.pathname === '/raiderparent') return <RaiderParentWelcome />;
  // /rolls — Texas Roadhouse roll counter, fun one-off group tracker.
  if (location.pathname === '/rolls') return <RollCounter />;
  if (location.pathname === '/feedback') return <EventFeedbackPicker />;
  if (location.pathname.startsWith('/feedback/')) return <EventFeedbackForm />;
  // "Picture of the Comp" vote taken down 2026-09-08 — restore CompPhotoVote to bring it back.
  // if (location.pathname === '/vote') return <CompPhotoVote />;
  if (location.pathname === '/survey') return <OpticSurvey />;
  if (location.pathname === '/halloween') return <HalloweenMoviePoll />;
  if (location.pathname.startsWith('/ball/guest/')) return <BallGuestVerify />;
  if (location.pathname === '/ball/ops' || location.pathname.startsWith('/ball/ops/')) return <BallOpsPortal />;
  if (location.pathname === '/ball/dress' || location.pathname.startsWith('/ball/dress/')) return <BallDressPortal />;
  if (location.pathname === '/ball/attire' || location.pathname.startsWith('/ball/attire/')) return <BallAttirePortal />;
  if (location.pathname === '/rifle/signup-review' || location.pathname.startsWith('/rifle/signup-review/')) return <RifleSignupsPortal />;
  if (location.pathname === '/rifle/portal' || location.pathname.startsWith('/rifle/portal/')) return <RiflePortal />;

  return (
    <div style={{ minHeight: '100vh', background: '#06101F', fontFamily: 'Inter, sans-serif' }}>
      <CongratsPopup />
      <TopNav />

      <Routes>
        <Route path="/" element={(
          <>
            {/* Homepage-only takeovers — mounted here, never on a standalone route.
                BallSignupPopup + OpticPopup suppressed for now (see imports
                above) so CongratsPopup is the only site-wide one.
                WatchZonePopup (Raider OC film) taken down 2026-09-26 ahead of
                Warren County — restore <WatchZonePopup /> to bring it back. */}
            <Hero />
            <OpticHeroStrip />
            {/* "Picture of the Comp" vote band taken down 2026-09-08 — restore <CompPhotoBand /> to bring it back. */}
            <RaftingPhotoBand />
            {/* Disabled via SPOTLIGHT_BAND_ENABLED — kept mounted so re-enabling is a one-flag flip. */}
            <EventSpotlightBand />
            <BattalionCommand />
            <TabGrid />
            <Bulletin />
            <OpticPromoBand />
            <HomeNewsletterBand />
          </>
        )} />
        <Route path="/cadet-manual" element={<CadetManual />} />
        <Route path="/creed" element={<CreedHub />} />
        <Route path="/raiders" element={<Raiders />} />
        <Route path="/raiders/comp" element={<CompGallery />} />
        <Route path="/rafting" element={<RaftingGallery />} />
        <Route path="/raiderteam" element={<RaiderTeam />} />
        <Route path="/rifle" element={<Rifle />} />
        <Route path="/rifle/signup" element={<RifleSignup />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/pictures" element={<Navigate to="/events" replace />} />
        <Route path="/submit" element={<SubmitHub />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/company/:id" element={<Companies />} />
        <Route path="/about" element={<About />} />
        <Route path="/ball" element={<BallLanding />} />
        <Route path="/ball/signup" element={<BallSignupWizard />} />
        <Route path="/ball/vip" element={<BallVipSignup />} />
        <Route path="/profile/:id" element={<CommandProfile />} />
        <Route path="/:tabId" element={<TabRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  );
}
