import { useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

// Heartbeat for "is this admin actively in DISPATCH right now" — backs both
// the online dots in Messages and (Phase 5) the email-notification gate.
// Mounted once at the Admin root, not just the Messages panel, so presence
// reflects being anywhere in the app, not just the chat screen.
export const PRESENCE_HEARTBEAT_MS = 30_000;
// Anything newer than this counts as "online". Kept in sync by convention
// with the 90s window the notify-new-message edge function uses (Phase 5) —
// the two can't literally share a constant across the client/Deno boundary,
// but they must agree on the same number.
export const PRESENCE_ONLINE_WINDOW_MS = 90_000;

export default function useAdminPresence(email) {
  useEffect(() => {
    if (!email) return;
    const own = email.toLowerCase();

    const beat = () => {
      SB.from('admin_presence').upsert({ email: own, last_seen_at: new Date().toISOString() }).then(() => {});
    };

    beat();
    const id = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [email]);
}
