import { useState } from 'react';
import { P, mono, oswald, inter } from '../../admin/theme';
import StepCadetVerify from './StepCadetVerify';
import StepCadetDetails from './StepCadetDetails';
import StepGuestInfo from './StepGuestInfo';
import StepDocumentation from './StepDocumentation';
import SignupConfirmation from './SignupConfirmation';

const STEP_LABELS = ['Verify', 'Your Info', 'Guest', 'Documentation'];
const STEP_HELP = [
  'Confirm who you are with your school email — no password, no account to create.',
  'Tell us your age, gender, and any food allergies for event planning.',
  "If you're bringing someone, we'll collect their info here — otherwise skip to the last step.",
  "Last step: field trip form, payment, and (if you're female) dress approval. Submitting locks the signup — nothing can be edited after.",
];

function emptyGuest() {
  return {
    // null = not answered yet; true/false once the cadet picks — not every
    // cadet brings a guest, so this can't default to either value.
    bringing_guest: null,
    name: '', age: '', gender: '', is_sdhs_jrotc: false, sdhs_matched_cadet_id: null,
    other_jrotc: false, other_jrotc_school: '', school_attended: '',
    poc_name: '', poc_email: '', poc_phone: '', personal_email: '',
  };
}

// Owns wizard state end to end, incl. the signupToken minted by Step 1 —
// held in memory only (never persisted), attached to the Step 3 roster
// search and Step 4 submit calls. See supabase/functions/_shared/
// signupToken.ts for what this actually proves server-side.
export default function BallSignupWizard() {
  const [step, setStep] = useState(0);
  const [signupToken, setSignupToken] = useState(null);
  const [cadet, setCadet] = useState(null); // { name, let_level, company }
  const [cadetDetails, setCadetDetails] = useState({ age: '', gender: '', allergies: '', notification_email: '' });
  const [guest, setGuest] = useState(emptyGuest());
  const [submitted, setSubmitted] = useState(false);

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

  if (submitted) {
    return (
      <Shell>
        <SignupConfirmation
          cadetName={cadet?.name}
          hasGuest={guest.bringing_guest === true}
          guestName={guest.name}
          notificationEmail={cadetDetails.notification_email}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: 'flex', gap: 6, marginBottom: 34 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ height: 3, background: i <= step ? P.gold : P.hair, marginBottom: 8 }} />
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', color: i === step ? P.gold : P.mute }}>
              {String(i + 1).padStart(2, '0')} · {label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.6, marginBottom: 24 }}>
        {STEP_HELP[step]}
      </p>

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
          onSubmitted={() => setSubmitted(true)}
          onSessionExpired={resetVerification}
        />
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: inter, color: P.cream }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px 100px' }}>
        <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em', marginBottom: 10 }}>
          TROJAN BATTALION · JROTC
        </div>
        <h1 style={{ fontFamily: oswald, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 600, margin: '0 0 30px' }}>
          Military Ball Signup
        </h1>
        {children}
      </div>
    </div>
  );
}
