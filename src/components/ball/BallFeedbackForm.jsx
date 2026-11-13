import { useState } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { getDeviceId } from '../../lib/fingerprint';
import posthog from '../../lib/posthog';

// Public /ballfeedback — short QR-code form handed out at the Ball. No login,
// own chrome (App.jsx bypass, like /feedback). Two halves: how the night went,
// and how the online reservation/setup process went. Kept deliberately short
// (2 taps required, everything else optional) so people actually finish it
// on a phone at the table. Table: supabase/BALL_FEEDBACK.sql.

const P = {
  ink: '#06101F', deep: '#0A1628', gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.25)', red: '#E06B5B',
};
const SERIF = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const SANS = 'Inter, system-ui, sans-serif';
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const ATTENDEE = [
  { value: 'cadet', label: 'Cadet' },
  { value: 'guest', label: 'Guest / Date' },
  { value: 'parent', label: 'Parent' },
  { value: 'staff', label: 'Staff' },
];
const BALL_LABELS = ['Rough', 'Okay', 'Good', 'Great', 'Unforgettable'];
const SETUP_LABELS = ['Confusing', 'Clunky', 'Fine', 'Easy', 'Super easy'];
const SETUP_ISSUES = [
  { value: 'signup', label: 'Signing up / reserving' },
  { value: 'guest_invite', label: 'Adding my guest' },
  { value: 'payment', label: 'Payment' },
  { value: 'dress', label: 'Dress / attire approval' },
  { value: 'emails', label: 'Emails / reminders' },
  { value: 'checkin', label: 'Check-in at the door' },
];

const emptyForm = () => ({
  attendee_type: '', ball_rating: 0, setup_rating: 0, setup_issues: [],
  best_part: '', improve: '', submitter_name: '',
});

export default function BallFeedbackForm() {
  const [form, setForm] = useState(emptyForm);
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState('idle'); // idle | busy | ok | err
  const [errMsg, setErrMsg] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const toggleIssue = (value) => setForm((f) => ({
    ...f,
    setup_issues: f.setup_issues.includes(value)
      ? f.setup_issues.filter((v) => v !== value)
      : [...f.setup_issues, value],
  }));

  const canSubmit = !!form.attendee_type && form.ball_rating > 0;

  async function submit(e) {
    e.preventDefault();
    if (honeypot) { setStatus('ok'); return; }
    if (!canSubmit || status === 'busy') return;
    setStatus('busy');
    setErrMsg('');
    const fp = await getDeviceId().catch(() => null);
    const { error } = await SB.from('ball_feedback').insert({
      attendee_type: form.attendee_type,
      ball_rating: form.ball_rating,
      setup_rating: form.setup_rating || null,
      setup_issues: form.setup_issues,
      best_part: form.best_part.trim() || null,
      improve: form.improve.trim() || null,
      submitter_name: form.submitter_name.trim() || null,
      submitter_fp: fp,
    });
    if (error) {
      console.error('ball_feedback insert failed', error);
      setStatus('err');
      setErrMsg(/too many/i.test(error.message || '')
        ? 'Looks like you already sent feedback — thank you!'
        : 'Could not send — check your signal and try again.');
      return;
    }
    posthog.capture('ball_feedback_submitted', { ball_rating: form.ball_rating, setup_rating: form.setup_rating || null });
    setStatus('ok');
  }

  if (status === 'ok') {
    return (
      <Shell>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 44, color: P.gold, lineHeight: 1 }}>Thank you</div>
            <p style={{ fontFamily: SANS, fontSize: 14, color: P.mute, maxWidth: 340, margin: '14px auto 0', lineHeight: 1.6 }}>
              Your feedback goes straight to the Ball planning team and shapes next year's night. Enjoy the rest of the evening.
            </p>
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '36px 18px 64px' }}>
        <header>
          <div style={{ fontFamily: MONO, fontSize: 10, color: P.gold, letterSpacing: '0.24em' }}>TROJAN BATTALION · MILITARY BALL</div>
          <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 38, color: P.cream, margin: '8px 0 0', lineHeight: 1.05 }}>
            How was your night?
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 13.5, color: P.mute, margin: '10px 0 0', lineHeight: 1.6 }}>
            About a minute. Only the first two questions are required.
          </p>
        </header>

        <form onSubmit={submit} style={{ marginTop: 28 }}>
          <Field label="I'm a…" required>
            <Pills options={ATTENDEE} isActive={(v) => form.attendee_type === v} onPick={(v) => set('attendee_type', v)} />
          </Field>

          <Field label="How was the Ball overall?" required>
            <Scale labels={BALL_LABELS} value={form.ball_rating} onChange={(v) => set('ball_rating', v)} />
          </Field>

          <Field label="Best part of the night?">
            <TextArea value={form.best_part} onChange={(v) => set('best_part', v)} placeholder="Dinner, dancing, ceremony, photos…" />
          </Field>

          <Divider label="RESERVATION & SETUP" />

          <Field label="How easy was signing up and getting ready through the website?" hint="Reserving, adding a guest, payment, dress approval, emails.">
            <Scale labels={SETUP_LABELS} value={form.setup_rating} onChange={(v) => set('setup_rating', v)} />
          </Field>

          <Field label="Anything give you trouble?" hint="Tap all that apply.">
            <Pills options={SETUP_ISSUES} isActive={(v) => form.setup_issues.includes(v)} onPick={toggleIssue} />
          </Field>

          <Field label="What should we fix or do differently next year?">
            <TextArea value={form.improve} onChange={(v) => set('improve', v)} placeholder="About the night or the website — anything helps." />
          </Field>

          <Field label="Name (optional)">
            <input value={form.submitter_name} onChange={(e) => set('submitter_name', e.target.value)} maxLength={120}
              placeholder="Leave blank to stay anonymous" style={inputStyle} />
          </Field>

          <input aria-hidden="true" tabIndex={-1} autoComplete="off" name="website" value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />

          {errMsg && <p role="alert" style={{ fontFamily: MONO, fontSize: 11.5, color: P.red, margin: '0 0 12px' }}>{errMsg}</p>}

          <button type="submit" disabled={!canSubmit || status === 'busy'} style={{
            width: '100%', marginTop: 8, padding: '16px 20px', cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? P.gold : 'transparent', color: canSubmit ? P.ink : P.faint,
            border: `1px solid ${canSubmit ? P.gold : P.hair}`, borderRadius: 2,
            fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.16em',
          }}>
            {status === 'busy' ? 'SENDING…' : 'SEND FEEDBACK'}
          </button>
        </form>
      </main>
    </Shell>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: P.deep, color: P.cream,
  border: `1px solid ${P.hair}`, borderRadius: 2, padding: '12px 13px',
  fontFamily: SANS, fontSize: 15, outline: 'none',
};

