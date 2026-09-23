import { useState } from 'react';
import { submitRifleSignup, lookupRifleCadet } from '../../lib/rifleApi';
import { isSchoolEmail } from '../../lib/schoolEmail';
import { P, mono, oswald } from './theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCHOOL_DOMAIN = '@students.hcde.org';

// A pasted full email still works — strip the domain back off so the field
// always holds just the username portion, same pattern as the Ball signup's
// StepCadetVerify.jsx.
function stripSchoolDomain(v) {
  const at = v.indexOf('@');
  return at < 0 ? v : v.slice(0, at);
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function TextInput({ style, ...rest }) {
  return (
    <input
      {...rest}
      style={{
        width: '100%', boxSizing: 'border-box', background: P.navy, border: `1px solid ${P.hair}`,
        color: P.cream, fontFamily: mono, fontSize: 16, padding: '12px 12px', outline: 'none',
        ...style,
      }}
    />
  );
}

// Rifle team interest signup — open to every cadet, new/JV and returning
// varsity alike; a returning shooter is auto-flagged server-side by matching
// school_email against rifle_shooters (see rifle-submit-signup). School
// email must first be verified against DISPATCH's roster (rifle-lookup-
// cadet) before the rest of the form unlocks — submitting a made-up school
// email is no longer possible, only checking format used to let those
// through as bogus, no-name entries in the reviewer portal. Once verified,
// their full profile (name/age/grade/company) already lives in DISPATCH's
// roster, so this form only collects contact info the roster doesn't carry.
// Kaz/Chief see submissions in the reviewer portal (RifleSignupsPortal.jsx
// via /review).
export default function RifleSignup() {
  const [username, setUsername] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');
  const [verified, setVerified] = useState(null); // { email, name, let_level, company, signupToken }

  const [form, setForm] = useState({ personal_email: '', parent_email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function verify() {
    const uname = username.trim();
    if (!uname || verifyBusy) return;
    setVerifyBusy(true);
    setVerifyErr('');
    const { data, error } = await lookupRifleCadet(uname);
    setVerifyBusy(false);
    if (error) {
      setVerifyErr("We couldn't find a cadet with that email. Double-check it, or see Kaz/Chief if the roster needs updating.");
      return;
    }
    setVerified({
      email: `${uname.toLowerCase()}${SCHOOL_DOMAIN}`,
      name: data.name,
      let_level: data.let_level,
      company: data.company,
      signupToken: data.signupToken,
    });
  }

  function resetVerify() {
    setVerified(null);
    setVerifyErr('');
  }

  const personalEmail = form.personal_email.trim();
  const personalEmailEntered = personalEmail.length > 0;
  const personalEmailOk = EMAIL_RE.test(personalEmail) && !isSchoolEmail(personalEmail);

  const parentEmail = form.parent_email.trim();
  const parentEmailEntered = parentEmail.length > 0;
  const parentEmailOk = EMAIL_RE.test(parentEmail);

  const phoneOk = form.phone.replace(/\D/g, '').length >= 7;

  const canSubmit = !!verified && personalEmailOk && parentEmailOk && phoneOk;

  async function submit() {
    if (!verified) return;
    setBusy(true);
    setErr('');
    const { error } = await submitRifleSignup({
      school_email: verified.email,
      signup_token: verified.signupToken,
      personal_email: personalEmail,
      parent_email: parentEmail,
      phone: form.phone.trim(),
    });
    setBusy(false);
    if (error) { setErr(error); return; }
    setSubmitted(true);
  }

  return (
    <div style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em' }}>
            TROJAN BATTALION · RIFLE TEAM
          </div>
          <div style={{ flex: 1, height: 1, background: P.hair }} />
        </div>
        <h1 style={{ fontFamily: oswald, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 600, color: P.cream, margin: '0 0 12px' }}>
          Rifle Season Signup
        </h1>
        <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.7, margin: '0 0 20px', maxWidth: 470 }}>
          Interested in rifle this season — new, JV, or returning varsity? Sign up below with your school email —
          we already have the rest of your profile in DISPATCH, and if you shot for us last year we'll flag you
          as a returning shooter automatically.
        </p>

        {submitted ? (
          <div style={{ position: 'relative', border: `1px solid ${P.gold}`, background: P.navy, padding: 28 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, borderTop: `1px solid ${P.gold}`, borderLeft: `1px solid ${P.gold}` }} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderBottom: `1px solid ${P.gold}`, borderRight: `1px solid ${P.gold}` }} />
            <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.14em', marginBottom: 14 }}>✓ YOU&apos;RE ON THE LIST</div>
            <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7, margin: 0 }}>
              Thanks — you&apos;re signed up for rifle. Watch your personal and parent email for next steps.
            </p>
          </div>
        ) : (
          <div>
            <Field label="SCHOOL EMAIL">
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <TextInput
                  autoFocus
                  disabled={!!verified}
                  value={username}
                  onChange={(e) => setUsername(stripSchoolDomain(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !verified) verify(); }}
                  placeholder="jsmith123"
                  style={{ borderRight: 'none', opacity: verified ? 0.6 : 1 }}
                />
                <div style={{
                  background: P.ink, border: `1px solid ${P.hair}`, borderLeft: verified ? undefined : 'none', color: P.mute,
                  fontFamily: mono, fontSize: 16, padding: '12px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
                }}>
                  {SCHOOL_DOMAIN}
                </div>
                {!verified && (
                  <button
                    onClick={verify}
                    disabled={!username.trim() || verifyBusy}
                    style={{
                      marginLeft: 10, cursor: !username.trim() || verifyBusy ? 'not-allowed' : 'pointer',
                      opacity: !username.trim() || verifyBusy ? 0.55 : 1,
                      background: 'transparent', color: P.gold, border: `1px solid ${P.gold}`,
                      fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', fontWeight: 700, padding: '0 16px', whiteSpace: 'nowrap',
                    }}
                  >
                    {verifyBusy ? 'CHECKING' : 'VERIFY'}
                  </button>
                )}
              </div>
              {verifyErr && <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 6 }}>{verifyErr}</div>}
              {verified && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${P.gold}`, background: P.navy, padding: '10px 14px', marginTop: 8 }}>
                  <div style={{ fontFamily: mono, fontSize: 12, color: P.cream }}>
                    ✓ {verified.name} · LET {verified.let_level || '--'} · {(verified.company || '').toUpperCase() || '--'} COMPANY
                  </div>
                  <button onClick={resetVerify} style={{ background: 'transparent', border: 'none', color: P.mute, fontFamily: mono, fontSize: 11, textDecoration: 'underline', cursor: 'pointer' }}>
                    Not you?
                  </button>
                </div>
              )}
            </Field>

            {verified && (
              <>
                <Field label="PERSONAL EMAIL">
                  <TextInput type="email" value={form.personal_email} onChange={set('personal_email')} placeholder="you@gmail.com" />
                  {personalEmailEntered && !personalEmailOk && (
                    <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 4 }}>
                      {isSchoolEmail(personalEmail) ? 'Use a personal email, not a school one.' : 'Enter a valid email address.'}
                    </div>
                  )}
                </Field>

                <Field label="PARENT/GUARDIAN EMAIL">
                  <TextInput type="email" value={form.parent_email} onChange={set('parent_email')} placeholder="parent@email.com" />
                  {parentEmailEntered && !parentEmailOk && (
                    <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 4 }}>Enter a valid email address.</div>
                  )}
                </Field>

                <Field label="YOUR PERSONAL PHONE NUMBER">
                  <TextInput type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(423) 555-0123" />
                </Field>

                {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginTop: 10 }}>{err}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <button
                    onClick={submit}
                    disabled={!canSubmit || busy}
                    style={{
                      cursor: !canSubmit || busy ? 'not-allowed' : 'pointer', opacity: !canSubmit || busy ? 0.55 : 1,
                      background: P.gold, color: P.ink, border: 'none',
                      fontFamily: mono, fontSize: 13, letterSpacing: '0.1em', fontWeight: 700, padding: '13px 26px',
                    }}
                  >
                    {busy ? 'SUBMITTING' : 'SIGN UP →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
