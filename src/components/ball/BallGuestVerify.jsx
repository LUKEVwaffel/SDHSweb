import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase as SB } from '../../lib/supabaseClient';
import { guestVerify } from '../../lib/ballApi';
import { P, mono, oswald } from '../admin/theme';
import './ball.css';
import { FadeUp, Skeleton, Spinner } from './ballUi';

// Standalone route (own chrome, bypasses TopNav/Footer — same treatment as
// /feedback/:eventId in App.jsx), reached only via the unique tokenized link
// emailed by ball-submit-signup. No login of any kind — the token is the
// entire auth. Shows the attire requirements again here since the guest
// never saw Step 4 of the cadet's flow.
export default function BallGuestVerify() {
  const location = useLocation();
  const token = location.pathname.replace(/^\/ball\/guest\/?/, '').split('/')[0];
  const [config, setConfig] = useState(undefined); // undefined = loading
  const [allergies, setAllergies] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [state, setState] = useState('form'); // form | busy | done | already | err
  const [err, setErr] = useState('');

  useEffect(() => {
    SB.from('ball_config')
      .select('dress_code_text, dress_approvers, weston_name, weston_phone')
      .maybeSingle()
      .then(({ data }) => setConfig(data || null));
  }, []);

  async function submit() {
    if (!accepted) { setErr('Please confirm you\'ve read the attire requirements.'); return; }
    setState('busy');
    setErr('');
    const { data, error } = await guestVerify(token, { allergies, accepted_dress_code: accepted });
    if (error) { setState('err'); setErr(error); return; }
    setState(data?.already_verified ? 'already' : 'done');
  }

  if (!token) return null;
  const busy = state === 'busy';

  return (
    <div className="ball-root">
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 24px 100px' }}>
        <FadeUp style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em', marginBottom: 10 }}>TROJAN BATTALION · JROTC</FadeUp>
        <FadeUp delay={1}>
          <h1 style={{ fontFamily: oswald, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 600, margin: '0 0 24px' }}>Finish Your Ball Invite</h1>
        </FadeUp>

        {(state === 'done' || state === 'already') && (
          <div className="ball-scale-in" style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <svg className="ball-check" width="26" height="26" viewBox="0 0 60 60" fill="none" aria-hidden="true">
                <circle cx="30" cy="30" r="26" stroke={P.gold} strokeWidth="3" />
                <path d="M18 31l9 9 16-19" stroke={P.gold} strokeWidth="4" strokeLinecap="square" />
              </svg>
              <div style={{ fontFamily: mono, fontSize: 12, color: P.gold }}>YOU'RE VERIFIED</div>
            </div>
            <p style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>
              {state === 'already' ? "You've already completed this step." : 'Your info is submitted. See you at the ball!'}
            </p>
          </div>
        )}

        {state !== 'done' && state !== 'already' && (
          <FadeUp delay={2}>
            <Field label="FOOD ALLERGIES (leave blank if none)">
              <textarea
                value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} className="ball-input"
                style={{ width: '100%', boxSizing: 'border-box', background: P.navy, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 14, padding: '11px 12px', outline: 'none' }}
              />
            </Field>

            <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: 20, marginBottom: 18 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.14em', marginBottom: 10 }}>ATTIRE</div>
              {config === undefined ? (
                <>
                  <Skeleton height={12} style={{ marginBottom: 8 }} />
                  <Skeleton width="80%" height={12} />
                </>
              ) : (
                <>
                  <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.6 }}>{config?.dress_code_text || 'Formal / semi-formal. Details from S-6.'}</p>
                  <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6, marginTop: 10 }}>
                    <strong style={{ color: P.cream }}>Wearing a dress?</strong> Text a photo of it to one of these approvers:
                  </p>
                  {(config?.dress_approvers || []).map((a, i) => (
                    <div key={i} style={{ fontFamily: mono, fontSize: 13, padding: '5px 0' }}>{a.name} · {a.phone}</div>
                  ))}
                  <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6, marginTop: 10 }}>
                    <strong style={{ color: P.cream }}>Male guest?</strong> You're not in uniform, so text a photo of your outfit to{' '}
                    {config?.weston_name || 'Weston'}{config?.weston_phone ? ` at ${config.weston_phone}` : ''} for approval.
                  </p>
                </>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 2 }} />
              I've read the attire requirements above.
            </label>

            {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}

            <button
              onClick={submit} disabled={busy}
              className="ball-cta"
              style={{ fontSize: 13, padding: '13px 26px', display: 'inline-flex', alignItems: 'center', gap: 9 }}
            >
              {busy && <Spinner size={13} />}
              {busy ? 'SUBMITTING' : 'CONFIRM →'}
            </button>
          </FadeUp>
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
