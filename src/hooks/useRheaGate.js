import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const GATE_ID = 'default';
// Fallback when the row can't be read (migration not run yet / offline): stay
// LOCKED with this target so the countdown still renders. 8:00 AM Aug 29 2026 ET.
const FALLBACK_OPENS_AT = '2026-08-29T08:00:00-04:00';

// Tri-state kill switch. `mode` is authoritative:
//   'closed' -> feed locked, always (wins over the clock AND over is_open)
//   'open'   -> feed open, always
//   'auto'   -> open once now >= opens_at (the countdown)
// Rows written before rhea_gate_mode.sql have no `mode`; treat that as 'auto'
// so behaviour is unchanged until the migration lands.
function resolveMode(row) {
  const m = row?.mode;
  return m === 'open' || m === 'closed' ? m : 'auto';
}

/**
 * Beta gate for /rhea. Reads the single `rhea_gate` row and stays live on it
 * via realtime, plus a 1 Hz local tick so the derived `open` flips exactly
 * when the countdown reaches the scheduled time , no reload needed. A `mode`
 * change (Luke hitting LOCK / FORCE OPEN / AUTO in /lukepwa) arrives on the
 * same realtime channel and closes or opens the feed for anyone already
 * viewing it.
 */
export function useRheaGate() {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const load = async () => {
      const { data, error } = await SB
        .from('rhea_gate').select('*').eq('id', GATE_ID).maybeSingle();
      if (!aliveRef.current) return;
      setRow(!error && data ? data : { id: GATE_ID, mode: 'auto', opens_at: FALLBACK_OPENS_AT });
      setLoading(false);
    };
    load();

    const channel = SB.channel('rhea-gate')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rhea_gate', filter: `id=eq.${GATE_ID}` },
        load,
      )
      .subscribe();

    const t = setInterval(() => { if (aliveRef.current) tick((n) => (n + 1) % 60); }, 1000);

    return () => {
      aliveRef.current = false;
      clearInterval(t);
      SB.removeChannel(channel);
    };
  }, []);

  const opensAt = new Date(row?.opens_at || FALLBACK_OPENS_AT);
  const mode = resolveMode(row);
  // Legacy early-unlock lever: `is_open = true` still forces the feed open even
  // with no `mode` column yet, so `update rhea_gate set is_open=true` opens
  // /rhea before opens_at without the migration. A force-close (`mode='closed'`)
  // still wins over it.
  const forcedOpenLegacy = row?.is_open === true;
  const open = !!row && (
    mode === 'closed'
      ? false
      : mode === 'open' || forcedOpenLegacy
        ? true
        : Date.now() >= opensAt.getTime()
  );

  return { open, opensAt, mode, loading };
}
