import { Field, TextInput, TextArea, Radio, Btn } from './formUi';
import { P, mono } from '../../admin/theme';

// Step 2 — cadet details: age, gender, allergies (all manual entry per spec),
// plus the optional notification email for status update emails.
export default function StepCadetDetails({ cadet, value, onChange, onBack, onNext }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const canContinue = value.age && Number(value.age) > 0 && value.gender;

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

      <Field label="FOOD ALLERGIES (leave blank if none)">
        <TextArea rows={2} value={value.allergies} onChange={set('allergies')} placeholder="e.g. peanuts, shellfish" />
      </Field>

      <Field label="PERSONAL EMAIL FOR STATUS UPDATES (optional)">
        <TextInput type="email" value={value.notification_email} onChange={set('notification_email')} placeholder="you@example.com" />
        <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 6 }}>
          If provided, we'll email you when your guest finishes verification, cash is received, and your field trip form is received.
          Leave blank and you'd need to check back another way.
        </div>
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
