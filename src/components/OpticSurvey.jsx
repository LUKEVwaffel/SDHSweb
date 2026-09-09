import { useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';
import posthog from '../lib/posthog';
import {
  CAMPAIGN_ID, INTRO, RAIDER_TEAMS, PHONE_TYPES, QUESTIONS, TEXT_QUESTIONS,
} from '../lib/opticSurveyQuestions';

// Public, no-login, phone-first post-competition parent survey for OPTIC.
// Self-contained route (own chrome, no TopNav/Footer, same bypass as
// /feedback and /review) reached at /survey, meant to be opened from a
// group-text link or QR after a comp.
//
// Flow: a thank-you intro screen -> the form -> a confirmation screen. A
// once-per-device localStorage flag (keyed to CAMPAIGN_ID) shows a short
// "already sent" screen on return, with an escape hatch to send another.
// Storage: one row per submission in public.optic_survey_responses. Slugs
// come from opticSurveyQuestions.js and must match supabase/optic_survey.sql.

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.22)', green: '#27AE60', red: '#C0392B',
};

const DONE_KEY = `tb_optic_survey_done_${CAMPAIGN_ID}`;

function hasSubmitted() {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
}
function markSubmitted() {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* non-fatal */ }
}

function emptyForm() {
  return {
    submitter_name: '', raider_team: '', phone_type: '',
    ...Object.fromEntries(QUESTIONS.map((q) => [q.id, ''])),
    ...Object.fromEntries(TEXT_QUESTIONS.map((q) => [q.id, ''])),
  };
}

