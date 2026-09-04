import { Field, TextInput, Radio, Btn } from './formUi';
import { P, mono } from '../../admin/theme';
import { isSchoolEmail } from '../../../lib/schoolEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Step 2 — cadet details: age, gender, a yes/no food-allergy flag, and a
// contact method. PHONE is preferred (S-5 / ops reach the cadet fastest by
// call/text). A personal (non-school) email works instead. AT LEAST ONE is
// required — a cadet with neither can't finish online and signs up in person.
// We do NOT collect allergy details on this form.
export default function StepCadetDetails({ cadet, value, onChange, onBack, onNext }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  const email = (value.notification_email || '').trim();
  const emailEntered = email.length > 0;
  const emailOk = EMAIL_RE.test(email) && !isSchoolEmail(email);
  const emailBad = emailEntered && !emailOk;

  const phone = (value.phone || '').trim();
  const phoneEntered = phone.length > 0;
  const phoneOk = phone.replace(/\D/g, '').length >= 10;
  const phoneBad = phoneEntered && !phoneOk;

  const hasContact = phoneOk || emailOk;
  const canContinue =
    value.age && Number(value.age) > 0 && value.gender && value.has_allergy !== null
    && hasContact && !emailBad && !phoneBad;

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 6 }}>
        Signed up as <span style={{ color: P.gold }}>{cadet.name}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginBottom: 20, lineHeight: 1.6 }}>
        Your name is locked to your roster record. Fill in everything below yourself.
      </div>

      <Field label="YOUR AGE">
        <TextInput type="number" min="1" max="99" inputMode="numeric" value={value.age} onChange={set('age')} placeholder="Type your age" />
      </Field>

      <Field label="YOUR GENDER">
        <Radio
          value={value.gender}
          onChange={(v) => onChange({ ...value, gender: v })}
          options={[{ value: 'male', label: 'MALE' }, { value: 'female', label: 'FEMALE' }]}
        />
      </Field>

      <Field label="DO YOU HAVE A FOOD ALLERGY?">
        <Radio
          value={value.has_allergy === true ? 'yes' : value.has_allergy === false ? 'no' : ''}
          onChange={(v) => onChange({ ...value, has_allergy: v === 'yes' })}
          options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
        />
      </Field>

      <Field label="YOUR PHONE NUMBER (preferred)">
        <TextInput type="tel" inputMode="tel" value={value.phone || ''} onChange={set('phone')} placeholder="(423) 555-0123" />
        <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.6 }}>
          Your own cell — the fastest way for 1SG Kaz / Chief{value.has_allergy === true ? ' and S-5' : ''} to reach you (call or text) about payment, your field trip form{value.has_allergy === true ? ', or food options for your allergy' : ''}.
        </div>
        {phoneBad && (
          <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 4 }}>Enter a full phone number (at least 10 digits).</div>
        )}
      </Field>

      <Field label="YOUR PERSONAL (NON-SCHOOL) EMAIL">
        <TextInput type="email" value={value.notification_email} onChange={set('notification_email')} placeholder="you@gmail.com" />
        <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6, lineHeight: 1.6 }}>
          Optional if you gave a phone number. If you add it, we email your signup confirmation and every status update here{value.has_allergy === true ? ', and S-5 can reach you about food options' : ''}. A school (@hcde.org) address will not work.
        </div>
        {emailBad && (
          <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 4 }}>
            {isSchoolEmail(email) ? 'Use a personal email, not a school one.' : 'Enter a valid email address.'}
          </div>
        )}
      </Field>

      {!hasContact && (phoneEntered || emailEntered || value.gender) && (
        <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, lineHeight: 1.6, marginBottom: 12 }}>
          Give us a phone number or a personal email so the staff can reach you. No phone and no email? Sign up in person with 1SG Kaz or Chief.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: P.mute, fontFamily: mono, fontSize: 12, cursor: 'pointer' }}>
          ‹ BACK
        </button>
        <Btn onClick={onNext} disabled={!canContinue}>CONTINUE →</Btn>
      </div>
    </div>
  );
}
