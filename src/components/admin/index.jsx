import { useState } from 'react';
import LoginScreen from './LoginScreen';
import Dashboard from './Dashboard';

// DISPATCH admin root. Client-side passcode gate (same posture as before —
// anon key + RLS). adminId is a per-session tag for the change log, not an account.
export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [adminId] = useState(() => `ADMIN-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} adminId={adminId} />;
}
