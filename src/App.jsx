import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import TopNav from './components/TopNav';
import Hero from './components/Hero';
import TabGrid from './components/TabGrid';
import Bulletin from './components/Bulletin';
import OpticPromoBand from './components/OpticPromoBand';
import EventSpotlightBand from './components/EventSpotlightBand';
import HomeNewsletterBand from './components/HomeNewsletterBand';
import Footer from './components/Footer';
import TabPlaceholder from './components/TabPlaceholder';
import CadetManual from './components/CadetManual';
import CreedHub from './components/creed/CreedHub';
import Raiders from './components/Raiders';
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
  if (location.pathname === '/tv') return <TvKiosk />;
  if (location.pathname === '/tv/range') return <TvRangeKiosk />;

  return (
    <div style={{ minHeight: '100vh', background: '#06101F', fontFamily: 'Inter, sans-serif' }}>
      <TopNav />

      <Routes>
        <Route path="/" element={(
          <>
            <Hero />
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
        <Route path="/raiderteam" element={<RaiderTeam />} />
        <Route path="/rifle" element={<Rifle />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/pictures" element={<Navigate to="/events" replace />} />
        <Route path="/submit" element={<SubmitHub />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/company/:id" element={<Companies />} />
        <Route path="/about" element={<About />} />
        <Route path="/profile/:id" element={<CommandProfile />} />
        <Route path="/:tabId" element={<TabRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  );
}
