import { createClient } from '@supabase/supabase-js';

// Single shared Supabase client. Anon key is public-safe (RLS-protected).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev; a misconfigured env otherwise surfaces as opaque 401s.
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.'
  );
}

export const supabase = createClient(url, anonKey);
export default supabase;