function Shell({ children }) {
  return <div style={{ minHeight: '100vh', background: `radial-gradient(ellipse at top, #12233d 0%, ${P.ink} 60%)` }}>{children}</div>;
}

function Field({ label, hint, required, children }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 24px' }}>
      <legend style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: P.cream, marginBottom: hint ? 4 : 10, padding: 0 }}>
        {label}{required && <span style={{ color: P.gold }}> *</span>}
      </legend>
      {hint && <div style={{ fontFamily: SANS, fontSize: 12, color: P.faint, marginBottom: 10 }}>{hint}</div>}
      {children}
    </fieldset>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '34px 0 22px' }}>
      <span style={{ flex: 1, height: 1, background: P.hair }} />
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: P.gold }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: P.hair }} />
    </div>
  );
}

function Scale({ labels, value, onChange }) {
  return (
    <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const active = value === n;
        return (
          <button key={n} type="button" role="radio" aria-checked={active} onClick={() => onChange(n)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '11px 2px',
            background: active ? P.gold : 'transparent', color: active ? P.ink : P.mute,
            border: `1px solid ${active ? P.gold : P.hair}`, borderRadius: 2, cursor: 'pointer',
            fontFamily: SANS, fontSize: 10.5, fontWeight: active ? 700 : 400, lineHeight: 1.2,
          }}>
            <span style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1 }}>{n}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Pills({ options, isActive, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const active = isActive(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={active} onClick={() => onPick(o.value)} style={{
            background: active ? P.gold : 'transparent', color: active ? P.ink : P.mute,
            border: `1px solid ${active ? P.gold : P.hair}`, borderRadius: 999, cursor: 'pointer',
            padding: '9px 15px', fontFamily: SANS, fontSize: 13, fontWeight: active ? 600 : 400,
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TextArea({ value, onChange, placeholder }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    rows={3} maxLength={2000} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />;
}
