import { useState, useEffect, useCallback } from 'react';
import TopNav from './components/TopNav';
import Hero from './components/Hero';
import TabGrid from './components/TabGrid';
import Bulletin from './components/Bulletin';
import HomeNewsletterBand from './components/HomeNewsletterBand';
import Footer from './components/Footer';
import TabPlaceholder from './components/TabPlaceholder';
import CadetManual from './components/CadetManual';
import Raiders from './components/Raiders';
import Rifle from './components/Rifle';
import Staff from './components/Staff';
import Pictures from './components/Pictures';
import SubmitHub from './components/SubmitHub';
import Companies from './components/Companies';
import About from './components/About';
import CommandProfile from './components/CommandProfile';
import BattalionCommand from './components/BattalionCommand';
import Admin from './components/admin';
import ReviewPortal from './components/review/ReviewPortal';

const TABS = [
  { id: 'cadet-manual', label: 'Cadet Manual',  short: 'MANUAL' },
  { id: 'raiders',      label: 'Raiders',       short: 'RAIDERS' },
  { id: 'rifle',        label: 'Rifle',         short: 'RIFLE' },
  { id: 'academic',     label: 'Academic',      short: 'ACADEMIC' },
  { id: 'drill',        label: 'Drill',         short: 'DRILL' },
  { id: 'pictures',     label: 'Pictures',      short: 'PICTURES' },
];

function stateToHash(active) {
  if (active === 'home') return '';
  return active;
}

function hashToState(hash = window.location.hash) {
  const fragment = hash.replace(/^#/, '').trim();
  return fragment || 'home';
}

export default function App() {
  const [active, setActiveState] = useState(() => hashToState());
  // Where the profile "back" button should return — set by whichever surface
  // opened the profile (home command trio vs. staff roster).
  const [profileBack, setProfileBack] = useState('staff');

  const setActive = useCallback((next) => {
    setActiveState(next);
    const fragment = stateToHash(next);
    const newHash = fragment ? `#${fragment}` : window.location.pathname;
    if (window.location.hash !== (fragment ? `#${fragment}` : '')) {
      history.pushState({ active: next }, '', newHash);
    }
  }, []);

  // Navigate while recording the origin for profile back-navigation.
  const navigateFrom = useCallback((origin) => (next) => {
    if (typeof next === 'string' && next.startsWith('profile-')) setProfileBack(origin);
    setActive(next);
  }, [setActive]);

  useEffect(() => {
    const onPop = () => setActiveState(hashToState());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [active]);

  const activeTab = TABS.find(t => t.id === active);

  if (active === 'admin') return <Admin setActive={setActive} />;
  // Reviewer portal deep-links carry a query string in the hash
  // (#review?token_hash=...&draft=...) which hashToState folds into `active`
  // verbatim — match on prefix and let ReviewPortal parse window.location.hash
  // itself rather than trusting the mangled `active` string.
  if (active.startsWith('review')) return <ReviewPortal />;

  return (
    <div style={{ minHeight: '100vh', background: '#06101F', fontFamily: 'Inter, sans-serif' }}>
      <TopNav active={active} setActive={setActive} />

      {active === 'home' ? (
        <>
          <Hero setActive={setActive} />
          <BattalionCommand setActive={navigateFrom('home')} />
          <TabGrid setActive={setActive} />
          <Bulletin />
          <HomeNewsletterBand />
        </>
      ) : active === 'cadet-manual' ? (
        <CadetManual setActive={setActive} />
      ) : active === 'raiders' ? (
        <Raiders setActive={navigateFrom('raiders')} />
      ) : active === 'rifle' ? (
        <Rifle setActive={setActive} />
      ) : active === 'staff' ? (
        <Staff setActive={navigateFrom('staff')} />
      ) : active === 'pictures' ? (
        <Pictures setActive={setActive} />
      ) : active === 'submit' ? (
        <SubmitHub setActive={setActive} />
      ) : active === 'companies' || active.startsWith('company-') ? (
        <Companies
          setActive={setActive}
          initialCompany={active.startsWith('company-') ? active.replace('company-', '') : 'alpha'}
        />
      ) : active === 'about' ? (
        <About setActive={setActive} />
      ) : active.startsWith('profile-') ? (
        <CommandProfile
          personId={active.replace('profile-', '')}
          backTarget={profileBack}
          backLabel={profileBack === 'home' ? 'HOME' : profileBack === 'raiders' ? 'RAIDERS' : 'STAFF'}
          setActive={setActive}
        />
      ) : (
        <TabPlaceholder
          tab={activeTab || { id: active, label: active, short: active.toUpperCase() }}
          setActive={setActive}
        />
      )}

      <Footer setActive={setActive} />
    </div>
  );
}
