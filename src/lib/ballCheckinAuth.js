import { createClient } from '@supabase/supabase-js';

// Desk-only sessions live alongside the organizer's DISPATCH sign-in.
let deskClient;
export function getCheckinAuth() {
  deskClient ??= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { storageKey: 'sdhs-ball-checkin-auth', detectSessionInUrl: false },
  });
  return deskClient;
}

export function checkinActor(session) {
  const operator = session?.user?.app_metadata?.ball_checkin_operator;
  return (typeof operator === 'string' ? operator : session?.user?.email)?.toLowerCase();
}
