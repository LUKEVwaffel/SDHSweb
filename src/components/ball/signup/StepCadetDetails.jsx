import { Field, TextInput, Radio, Btn } from './formUi';
import { P, mono } from '../../admin/theme';
import { isSchoolEmail } from '../../../lib/schoolEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Step 2 — cadet details: age, gender, a yes/no food-allergy flag, and a
// REQUIRED personal (non-school) email. Every signer must give one: it's where
// the signup confirmation/receipt goes and the only address S-5 / ops can
// reach over the summer. When an allergy is flagged it's also the S-5 contact.
// We do NOT collect allergy details on this form.
export default function StepCadetDetails({ cadet, value, onChange, onBack, onNext }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const email = (value.notification_email || '').trim();
  const emailValid = EMAIL_RE.test(email) && !isSchoolEmail(email);
  const canContinue = value.age && Number(value.age) > 0 && value.gender && value.has_allergy !== null && emailValid;

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: 20 }}>
        Signed up as <span style={{ color: P.gold }}>{cadet.name}</span>
      </div>

      <Field label="AGE">
        <TextInput type="number" min="1" value={value.age} onChange={set('age')} placeholder="16" />
      </Field>

      <Field label="GENDER">
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

      <Field label="YOUR PERSONAL (NON-SCHOOL) EMAIL">
        <TextInput type="email" value={value.notification_email} onChange={set('notification_email')} placeholder="you@gmail.com" />
        <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
          Required. We send your signup confirmation here, then again when your guest verifies, cash is received, and your field trip form is received.
          {value.has_allergy === true && ' S-5 will also email you directly about food options.'}
          {' '}A school (@hcde.org) address will not work.
        </div>
        {email && !emailValid && (
          <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 4 }}>
            {isSchoolEmail(email) ? 'Use a personal email, not a school one.' : 'Enter a valid email address.'}
          </div>
        )}
      </Field>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: P.mute, fontFamily: mono, fontSize: 12, cursor: 'pointer' }}>
          ‹ BACK
        </button>
        <Btn onClick={onNext} disabled={!canContinue}>CONTINUE →</Btn>
      </div>
    </div>
  );
}
