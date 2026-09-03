import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../../admin/theme';
import '../ball.css';
import StepCadetVerify from './StepCadetVerify';
import StepCadetDetails from './StepCadetDetails';
import StepGuestInfo from './StepGuestInfo';
import StepDocumentation from './StepDocumentation';
import SignupConfirmation from './SignupConfirmation';

const STEP_LABELS = ['Verify', 'Your Info', 'Guest', 'Documentation'];
const STEP_HELP = [
  'Confirm who you are with your school email. No password, no account to create.',
  'Tell us your age, gender, and whether you have a food allergy, for event planning.',
  "If you're bringing someone, we'll collect their info here. Otherwise skip to the last step.",
  "Last step: field trip form, payment, and dress/attire steps. Submitting locks the signup, and nothing can be edited after.",
];

function fmtShort(d) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function emptyGuest() {
  return {
    bringing_guest: null, guest_type: null,
    name: '', age: '', gender: '', is_sdhs_jrotc: false, sdhs_matched_cadet_id: null,
    goes_to_sdhs: null, other_jrotc: false, other_jrotc_school: '', school_attended: '',
    poc_name: '', poc_email: '', poc_phone: '', personal_email: '', phone: '', friend_payment_method: '',
  };
}

// Owns wizard state end to end, incl. the signupToken minted by Step 1 —
// held in memory only (never persisted), attached to the Step 3 roster
// search and Step 4 submit calls.
export default function BallSignupWizard() {
  const [step, setStep] = useState(0);
  const [signupToken, setSignupToken] = useState(null);
  const [cadet, setCadet] = useState(null);
  // has_allergy: null until answered. notification_email is REQUIRED for every
  // signer (personal, non-school) — it's the confirmation address and, when an
  // allergy is flagged, the S-5 contact too.
  const [cadetDetails, setCadetDetails] = useState({ age: '', gender: '', has_allergy: null, notification_email: '', phone: '' });
  const [guest, setGuest] = useState(emptyGuest());
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null); // ball-submit-signup response (amounts, form-required, guest_type)
  const [deadline, setDeadline] = useState(null);

  useEffect(() => {
    SB.from('ball_config').select('signup_deadline').maybeSingle()
      .then(({ data }) => setDeadline(data?.signup_deadline || null));
  }, []);

  const contactEmail = (cadetDetails.notification_email || '').trim();

  // Client-side deadline gate. /ball/signup is a direct route, so the landing
  // page's disabled CTA isn't enough — but this is only the friendly stop;
  // ball-submit-signup enforces the same deadline server-side (item 1). Compare
  // on the calendar day in the event's zone (US Central), deadline day open.
  const closed = deadline
    ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) > deadline
    : false;

  function onVerified({ signupToken: tok, ...cadetInfo }) {
    setSignupToken(tok);
    setCadet(cadetInfo);
    setStep(1);
  }

  function resetVerification() {
    setSignupToken(null);
    setCadet(null);
    setStep(0);
  }

  if (closed && !submitted) {
    return (
      <Shell deadline={deadline}>
        <div
          className="ball-scale-in"
          style={{
            border: `1px solid ${P.hairStrong}`, background: P.navy, padding: 28,
            fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7,
          }}
        >
          <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.14em', marginBottom: 10 }}>
            REGISTRATION CLOSED
          </div>
          The signup deadline ({fmtShort(deadline)}) has passed. No new Military Ball signups can be
          taken. See 1SG Kaz or Chief with any questions.
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell deadline={deadline}>
        <div className="ball-scale-in">
          <SignupConfirmation
            cadetName={cadet?.name}
            hasGuest={guest.bringing_guest === true}
            guestName={guest.name}
            guestType={guest.guest_type}
            notificationEmail={contactEmail}
            result={result}
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell deadline={deadline}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 34 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ height: 3, background: P.hair, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: P.gold,
                width: i < step ? '100%' : i === step ? '55%' : '0%',
                transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: i === step ? P.gold : P.mute, transition: 'color 0.3s ease' }}>
              {String(i + 1).padStart(2, '0')} · {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6, marginBottom: 24 }}>
        {STEP_HELP[step]}
      </p>

      <div key={step} className="ball-step">
        {step === 0 && <StepCadetVerify onVerified={onVerified} />}
        {step === 1 && cadet && (
          <StepCadetDetails
            cadet={cadet}
            value={cadetDetails}
            onChange={setCadetDetails}
            onBack={resetVerification}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepGuestInfo
            signupToken={signupToken}
            value={guest}
            onChange={setGuest}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepDocumentation
            signupToken={signupToken}
            cadetGender={cadetDetails.gender}
            cadetDetails={cadetDetails}
            guest={guest}
            onBack={() => setStep(2)}
            onSubmitted={(d) => { setResult(d || null); setSubmitted(true); }}
            onSessionExpired={resetVerification}
          />
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, deadline }) {
  return (
    <div className="ball-root">
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px 100px' }}>
        <div className="ball-fade-up" style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em', marginBottom: 10 }}>
          TROJAN BATTALION · JROTC
        </div>
        <h1 className="ball-fade-up ball-d1" style={{ fontFamily: oswald, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 600, margin: '0 0 12px' }}>
          Military Ball Signup
        </h1>
        <p className="ball-fade-up ball-d2" style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.7, margin: '0 0 20px', maxWidth: 470 }}>
          Read every step carefully before you continue. Instructions, dates, and what each person owes are all here.
          You can go back at any point, but once you submit, the signup <strong style={{ color: P.cream }}>locks</strong> and nothing can be changed.
        </p>
        {deadline && (
          <div className="ball-fade-up ball-d3" style={{
            border: `1px solid ${P.gold}`, background: P.goldWash, padding: '10px 14px', marginBottom: 30,
            fontFamily: mono, fontSize: 12, color: P.cream, letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="ball-dot" />
            <span><span style={{ color: P.gold, letterSpacing: '0.18em' }}>DEADLINE</span>{'  '}Sign up by <strong>{fmtShort(deadline)}</strong>. No signups after this date.</span>
          </div>
        )}
        <div className="ball-fade-up ball-d4">{children}</div>
      </div>
    </div>
  );
}
