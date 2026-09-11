import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const CONFIG_ID = 'default';

/**
 * Live `optic_config` row — which event the /optic feed + retag target, and
 * the camera clock offset. `eventId` is null until the row loads AND
 * active_event_id is actually set — deliberately NOT the old hardcoded
 * OPTIC_EVENT_ID (Rhea County comp). Every past comp's photos stay in
 * `photos` forever with their own event_id; the live feed/upload surfaces
 * must only ever show/write to whatever optic_config points at right now, so
 * an unset or unreachable config means "show nothing" instead of silently
 * reattaching this comp's activity to last comp's event.
 */
export function useOpticConfig() {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const load = async () => {
      const { data, error } = await SB
        .from('optic_config').select('*').eq('id', CONFIG_ID).maybeSingle();
      if (!aliveRef.current) return;
      setRow(!error && data ? data : null);
      setLoading(false);
    };
    load();

    const channel = SB.channel('optic-config')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'optic_config', filter: `id=eq.${CONFIG_ID}` },
        load,
      )
      .subscribe();

    return () => { aliveRef.current = false; SB.removeChannel(channel); };
  }, []);

  return {
    eventId: row?.active_event_id || null,
    cameraOffsetSeconds: row?.camera_offset_seconds ?? 0,
    loading,
  };
}
