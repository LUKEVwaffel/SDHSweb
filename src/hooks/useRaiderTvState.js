import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

// Live session row shared by /raidertv and /raiderremote. Both sides pass the
// same session id and subscribe to the same row — a write from one lands on
// the other in ~200-400ms (postgres_changes, same as useTvDailySettings.js).
//
// `missing` = the id did not resolve to a row on the initial fetch (bad code,
// or the session was swept). The remote uses it to fall back to the code
// screen. A session that disappears mid-run isn't caught here (Realtime DELETE
// payloads can't be filtered by id without REPLICA IDENTITY FULL) — the remote
// treats a stale last_seen_at as "TV disconnected" instead.
export function useRaiderTvState(sessionId) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(!!sessionId);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      setMissing(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);
    setMissing(false);

    SB.from('raider_tv_sessions').select('*').eq('id', sessionId).maybeSingle().then(({ data }) => {
      if (!alive) return;
      setSession(data ?? null);
      setMissing(!data);
      setLoading(false);
    });

    const topic = `raider-tv-session:${sessionId}`;
    const stale = SB.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (stale) SB.removeChannel(stale);

    const channel = SB.channel(topic)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'raider_tv_sessions', filter: `id=eq.${sessionId}` },
        (payload) => { if (alive) setSession(payload.new); },
      )
      .subscribe();

    return () => { alive = false; SB.removeChannel(channel); };
  }, [sessionId]);

  return { session, loading, missing };
}
