import { useState, useEffect } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, inter } from './theme';
import LoginScreen from './LoginScreen';
import Dashboard from './Dashboard';
import ForcePasswordChange from './login/ForcePasswordChange';

// DISPATCH admin root. Real Supabase Auth (email/password) — replaces the old
// shared passcode. Any user in Supabase Auth → Users can sign in; no per-email
// logic anywhere, so adding a second admin is one dashboard row, zero code
// change. adminId is now the signed-in account's email (real change_log
// attribution instead of a random per-session tag).
//
// Render-gating below hides the UI without a session; the actual access control
// is RLS on the tables (authenticated-only writes + PII reads). Do not rely on
// this gate alone.
export default function Admin() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(undefined); // undefined=resolving, null=no role, 's6'|'s5'
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    // Initial session (from persisted storage), then live updates on
    // sign-in / sign-out / token refresh.
    SB.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = SB.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Resolve the signed-in admin's role. If the admin_roles table is not set up
  // yet (query errors), fall back to full 's6' access so pre-RBAC behavior is
  // unchanged. Once the table exists, a user with no row is locked out.
  useEffect(() => {
    if (!session) { setRole(undefined); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await SB.from('admin_roles').select('role, must_change_password').eq('email', session.user.email).maybeSingle();
      if (cancelled) return;
      setRole(error ? 's6' : (data?.role ?? null));
      setMustChangePassword(!!data?.must_change_password);
    })();
    return () => { cancelled = true; };
  }, [session]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: P.ink, color: P.mute,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: mono, fontSize: 10, letterSpacing: '0.3em',
      }}>
        AUTHENTICATING…
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  // Role still resolving.
  if (role === undefined) {
    return (
      <div style={{
        minHeight: '100vh', background: P.ink, color: P.mute,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: mono, fontSize: 10, letterSpacing: '0.3em',
      }}>
        AUTHORIZING…
      </div>
    );
  }

  // Signed in but not assigned a DISPATCH role — deny access.
  if (role === null) {
    return (
      <div style={{
        minHeight: '100vh', background: P.ink,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.28em' }}>ACCESS NOT AUTHORIZED</div>
        <div style={{ fontFamily: inter, fontSize: 14, color: P.mute, maxWidth: 380, lineHeight: 1.6 }}>
          {session.user.email} has no DISPATCH role assigned. Ask the S-6 to add you in Supabase.
        </div>
        <button onClick={() => SB.auth.signOut()} style={{
          background: 'transparent', border: `1px solid ${P.gold}`, color: P.gold,
          fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', padding: '10px 18px', cursor: 'pointer',
        }}>SIGN OUT</button>
      </div>
    );
  }

  // Forced password change — dashboard-set temp password, not yet replaced.
  // Server-side enforcement (admin_role() → is_s6()/is_s5()/is_admin(), plus
  // the edge-function checks in pin-login/passkey-login/set-pin/passkey-register)
  // is the real control; this just keeps the UI from showing a Dashboard the
  // backend won't actually let the account use yet. See admin_password_gate.sql.
  if (mustChangePassword) {
    return (
      <ForcePasswordChange
        email={session.user.email}
        onDone={() => setMustChangePassword(false)}
      />
    );
  }

  return (
    <div style={{ fontFamily: inter }}>
      <Dashboard adminId={session.user.email} role={role} onLogout={() => SB.auth.signOut()} />
    </div>
  );
}
