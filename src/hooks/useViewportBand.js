import { useState, useEffect } from 'react';

// Three-way responsive band for the admin shell's floating sidebar:
//   phone   < 768px   — slide-over drawer, no reserved layout width
//   tablet  768-1023px — permanent collapsed icon rail
//   desktop >= 1024px  — permanent expanded panel (user can still collapse it)
const PHONE_MAX = 767;
const TABLET_MAX = 1023;

function bandFor(width) {
  if (width <= PHONE_MAX) return 'phone';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

export default function useViewportBand() {
  const [band, setBand] = useState(() => bandFor(typeof window === 'undefined' ? 1024 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setBand(bandFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return band;
}
