import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchCompPoll, deriveWinner, isPollOpen, isPollClosed,
} from '../lib/compPhotoVote';

// Read model for the "Picture of the Comp" vote. One fetch on mount
// (retrospective — no live-event pressure), shared by the public ballot
// (/vote), the home-page band, and the /tv congrats screen.

export function useCompPhotoPoll() {
  const [poll, setPoll] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const { poll: p, candidates: c, error: e } = await fetchCompPoll();
    if (!alive.current) return;
    setPoll(p);
    setCandidates(c);
    setError(e);
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  return {
    poll,
    candidates,
    winner: deriveWinner(poll, candidates),
    isOpen: isPollOpen(poll),
    isClosed: isPollClosed(poll),
    loading,
    error,
    refresh: load,
  };
}
