import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';

const ROW_ID = 'default';

/**
 * Live-synced control-center row. One singleton shared across every physical
 * /tv kiosk — a realtime subscription means a 1SGT change on one screen (or
 * the control-center overlay) reflects on every other kiosk immediately,
 * no reload needed.
 */
export function useTvDailySettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    SB.from('tv_daily_settings').select('*').eq('id', ROW_ID).maybeSingle().then(({ data }) => {
      if (!alive) return;
      setSettings(data);
      setLoading(false);
    });

    const channel = SB.channel('tv-daily-settings-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tv_daily_settings', filter: `id=eq.${ROW_ID}` },
        (payload) => { if (alive) setSettings(payload.new); }
      )
      .subscribe();

    return () => { alive = false; SB.removeChannel(channel); };
  }, []);

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
export async function updateTvDailySettings(patch) {
  const fingerprint = await getDeviceId();
  const { error } = await SB.from('tv_daily_settings')
    .update({ ...patch, updated_by_fingerprint: fingerprint })
    .eq('id', ROW_ID);
  return { error };
}
