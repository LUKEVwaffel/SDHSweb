import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../../admin/theme';
import '../ball.css';
import { Field, TextInput, TextArea, Radio, Btn, ErrorText } from './formUi';
import DressCodeDetails from '../DressCodeDetails';
import { submitVipSignup } from '../../../lib/ballApi';
import { isSchoolEmail } from '../../../lib/schoolEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_OPTIONS = [
  { value: 'visiting_xo_bc', label: 'VISITING XO / BC — ANOTHER JROTC UNIT' },
  { value: 'past_king_queen', label: 'PAST BALL KING / QUEEN' },
];

function fmtShort(d) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

// Standalone one-page signup for the small set of attendees who can never
// pass the normal cadet-verify roster check (StepCadetVerify.jsx): visiting
// XO/BC from another Hamilton County JROTC unit, or a past Ball King/Queen.
// No date required, comped — no payment or field trip form section.
// Instructors are NOT handled here; they go through Chief directly.
export default function BallVipSignup() {
  const [deadline, setDeadline] = useState(null);
  const [form, setForm] = useState({
    name: '', role: null, home_school: '', age: '', gender: null,
    has_allergy: null, allergy_detail: '', personal_email: '', phone: '',
    dress_code_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    SB.from('ball_config').select('signup_deadline, dress_code_text').maybeSingle()
      .then(({ data }) => setDeadline(data || null));
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const email = form.personal_email.trim();
  const emailEntered = email.length > 0;
  const emailOk = EMAIL_RE.test(email) && !isSchoolEmail(email);
  const emailBad = emailEntered && !emailOk;

  const closed = deadline?.signup_deadline
    ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) > deadline.signup_deadline
    : false;

  // Only a female VIP has a dress code to acknowledge — a male VIP wears his
  // own unit's Class A, nothing to submit or approve here.
  const isFemale = form.gender === 'female';
  const canSubmit = form.name.trim() && form.role && form.home_school.trim()
    && form.age && Number(form.age) > 0 && form.gender
    && form.has_allergy !== null && (form.has_allergy === false || form.allergy_detail.trim())
    && emailOk && (!isFemale || form.dress_code_accepted);

  async function submit() {
    setBusy(true);
    setErr('');
    const { error } = await submitVipSignup({
      name: form.name.trim(),
      role: form.role,
      home_school: form.home_school.trim(),
      age: Number(form.age),
      gender: form.gender,
      has_allergy: form.has_allergy === true,
      allergy_detail: form.has_allergy === true ? form.allergy_detail.trim() : null,
      personal_email: email,
      phone: form.phone.trim() || null,
      dress_code_accepted: form.dress_code_accepted,
    });
    setBusy(false);
    if (error) { setErr(error); return; }
    setSubmitted(true);
  }

  return (
    <div className="ball-root">
      <div className="ball-shell" style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px 100px' }}>
        <div className="ball-fade-up" style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.3em', marginBottom: 10 }}>
          TROJAN BATTALION · JROTC
        </div>
        <h1 className="ball-fade-up ball-d1" style={{ fontFamily: oswald, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 600, margin: '0 0 12px' }}>
          Military Ball — Visiting Guest Signup
        </h1>
        <p className="ball-fade-up ball-d2" style={{ fontFamily: mono, fontSize: 12, color: P.mute, lineHeight: 1.7, margin: '0 0 20px', maxWidth: 470 }}>
          For a visiting XO/BC from another Hamilton County JROTC unit, or a past Trojan Battalion Ball King or Queen.
          No ticket cost — you&apos;re a guest of the battalion. Not the right form?{' '}
          <a href="/ball/signup" style={{ color: P.gold }}>Cadet signup is here</a>. Instructors: see Chief directly.
        </p>
        {deadline?.signup_deadline && (
          <div className="ball-fade-up ball-d3" style={{
            border: `1px solid ${P.gold}`, background: P.goldWash, padding: '10px 14px', marginBottom: 30,
            fontFamily: mono, fontSize: 12, color: P.cream, letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="ball-dot" />
            <span><span style={{ color: P.gold, letterSpacing: '0.18em' }}>DEADLINE</span>{'  '}Sign up by <strong>{fmtShort(deadline.signup_deadline)}</strong>. No signups after this date.</span>
          </div>
        )}

        <div className="ball-fade-up ball-d4">
          {closed && !submitted ? (
            <div style={{
              border: `1px solid ${P.hairStrong}`, background: P.navy, padding: 28,
              fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7,
            }}>
              <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.14em', marginBottom: 10 }}>
                REGISTRATION CLOSED
              </div>
              The signup deadline ({fmtShort(deadline.signup_deadline)}) has passed. See Chief with any questions.
            </div>
          ) : submitted ? (
            <div className="ball-scale-in" style={{ border: `1px solid ${P.gold}`, background: P.navy, padding: 28 }}>
              <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, letterSpacing: '0.14em', marginBottom: 14 }}>YOU&apos;RE ON THE LIST</div>
              <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7, margin: '0 0 10px' }}>
                Thanks, {form.name}. You&apos;re registered as a guest of the battalion — no ticket cost, nothing to pay.
              </p>
              <p style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.7, margin: 0 }}>
                Follow the dress code above and check in with Chief at the door. Questions before then, see Chief.
              </p>
            </div>
          ) : (
            <div className="ball-step">
              <Field label="FULL NAME">
                <TextInput value={form.name} onChange={set('name')} placeholder="Your full name" />
              </Field>

              <Field label="WHO ARE YOU SIGNING UP AS?">
                <Radio value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLE_OPTIONS} ariaLabel="Role" />
              </Field>

              <Field label="YOUR SCHOOL / JROTC UNIT">
                <TextInput value={form.home_school} onChange={set('home_school')} placeholder="e.g. Central High School JROTC" />
              </Field>

              <Field label="AGE">
                <TextInput type="number" min="1" max="99" inputMode="numeric" value={form.age} onChange={set('age')} placeholder="Your age" />
              </Field>

              <Field label="GENDER">
                <Radio
                  value={form.gender}
                  onChange={(v) => setForm({ ...form, gender: v })}
                  options={[{ value: 'male', label: 'MALE' }, { value: 'female', label: 'FEMALE' }]}
                  ariaLabel="Gender"
                />
              </Field>

              <Field label="DO YOU HAVE A FOOD ALLERGY?">
                <Radio
                  value={form.has_allergy === true ? 'yes' : form.has_allergy === false ? 'no' : ''}
                  onChange={(v) => setForm({ ...form, has_allergy: v === 'yes' })}
                  options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
                  ariaLabel="Food allergy"
                />
              </Field>

              {form.has_allergy === true && (
                <Field label="WHAT ARE YOU ALLERGIC TO?">
                  <TextArea rows={2} value={form.allergy_detail} onChange={set('allergy_detail')} placeholder="e.g. peanuts, shellfish" />
                </Field>
              )}

              <Field label="PERSONAL EMAIL">
                <TextInput type="email" value={form.personal_email} onChange={set('personal_email')} placeholder="you@gmail.com" />
                <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.6 }}>
                  In case Chief needs to reach you about your allergy or the event.
                </div>
                {emailBad && (
                  <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 4 }}>
                    {isSchoolEmail(email) ? 'Use a personal email, not a school one.' : 'Enter a valid email address.'}
                  </div>
                )}
              </Field>

              <Field label="PHONE (OPTIONAL)">
                <TextInput type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(423) 555-0123" />
              </Field>

              {form.gender === 'male' && (
                <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: 18, margin: '28px 0 18px' }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.16em', marginBottom: 8 }}>ATTIRE</div>
                  <div style={{ fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.65 }}>
                    Wear your own JROTC unit&apos;s Class A uniform. Nothing else required — no dress code, no approval step.
                  </div>
                </div>
              )}

              {form.gender === 'female' && (
                <>
                  <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.14em', margin: '28px 0 10px' }}>DRESS CODE</div>
                  <DressCodeDetails only="female" simple note={deadline?.dress_code_text} />

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: mono, fontSize: 12, color: P.mute, margin: '18px 0', cursor: 'pointer', lineHeight: 1.6 }}>
                    <input
                      type="checkbox"
                      checked={form.dress_code_accepted}
                      onChange={(e) => setForm({ ...form, dress_code_accepted: e.target.checked })}
                      style={{ marginTop: 2 }}
                    />
                    I&apos;ve read the dress code above, will follow it, and will send a photo of my dress to an approver before the ball.
                  </label>
                </>
              )}

              <ErrorText>{err}</ErrorText>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <Btn onClick={submit} busy={busy} disabled={!canSubmit}>{busy ? 'SUBMITTING' : 'SUBMIT →'}</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
