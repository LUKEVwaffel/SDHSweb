import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import TopNav from './components/TopNav';
import Hero from './components/Hero';
import CompPhotoBand from './components/CompPhotoBand';
import TabGrid from './components/TabGrid';
import Bulletin from './components/Bulletin';
import EventSpotlightBand from './components/EventSpotlightBand';
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
import CompPhotoVote from './components/CompPhotoVote';
import EventFeedbackForm from './components/EventFeedbackForm';
import OpticSurvey from './components/OpticSurvey';
import BallLanding from './components/ball/BallLanding';
import BallSignupWizard from './components/ball/signup/BallSignupWizard';
import BallGuestVerify from './components/ball/BallGuestVerify';
import BallOpsPortal from './components/ball/ops/BallOpsPortal';
import BallDressPortal from './components/ball/dress/BallDressPortal';
import BallAttirePortal from './components/ball/attire/BallAttirePortal';
import Rhea from './components/rhea/Rhea';
import LukeUploadRoute from './components/rhea/LukeUpload';
import LukePwaRoute from './components/rhea/LukePwa';
import RaiderTv from './components/raidertv/RaiderTv';
import RaiderRemote from './components/raidertv/RaiderRemote';

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
  // Rhea County Raider Comp photo system — three self-contained surfaces,
  // each its own auth/chrome, same early-return pattern as /admin.
  if (location.pathname === '/rhea') return <Rhea />;
  if (location.pathname === '/lukeupload') return <LukeUploadRoute />;
  if (location.pathname === '/lukepwa' || location.pathname.startsWith('/lukepwa/')) return <LukePwaRoute />;
  if (location.pathname === '/tv') return <TvKiosk />;
  if (location.pathname === '/tv/range') return <TvRangeKiosk />;
  // Raider film-review: /raidertv is the display (shows a pair code),
  // /raiderremote is the phone that drives it. Self-contained anon routes.
  if (location.pathname === '/raidertv') return <RaiderTv />;
  if (location.pathname === '/raiderremote') return <RaiderRemote />;
  if (location.pathname === '/raiderparent') return <RaiderParentWelcome />;
  if (location.pathname.startsWith('/feedback/')) return <EventFeedbackForm />;
  if (location.pathname === '/vote') return <CompPhotoVote />;
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
            <Hero />
            <CompPhotoBand />
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
