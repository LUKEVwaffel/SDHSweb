import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { OPTIC_EVENT_ID } from '../lib/opticComp';

const CONFIG_ID = 'default';

/**
 * Live `optic_config` row — which event the /optic feed + retag target, and
 * the camera clock offset. Falls back to the hardcoded OPTIC_EVENT_ID (and
 * offset 0) until the row loads or if optic_2.sql hasn't been run yet, so the
 * feed never hard-fails on a missing config table.
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
    eventId: row?.active_event_id || OPTIC_EVENT_ID,
    cameraOffsetSeconds: row?.camera_offset_seconds ?? 0,
    loading,
  };
}
