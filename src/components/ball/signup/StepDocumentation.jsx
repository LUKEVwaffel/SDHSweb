import { useState, useEffect } from 'react';
import { P, mono } from '../../admin/theme';
import { supabase as SB } from '../../../lib/supabaseClient';
import { submitSignup } from '../../../lib/ballApi';
import { Btn, ErrorText } from './formUi';

// Step 4 — documentation / info + final submit. Field trip form (physical
// signature only, no e-sign), cash/check payment instructions, and — if the
// CADET is female — the dress code + 3 approvers' phone numbers (the guest
// gets her own copy of this on her verification page if she's female).
export default function StepDocumentation({ signupToken, cadetGender, cadetDetails, guest, onBack, onSubmitted, onSessionExpired }) {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    SB.from('ball_config').select('field_trip_form_pdf_url, dress_code_text, dress_approvers').maybeSingle()
      .then(({ data }) => setConfig(data));
  }, []);

  const hasGuest = guest.bringing_guest === true;

  async function submit() {
    setBusy(true);
    setErr('');
    const { data, error } = await submitSignup(signupToken, {
      cadet_age: Number(cadetDetails.age),
      cadet_gender: cadetGender,
      cadet_allergies: cadetDetails.allergies,
      notification_email: cadetDetails.notification_email || null,
      guest: hasGuest ? {
        name: guest.name, age: Number(guest.age), gender: guest.gender,
        is_sdhs_jrotc: guest.is_sdhs_jrotc, sdhs_matched_cadet_id: guest.sdhs_matched_cadet_id,
        other_jrotc: guest.other_jrotc, other_jrotc_school: guest.other_jrotc_school,
        school_attended: guest.school_attended, poc_name: guest.poc_name,
        poc_email: guest.poc_email, poc_phone: guest.poc_phone, personal_email: guest.personal_email,
      } : null,
    });
    setBusy(false);
    if (error) {
      if (/expired|invalid/i.test(error)) { onSessionExpired(); return; }
      setErr(error);
      return;
    }
    onSubmitted(data);
  }

  const isFemale = cadetGender === 'female';

  return (
    <div>
      <p style={p}>
        What's left for you: sign and turn in the field trip form, pay in full{isFemale ? ', and get your dress approved.' : '.'}
        {hasGuest ? ' After you submit, your guest gets an email with their own allergy + dress code steps to finish.' : ''}
      </p>

      <Section title="FIELD TRIP PERMISSION FORM">
        <p style={p}>
          Must be physically signed — no electronic signatures accepted. Only the SDHS cadet signs this, not the guest.
        </p>
        {config?.field_trip_form_pdf_url ? (
          <a href={config.field_trip_form_pdf_url} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn }}>DOWNLOAD FORM ↓</a>
        ) : (
          <p style={p}>Pick one up from Chief's desk.</p>
        )}
      </Section>

      <Section title="PAYMENT">
        <p style={p}>Cash or check only, paid in full — no partial payments. Give it directly to 1SG Kaz or Chief.</p>
      </Section>

      {isFemale && (
        <Section title="DRESS APPROVAL">
          <p style={p}>{config?.dress_code_text || 'Dress code details will be provided by S-6.'}</p>
          <p style={p}>Text a photo of your dress to one of the approvers below for approval:</p>
          {(config?.dress_approvers || []).map((a, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: 13, padding: '6px 0', borderBottom: i < config.dress_approvers.length - 1 ? `1px solid ${P.hair}` : 'none' }}>
              {a.name} — {a.phone}
            </div>
          ))}
        </Section>
      )}

      <ErrorText>{err}</ErrorText>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: P.mute, fontFamily: mono, fontSize: 12, cursor: 'pointer' }}>‹ BACK</button>
        <Btn onClick={submit} disabled={busy}>{busy ? 'SUBMITTING…' : 'SUBMIT SIGNUP →'}</Btn>
      </div>
    </div>
  );
}

const p = { fontFamily: mono, fontSize: 13, color: P.mute, lineHeight: 1.6, margin: '0 0 10px' };
const linkBtn = { display: 'inline-block', fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: P.ink, background: P.gold, padding: '10px 18px', textDecoration: 'none' };

function Section({ title, children }) {
  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: 20, marginBottom: 16 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.14em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
