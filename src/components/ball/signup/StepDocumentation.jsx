import { useState, useEffect } from 'react';
import { P, mono } from '../../admin/theme';
import { supabase as SB } from '../../../lib/supabaseClient';
import { submitSignup } from '../../../lib/ballApi';
import { Btn, ErrorText } from './formUi';

// Step 4 — documentation / info + final submit. Shows what the host owes
// (couple rate for a date, own rate for solo or a friend + a separate line
// for the friend's own share), the field trip form ONLY when it applies (host
// solo, or an in-program SDHS date), payment instructions, and the dress /
// attire step (female cadet → photo approval; male cadet → fixed Class A).
function money(n) {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

export default function StepDocumentation({ signupToken, cadetGender, cadetDetails, guest, onBack, onSubmitted, onSessionExpired }) {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    SB.from('ball_config')
      .select('field_trip_form_pdf_url, dress_code_text, dress_approvers, weston_name, weston_phone, price_cadet, price_couple')
      .maybeSingle()
      .then(({ data }) => setConfig(data));
  }, []);

  const hasGuest = guest.bringing_guest === true;
  const guestType = hasGuest ? guest.guest_type : null;
  const isFriend = guestType === 'friend';
  // Any SDHS student attending needs the field trip form: the cadet always,
  // plus a guest who is an SDHS student (in-program roster cadet OR attends
  // Soddy Daisy). Applies whether the guest is a date or a friend.
  const guestIsSdhsStudent = (guestType === 'date' && guest.is_sdhs_jrotc) || guest.goes_to_sdhs === true;
  const formRequired = !hasGuest || guestIsSdhsStudent;
  const hostDue = (!hasGuest || isFriend) ? config?.price_cadet : config?.price_couple;
  const friendDue = isFriend ? config?.price_cadet : null;
  const isFemale = cadetGender === 'female';
  const westonName = config?.weston_name || 'Weston';

  async function submit() {
    setBusy(true);
    setErr('');
    const { data, error } = await submitSignup(signupToken, {
      cadet_age: Number(cadetDetails.age),
      cadet_gender: cadetGender,
      cadet_has_allergy: cadetDetails.has_allergy === true,
      cadet_allergy_email: cadetDetails.has_allergy === true ? (cadetDetails.allergy_email || '').trim() : null,
      // When an allergy is flagged the personal email is required anyway, so
      // it doubles as the notification/confirmation address — the separate
      // optional field is hidden in that case (see StepCadetDetails).
      notification_email: (cadetDetails.has_allergy === true
        ? (cadetDetails.allergy_email || '').trim()
        : (cadetDetails.notification_email || '').trim()) || null,
      guest: hasGuest ? {
        guest_type: guest.guest_type,
        name: guest.name, age: Number(guest.age), gender: guest.gender,
        is_sdhs_jrotc: guest.is_sdhs_jrotc, sdhs_matched_cadet_id: guest.sdhs_matched_cadet_id,
        other_jrotc: guest.other_jrotc, other_jrotc_school: guest.other_jrotc_school,
        school_attended: guest.school_attended, goes_to_sdhs: guest.goes_to_sdhs,
        poc_name: guest.poc_name,
        poc_email: guest.poc_email, poc_phone: guest.poc_phone, personal_email: guest.personal_email,
        friend_payment_method: guest.friend_payment_method || null,
      } : null,
    });
    setBusy(false);
    if (error) {
      // Session-level failures (bad/expired token, or a token already burned by
      // a prior successful submit) send the cadet back to step 1 to re-verify.
      // "Signups are closed" and "you already have a signup on file" are
      // terminal — show them in place, re-verifying wouldn't change anything.
      if (/expired|invalid|already used/i.test(error)) { onSessionExpired(); return; }
      setErr(error);
      return;
    }
    onSubmitted(data);
  }

  return (
    <div>
      <p style={p}>
        What's left for you: {formRequired ? 'sign and turn in the field trip form, ' : ''}pay your ticket in full{isFemale ? ', and get your dress approved.' : '.'}
        {hasGuest ? ' After you submit, your guest gets an email with their own allergy + attire steps to finish.' : ''}
      </p>

      <Section title="WHAT YOU OWE">
        <p style={p}>
          Your ticket: <strong style={{ color: P.cream }}>{money(hostDue) || 'to be posted'}</strong>
          {guestType === 'date' ? ' — the couple rate, covering you and your date.' : ' — your ticket only.'}
        </p>
        {isFriend && (
          <p style={p}>
            {guest.name || 'Your friend'} owes their own <strong style={{ color: P.cream }}>{money(friendDue) || 'ticket'}</strong>,
            {guest.friend_payment_method === 'host_delivers'
              ? " which you'll bring in with yours."
              : ' which they will pay or deliver themselves.'}
            {' '}This is not included in your total above.
          </p>
        )}
        <p style={p}>Cash or check only, paid in full. No partial payments. Give it directly to 1SG Kaz or Chief.</p>
      </Section>

      <Section title="FIELD TRIP PERMISSION FORM">
        {formRequired ? (
          <>
            <p style={p}>
              Must be physically signed. No electronic signatures accepted. Every SDHS student attending fills one out &mdash; you, and your guest too if they go to Soddy Daisy.
            </p>
            {config?.field_trip_form_pdf_url ? (
              <a href={config.field_trip_form_pdf_url} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn }}>DOWNLOAD FORM ↓</a>
            ) : (
              <p style={p}>Pick one up from Chief's desk.</p>
            )}
          </>
        ) : (
          <p style={p}>
            Not required for this signup. The field trip form is only for Soddy Daisy students, and your guest goes to another school.
          </p>
        )}
      </Section>

      {isFemale ? (
        <Section title="DRESS APPROVAL">
          <p style={p}>{config?.dress_code_text || 'Dress code details will be provided by S-6.'}</p>
          <p style={p}>Text a photo of your dress to one of the approvers below for approval:</p>
          {(config?.dress_approvers || []).map((a, i) => (
            <div key={i} style={{ fontFamily: mono, fontSize: 13, padding: '6px 0', borderBottom: i < config.dress_approvers.length - 1 ? `1px solid ${P.hair}` : 'none' }}>
              {a.name} · {a.phone}
            </div>
          ))}
        </Section>
      ) : (
        <Section title="UNIFORM">
          <p style={p}>
            Full Class A uniform, the JROTC-issued set, not personally owned. This is a fixed requirement, so there's no
            photo-approval step.
          </p>
          <p style={p}>
            Questions about your Class A? Contact {westonName}{config?.weston_phone ? ` at ${config.weston_phone}` : ''}.
          </p>
        </Section>
      )}

      <ErrorText>{err}</ErrorText>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: P.mute, fontFamily: mono, fontSize: 12, cursor: 'pointer' }}>‹ BACK</button>
        <Btn onClick={submit} busy={busy}>{busy ? 'SUBMITTING' : 'SUBMIT SIGNUP →'}</Btn>
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
