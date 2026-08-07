import { useState, useEffect } from 'react';

/** Shared 1s-interval clock tick. One instance per consumer (cheap, no context needed at this scale). */
export function useNowTicker() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}
