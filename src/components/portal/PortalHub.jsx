import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import EmailOnlyLogin from '../ball/dress/BallDressLogin';
import '../review/review.css';

// Unified staff portal entry — one email-only login instead of a separate
// login screen per portal (/ball/dress, /ball/attire, /review, /rifle/portal
// each used to render their own). Every one of those portals ends in a real
// Supabase Auth session either way (see portal-email-login /
// ball-dress-email-login / reviewer-email-login — same mintSessionToken
// shape), so ONE sign-in here is enough to unlock all of them; my_portals()
// (portal_hub.sql) just asks each portal's own is_*() gate whether this
// email qualifies and lists the ones that say yes.
//
// DISPATCH (S-6/S-5/BC) is deliberately NOT listed or reachable from here —
// it keeps its own separate, more guarded login at /admin.
export default function PortalHub() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [email, setEmail] = useState('');
  const [portals, setPortals] = useState([]);

  const load = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    setEmail(session.user.email);
    const { data, error } = await SB.rpc('my_portals');
    if (error) { setPhase('error'); setErrorMsg(error.message); return; }
    setPortals(data || []);
    setPhase('ready');
  }, []);

  useEffect(() => { load(); }, [load]);

  async function signOut() {
    await SB.auth.signOut();
    setPortals([]);
    setEmail('');
    setPhase('login');
  }

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion &middot; Staff Portal</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);
  if (phase === 'login') return shell(
    <div>
      <div className="rv-panel" style={{ marginBottom: 18 }}>
        <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 8 }}>One sign-in, every portal</h1>
        <p className="rv-sub" style={{ margin: 0 }}>
          Dress Approval, Male-Guest Attire, the Reviewer Portal (Email Review
          / Ball Ops / Rifle Signups), and Rifle Team Admin used to each have
          their own separate login page. They're unified here now — enter
          your email below once, and you'll see every one of those portals
          you personally have access to. No password, no PIN — if your email
          is set up on a portal, typing it in signs you straight in.
        </p>
      </div>
      <EmailOnlyLogin
        heading="the Staff Portal"
        fn="portal-email-login"
        deniedMessage="That email isn't set up for any staff portal."
        onSignedIn={load}
      />
    </div>
  );
  if (phase === 'error') return shell(
    <div className="rv-panel" style={{ borderColor: '#dcbdb6' }}>
      <h1 className="rv-h1" style={{ fontSize: 20 }}>Something went wrong</h1>
      <p className="rv-sub">{errorMsg}</p>
    </div>
  );

  return shell(
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="rv-h1" style={{ fontSize: 22, margin: '4px 0 6px' }}>Hi {email}</h1>
        <button className="rv-link" style={{ marginTop: 6 }} onClick={signOut}>Sign out</button>
      </div>
      <p className="rv-sub" style={{ marginBottom: 22 }}>
        Which one are you here for? This is now the one place to reach every
        staff portal — bookmark this page instead of an individual portal's
        old login link.
      </p>
      {portals.length === 0 ? (
        <div className="rv-panel">
          <p className="rv-sub" style={{ margin: 0 }}>
            This email isn't active on any staff portal right now. If that's wrong, check with whoever set your account up.
          </p>
        </div>
      ) : (
        portals.map((p) => (
          <a key={p.key} className="rv-row" href={p.path} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '20px 22px', marginBottom: 12 }}>
            <div className="rv-row-title">{p.label}</div>
            <div className="rv-row-meta">{p.description}</div>
          </a>
        ))
      )}
    </div>
  );
}
