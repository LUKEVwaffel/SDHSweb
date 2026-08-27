import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase as SB } from '../../lib/supabaseClient';
import { guestVerify } from '../../lib/ballApi';
import { P, mono, oswald, inter } from '../admin/theme';

// Standalone route (own chrome, bypasses TopNav/Footer — same treatment as
// /feedback/:eventId in App.jsx), reached only via the unique tokenized link
// emailed by ball-submit-signup. No login of any kind — the token is the
// entire auth. Shows the dress code (+ approvers, if female) again here
// since the guest never saw Step 4 of the cadet's flow.
export default function BallGuestVerify() {
  const location = useLocation();
  const token = location.pathname.replace(/^\/ball\/guest\/?/, '').split('/')[0];
  const [config, setConfig] = useState(null);
  const [allergies, setAllergies] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [state, setState] = useState('form'); // form | busy | done | already | err
  const [err, setErr] = useState('');

  useEffect(() => {
    SB.from('ball_config').select('dress_code_text, dress_approvers').maybeSingle().then(({ data }) => setConfig(data));
  }, []);

  async function submit() {
    if (!accepted) { setErr('Please confirm you\'ve read the dress code.'); return; }
    setState('busy');
    setErr('');
    const { data, error } = await guestVerify(token, { allergies, accepted_dress_code: accepted });
    if (error) { setState('err'); setErr(error); return; }
    setState(data?.already_verified ? 'already' : 'done');
  }

  if (!token) return null;

  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: inter, color: P.cream }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 24px 100px' }}>
        <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em', marginBottom: 10 }}>TROJAN BATTALION · JROTC</div>
        <h1 style={{ fontFamily: oswald, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 600, margin: '0 0 24px' }}>Finish Your Ball Invite</h1>

        {(state === 'done' || state === 'already') && (
          <div style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: 24 }}>
            <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, marginBottom: 8 }}>YOU'RE VERIFIED ✓</div>
            <p style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>
              {state === 'already' ? "You've already completed this step." : 'Your info is submitted. See you at the ball!'}
            </p>
          </div>
        )}

        {state !== 'done' && state !== 'already' && (
          <div>
            <Field label="FOOD ALLERGIES (leave blank if none)">
              <textarea
                value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2}
                style={{ width: '100%', boxSizing: 'border-box', background: P.navy, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 14, padding: '11px 12px' }}
              />
            </Field>

            <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: 20, marginBottom: 18 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.14em', marginBottom: 10 }}>DRESS CODE</div>
              <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.6 }}>{config?.dress_code_text || 'Loading…'}</p>
              <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6 }}>
                If you'll be wearing a dress, text a photo of it to one of these approvers for approval:
              </p>
              {(config?.dress_approvers || []).map((a, i) => (
                <div key={i} style={{ fontFamily: mono, fontSize: 13, padding: '5px 0' }}>{a.name} — {a.phone}</div>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 2 }} />
              I've read the dress code above.
            </label>

            {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}

            <button
              onClick={submit} disabled={state === 'busy'}
              style={{ background: P.gold, color: P.ink, border: 'none', cursor: state === 'busy' ? 'not-allowed' : 'pointer', fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', padding: '13px 26px' }}
            >
              {state === 'busy' ? 'SUBMITTING…' : 'CONFIRM →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
