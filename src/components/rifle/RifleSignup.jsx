import { useState } from 'react';
import { submitRifleSignup } from '../../lib/rifleApi';
import { isSchoolEmail } from '../../lib/schoolEmail';

const P = {
  ink: '#06101F', navy: '#142847', gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)', red: '#E8897A',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
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
// school_email against rifle_shooters (see rifle-submit-signup). All we need
// here is the cadet's school email; their full profile (name/age/grade/
// company) already lives in DISPATCH's roster, so this form only collects
// contact info the roster doesn't carry. Kaz/Chief see submissions in the
// reviewer portal (RifleSignupsPortal.jsx via /review).
export default function RifleSignup() {
  const [form, setForm] = useState({ username: '', personal_email: '', parent_email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const username = form.username.trim();
  const schoolEmailOk = username.length > 0 && !/\s/.test(username);
  const schoolEmail = `${username.toLowerCase()}${SCHOOL_DOMAIN}`;

  const personalEmail = form.personal_email.trim();
  const personalEmailEntered = personalEmail.length > 0;
  const personalEmailOk = EMAIL_RE.test(personalEmail) && !isSchoolEmail(personalEmail);

  const parentEmail = form.parent_email.trim();
  const parentEmailEntered = parentEmail.length > 0;
  const parentEmailOk = EMAIL_RE.test(parentEmail);

  const phoneOk = form.phone.replace(/\D/g, '').length >= 7;

  const canSubmit = schoolEmailOk && personalEmailOk && parentEmailOk && phoneOk;

  async function submit() {
    setBusy(true);
    setErr('');
    const { error } = await submitRifleSignup({
      school_email: schoolEmail,
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
        <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em', marginBottom: 10 }}>
          TROJAN BATTALION · RIFLE TEAM
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
          <div style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: 28 }}>
            <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.14em', marginBottom: 14 }}>YOU&apos;RE ON THE LIST</div>
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
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: stripSchoolDomain(e.target.value) })}
                  placeholder="jsmith123"
                  style={{ borderRight: 'none' }}
                />
                <div style={{
                  background: P.ink, border: `1px solid ${P.hair}`, borderLeft: 'none', color: P.mute,
                  fontFamily: mono, fontSize: 16, padding: '12px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
                }}>
                  {SCHOOL_DOMAIN}
                </div>
              </div>
            </Field>

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
          </div>
        )}
      </div>
    </div>
  );
}
