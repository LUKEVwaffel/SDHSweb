import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';

const DEFAULT_SCREEN = 'default';

/**
 * Live-synced control-center row, scoped by screen slug (tv_screens.slug —
 * 'default' is the original Outside kiosk, 'range' is Range, etc). Each
 * screen gets its own row in tv_daily_settings and its own realtime
 * subscription — a 1SGT change on one screen (or the control-center overlay)
 * reflects on every kiosk watching THAT screen immediately, no reload needed,
 * without leaking into other screens' state.
 */
export function useTvDailySettings(screenSlug = DEFAULT_SCREEN) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Clear the previous screen's row immediately, not just after the new
    // fetch resolves — otherwise a consumer that hydrates local state off
    // `settings` truthiness (TvRemotePanel's draft) can fire mid-switch and
    // hydrate from the OLD screen's data while this one is in flight.
    setSettings(null);
    SB.from('tv_daily_settings').select('*').eq('id', screenSlug).maybeSingle().then(({ data }) => {
      if (!alive) return;
      setSettings(data);
      setLoading(false);
    });

    const channel = SB.channel(`tv-daily-settings-live:${screenSlug}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tv_daily_settings', filter: `id=eq.${screenSlug}` },
        (payload) => { if (alive) setSettings(payload.new); }
      )
      .subscribe();

    return () => { alive = false; SB.removeChannel(channel); };
  }, [screenSlug]);

  return { settings, loading };
}

/**
 * Every write is stamped with the acting device's fingerprint — attributable,
 * revertible. Plain update, not upsert: the migration's seed insert
 * guarantees the singleton row already exists, and RLS deliberately grants
 * anon only SELECT+UPDATE on this table (no INSERT/DELETE — there's never a
 * legitimate reason for the app to create a second row). Upsert requires an
 * INSERT-capable policy even when it resolves to an update, so it would
 * violate RLS by design here.
 * Returns { error } so callers MUST check it; a failed write here should
 * never look like a successful save to the person using the control center.
 */
export async function updateTvDailySettings(patch, screenSlug = DEFAULT_SCREEN) {
  const fingerprint = await getDeviceId();
  const { error } = await SB.from('tv_daily_settings')
    .update({ ...patch, updated_by_fingerprint: fingerprint })
    .eq('id', screenSlug);
  return { error };
}
