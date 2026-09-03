import { Field, TextInput, Radio, Btn } from './formUi';
import { P, mono } from '../../admin/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Step 2 — cadet details: age, gender, a yes/no food-allergy flag, plus the
// optional notification email for status updates.
//
// Item 2: we do NOT collect allergy details here. If the cadet flags an
// allergy, a personal (non-school) email is REQUIRED — S-5 follows up
// directly about food options. Same personal-email pattern already used for
// guests in StepGuestInfo.
export default function StepCadetDetails({ cadet, value, onChange, onBack, onNext }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const hasAllergy = value.has_allergy === true;
  const allergyEmailOk = !hasAllergy || EMAIL_RE.test((value.allergy_email || '').trim());
  const canContinue = value.age && Number(value.age) > 0 && value.gender && value.has_allergy !== null && allergyEmailOk;

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
          onChange={(v) => onChange({ ...value, has_allergy: v === 'yes', allergy_email: v === 'yes' ? value.allergy_email : '' })}
          options={[{ value: 'yes', label: 'YES' }, { value: 'no', label: 'NO' }]}
        />
      </Field>

      {hasAllergy ? (
        <Field label="YOUR PERSONAL (NON-SCHOOL) EMAIL">
          <TextInput type="email" value={value.allergy_email} onChange={set('allergy_email')} placeholder="you@example.com" />
          <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
            Required. S-5 will email you directly about food options and accommodations. We don't collect allergy details on this form.
            We'll also send your signup confirmation and status updates to this address.
          </div>
        </Field>
      ) : (
        <Field label="PERSONAL EMAIL FOR STATUS UPDATES (optional)">
          <TextInput type="email" value={value.notification_email} onChange={set('notification_email')} placeholder="you@example.com" />
          <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
            If provided, we'll email you a signup confirmation, and again when your guest verifies, cash is received, and your field trip form is received.
            Leave blank and you'd need to check back another way.
          </div>
        </Field>
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
