import { useCallback, useEffect, useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { TV_REMOTE_LATEST_VERSION } from '../data/tvRemoteChangelog';

/**
 * Per-account TV Remote onboarding state (supabase/tv_remote_onboarding.sql).
 *
 * Returns:
 *   loading            — first fetch in flight
 *   lastSeenVersion    — highest changelog version this account has acked (0 = new)
 *   firstWalkthroughAt — ISO string once the guided tour has been completed/skipped
 *   needsWalkthrough    — never finished the tour
 *   needsUpdate         — finished the tour but changelog has moved on
 *   completeWalkthrough() — mark tour done + ack the latest version
 *   acknowledgeUpdates()  — ack the latest version (dismiss the "what's new" popup)
 *   replayWalkthrough()   — local-only: re-show the tour this session
 *
 * `email` null → inert (all flags false, no fetch). Gate on role at the call
 * site; this hook doesn't know or care about roles.
 */
export function useTvRemoteOnboarding(email) {
  const [loading, setLoading] = useState(!!email);
  const [row, setRow] = useState(null);
  const [replay, setReplay] = useState(false);

  useEffect(() => {
    if (!email) { setLoading(false); setRow(null); return undefined; }
    let alive = true;
    setLoading(true);
    SB.from('tv_remote_onboarding')
      .select('last_seen_version, first_walkthrough_at')
      .eq('email', email)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setRow(data ?? { last_seen_version: 0, first_walkthrough_at: null });
        setLoading(false);
      });
    return () => { alive = false; };
  }, [email]);

  const persist = useCallback(async (patch) => {
    if (!email) return;
    const next = {
      email,
      last_seen_version: TV_REMOTE_LATEST_VERSION,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    // Optimistic — the popups should close immediately, not wait on the round trip.
    setRow((r) => ({ ...(r ?? {}), ...next }));
    await SB.from('tv_remote_onboarding').upsert(next, { onConflict: 'email' });
  }, [email]);

  const completeWalkthrough = useCallback(() => {
    setReplay(false);
    return persist({ first_walkthrough_at: new Date().toISOString() });
  }, [persist]);

  const acknowledgeUpdates = useCallback(() => persist({}), [persist]);

  const replayWalkthrough = useCallback(() => setReplay(true), []);

  const lastSeenVersion = row?.last_seen_version ?? 0;
  const firstWalkthroughAt = row?.first_walkthrough_at ?? null;
  const ready = !!email && !loading && row !== null;

  return {
    loading,
    lastSeenVersion,
    firstWalkthroughAt,
    needsWalkthrough: (ready && !firstWalkthroughAt) || replay,
    needsUpdate: ready && !!firstWalkthroughAt && lastSeenVersion < TV_REMOTE_LATEST_VERSION,
    completeWalkthrough,
    acknowledgeUpdates,
    replayWalkthrough,
  };
}
