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
// OPTIC campaign — dormant between competitions, restore next comp:
//   import OpticHeroStrip from './components/OpticHeroStrip';
//   import OpticPromoBand from './components/OpticPromoBand';
//   import OpticPopup from './components/OpticPopup';
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
import BallLanding from './components/ball/BallLanding';
import BallSignupPopup from './components/ball/BallSignupPopup';
import BallSignupWizard from './components/ball/signup/BallSignupWizard';
import BallGuestVerify from './components/ball/BallGuestVerify';
import BallOpsPortal from './components/ball/ops/BallOpsPortal';
import BallDressPortal from './components/ball/dress/BallDressPortal';
import BallAttirePortal from './components/ball/attire/BallAttirePortal';
import Optic from './components/optic/Optic';
import LukeUploadRoute from './components/optic/LukeUpload';
import LukePwaRoute from './components/optic/LukePwa';
import RaiderTv from './components/raidertv/RaiderTv';
import RaiderRemote from './components/raidertv/RaiderRemote';
import BallTv from './components/balltv/BallTv';

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
  // /balltv — hallway-TV promo loop for the Military Ball. Read-only slideshow,
  // no remote; reads ball_config + ball_gallery like /ball.
  if (location.pathname === '/balltv') return <BallTv />;
  if (location.pathname === '/raiderparent') return <RaiderParentWelcome />;
  if (location.pathname === '/feedback') return <EventFeedbackPicker />;
  if (location.pathname.startsWith('/feedback/')) return <EventFeedbackForm />;
  // "Picture of the Comp" vote taken down 2026-09-08 — restore CompPhotoVote to bring it back.
  // if (location.pathname === '/vote') return <CompPhotoVote />;
  if (location.pathname === '/survey') return <OpticSurvey />;
  if (location.pathname.startsWith('/ball/guest/')) return <BallGuestVerify />;
  if (location.pathname === '/ball/ops' || location.pathname.startsWith('/ball/ops/')) return <BallOpsPortal />;
  if (location.pathname === '/ball/dress' || location.pathname.startsWith('/ball/dress/')) return <BallDressPortal />;
  if (location.pathname === '/ball/attire' || location.pathname.startsWith('/ball/attire/')) return <BallAttirePortal />;

  return (
    <div style={{ minHeight: '100vh', background: '#06101F', fontFamily: 'Inter, sans-serif' }}>
      <CongratsPopup />
      <TopNav />

      <Routes>
        <Route path="/" element={(
          <>
            {/* Homepage-only takeover — mounted here, never on a standalone route. */}
            <BallSignupPopup />
            <Hero />
            {/* "Picture of the Comp" vote band taken down 2026-09-08 — restore <CompPhotoBand /> to bring it back. */}
            <RaftingPhotoBand />
            {/* Disabled via SPOTLIGHT_BAND_ENABLED — kept mounted so re-enabling is a one-flag flip. */}
            <EventSpotlightBand />
            <BattalionCommand />
            <TabGrid />
            <Bulletin />
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
        <Route path="/staff" element={<Staff />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/pictures" element={<Navigate to="/events" replace />} />
        <Route path="/submit" element={<SubmitHub />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/company/:id" element={<Companies />} />
        <Route path="/about" element={<About />} />
        <Route path="/ball" element={<BallLanding />} />
        <Route path="/ball/signup" element={<BallSignupWizard />} />
        <Route path="/profile/:id" element={<CommandProfile />} />
        <Route path="/:tabId" element={<TabRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  );
}