export default function OpticSurvey() {
  const [phase, setPhase] = useState(hasSubmitted() ? 'done_prior' : 'intro'); // intro | form | done_prior
  const [form, setForm] = useState(emptyForm());
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | ok | err
  const [errMsg, setErrMsg] = useState('');

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canSubmit = !!form.overall && !!form.phone_type;

  async function submit(e) {
    e.preventDefault();
    if (honeypot) { setState('ok'); return; } // bot
    if (!canSubmit || state === 'busy') return;
    setState('busy');
    setErrMsg('');
    const fp = await getDeviceId().catch(() => null);

    const mcCols = Object.fromEntries(
      QUESTIONS.map((q) => [q.id, form[q.id] || null]),
    );
    const textCols = Object.fromEntries(
      TEXT_QUESTIONS.map((q) => [q.id, form[q.id].trim() || null]),
    );

    const { error } = await SB.from('optic_survey_responses').insert({
      campaign_id: CAMPAIGN_ID,
      submitter_name: form.submitter_name.trim() || null,
      raider_team: form.raider_team || null,
      phone_type: form.phone_type,
      ...mcCols,
      ...textCols,
      submitter_fp: fp,
    });

    if (error) {
      setState('err');
      setErrMsg('Could not send. Please try again in a minute.');
      return;
    }
    posthog.capture('optic_survey_submitted', {
      campaign_id: CAMPAIGN_ID, overall: form.overall, phone_type: form.phone_type,
    });
    markSubmitted();
    setState('ok');
  }

  if (state === 'ok') {
    return (
      <Shell>
        <Centered>
          <div style={{ fontSize: 34, marginBottom: 14 }}>✓</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(17px, 5vw, 20px)', color: P.cream, fontWeight: 600, marginBottom: 8 }}>
            Sent. Thank you.
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, maxWidth: 380, lineHeight: 1.6 }}>
            Every answer gets read. This is what decides whether OPTIC comes back
            for the Raider competitions coming up.
          </div>
        </Centered>
      </Shell>
    );
  }

  if (phase === 'done_prior') {
    return (
      <Shell>
        <Centered>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.2em', marginBottom: 10 }}>
            OPTIC SURVEY
          </div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(17px, 5vw, 20px)', color: P.cream, fontWeight: 600, marginBottom: 8 }}>
            You already sent this. Thank you.
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
            Got more to add, or filling this out for a second phone? You can send another response.
          </div>
          <button type="button" onClick={() => { setForm(emptyForm()); setPhase('form'); }} style={ghostBtn}>
            SEND ANOTHER RESPONSE →
          </button>
        </Centered>
      </Shell>
    );
  }

  if (phase === 'intro') {
    return (
      <Shell>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '44px 18px 56px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: 14 }}>
            {INTRO.kicker}
          </div>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(22px, 6.5vw, 30px)', color: P.cream, fontWeight: 600, letterSpacing: '0.01em', margin: '0 0 20px', lineHeight: 1.15 }}>
            {INTRO.title}
          </h1>
          {INTRO.paragraphs.map((para, i) => (
            <p key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: 14.5, color: i === 0 ? P.cream : P.mute, lineHeight: 1.7, margin: '0 0 16px' }}>
              {para}
            </p>
          ))}
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.faint, letterSpacing: '0.04em', lineHeight: 1.6, margin: '26px 0 24px', paddingLeft: 14, borderLeft: `2px solid ${P.hair}` }}>
            {INTRO.meta}
          </div>
          <button type="button" onClick={() => setPhase('form')} style={goldBtn}>
            START THE SURVEY →
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 18px 64px' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.2em', marginBottom: 6 }}>
          OPTIC SURVEY
        </div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 'clamp(18px, 5.5vw, 22px)', color: P.cream, fontWeight: 600, letterSpacing: '0.01em' }}>
          How did it actually go?
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, marginTop: 10, lineHeight: 1.6 }}>
          Just tap your answers. The written boxes at the end are optional, so add
          detail only if you feel like it. Nothing here is graded.
        </div>

        <form onSubmit={submit} style={{ marginTop: 26 }}>
          <Field label="Your name (optional)">
            <TextInput value={form.submitter_name} onChange={(v) => set('submitter_name', v)} placeholder="So we can follow up if you flag something" />
          </Field>

          <Field label="Which team is your cadet on? (optional)">
            <Pills options={RAIDER_TEAMS} value={form.raider_team} onChange={(v) => set('raider_team', v)} />
          </Field>

          <Field label="What phone did you use?">
            <Pills options={PHONE_TYPES} value={form.phone_type} onChange={(v) => set('phone_type', v)} />
          </Field>

          <div style={{ height: 1, background: P.hair, margin: '30px 0' }} />

          {QUESTIONS.map((q) => (
            <Field key={q.id} label={q.prompt}>
              <Pills options={q.options} value={form[q.id]} onChange={(v) => set(q.id, v)} />
            </Field>
          ))}

          <div style={{ height: 1, background: P.hair, margin: '30px 0' }} />

          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, color: P.cream, fontWeight: 600, marginBottom: 6 }}>
            Optional written answers
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: P.mute, lineHeight: 1.6, marginBottom: 22 }}>
            None of these are required. Skip every one of them and your survey still
            counts. They are just here if you want to say more than the taps allow.
          </div>

          {TEXT_QUESTIONS.map((q) => (
            <Field key={q.id} label={`${q.label} (optional)`}>
              {q.example && (
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: P.faint, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.55 }}>
                  Good answer looks like: {q.example}
                </div>
              )}
              <TextInput multiline value={form[q.id]} onChange={(v) => set(q.id, v)} placeholder="Optional, leave blank to skip" />
            </Field>
          ))}

          <input
            aria-hidden="true" tabIndex={-1} autoComplete="off" name="website"
            value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
          />

          {errMsg && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.red, marginTop: 12 }}>{errMsg}</div>}

          <button
            type="submit"
            disabled={!canSubmit || state === 'busy'}
            style={{
              width: '100%', marginTop: 24,
              background: canSubmit ? P.gold : 'transparent',
              border: `1px solid ${canSubmit ? P.gold : P.hair}`,
              color: canSubmit ? P.ink : P.faint,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.14em', fontWeight: 600,
              padding: '15px 22px', cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {state === 'busy' ? 'SENDING…' : 'SEND FEEDBACK →'}
          </button>
          {!canSubmit && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.faint, letterSpacing: '0.06em', marginTop: 10, textAlign: 'center' }}>
              The first question and your phone type are required. Everything else is optional.
            </div>
          )}
        </form>
      </div>
    </Shell>
  );
}

const goldBtn = {
  background: P.gold, border: `1px solid ${P.gold}`, color: P.ink,
  fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.14em', fontWeight: 600,
  padding: '14px 26px', cursor: 'pointer',
};
const ghostBtn = {
  background: 'transparent', border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.12em', fontWeight: 600,
  padding: '12px 20px', cursor: 'pointer',
};

function Shell({ children }) {
  return <div style={{ minHeight: '100vh', background: P.ink, fontFamily: 'Inter, sans-serif' }}>{children}</div>;
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14.5, color: P.cream, fontWeight: 500, marginBottom: 9, lineHeight: 1.35 }}>{label}</div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, multiline, placeholder }) {
  const style = {
    width: '100%', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
    fontFamily: 'Inter, sans-serif', fontSize: 13.5, padding: '11px 13px', outline: 'none',
    boxSizing: 'border-box', resize: 'vertical',
  };
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} maxLength={3000} style={{ ...style, lineHeight: 1.55 }} />;
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={200} style={style} />;
}

function Pills({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              background: active ? P.gold : 'transparent',
              border: `1px solid ${active ? P.gold : P.hair}`,
              color: active ? P.ink : P.mute,
              fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: active ? 600 : 400,
              padding: '11px 16px', minHeight: 44, lineHeight: 1.3,
              display: 'inline-flex', alignItems: 'center', textAlign: 'left',
              maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere',
              cursor: 'pointer', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
