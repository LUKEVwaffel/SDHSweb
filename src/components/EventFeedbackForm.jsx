import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';
import posthog from '../lib/posthog';

// Public, no-login, phone-first post-event feedback form. Self-contained
// route (own chrome, no TopNav/Footer — same bypass as /review, /tv) since
// this is meant to be opened straight from a shared link/text, not browsed
// to from the site. General/reusable: any event with feedback_enabled=true
// gets this same form via /feedback/:eventId — see supabase/event_feedback.sql.
//
// Cadets have never drafted an AAR before, so every question ships with a
// short "good answer" example instead of a blank box and a hope.

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.22)', green: '#27AE60', red: '#C0392B',
};

const LET_LEVELS = ['LET 1', 'LET 2', 'LET 3', 'LET 4'];
const FUN_LABELS = ['Rough', 'Meh', 'Decent', 'Fun', 'Best one yet'];

const QUESTIONS = [
  {
    id: 'went_well',
    label: 'What went well? What was the best part?',
    example: '"The rafting itself was awesome, especially when we hit the big rapids near the end. Our guide was funny and made it feel safe even when we flipped."',
  },
  {
    id: 'needs_improvement',
    label: "What didn't go well, or could've been better?",
    example: '"We waited almost 2 hours at the bus before anything happened. Lunch ran out before the last group got food."',
  },
  {
    id: 'safety_concerns',
    label: 'Anything feel unsafe, disorganized, or confusing? (optional, but flag it if so)',
    example: '"Nobody told us where the bathrooms were until an hour in. One raft didn\'t have enough life jackets at first."',
  },
  {
    id: 'want_more_of',
    label: 'What do you want more of at events like this?',
    example: '"More free time to hang out at the river after. Maybe a group photo before we left."',
  },
];

function emptyForm() {
  return {
    submitter_name: '', submitter_type: 'cadet', let_level: '', company: '',
    went_well: '', needs_improvement: '', safety_concerns: '', want_more_of: '',
    fun_rating: 0, additional_notes: '',
  };
}

export default function EventFeedbackForm() {
  // Rendered outside <Routes> (App.jsx bypasses chrome for this path, same
  // as /admin and /review) — parse the id straight from the URL rather than
  // useParams, which needs an actual Route match to populate.
  const location = useLocation();
  const eventId = location.pathname.replace(/^\/feedback\/?/, '').split('/')[0];
  const [event, setEvent] = useState(undefined); // undefined=loading, null=not found
  const [form, setForm] = useState(emptyForm());
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | ok | err
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await SB.from('events').select('id,title,date,feedback_enabled').eq('id', eventId).maybeSingle();
      setEvent(data || null);
    })();
  }, [eventId]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const canSubmit = form.submitter_name.trim().length > 0 && form.fun_rating > 0 && !!form.let_level;

  async function submit(e) {
    e.preventDefault();
    if (honeypot) { setState('ok'); return; } // bot
    if (!canSubmit || state === 'busy') return;
    setState('busy');
    setErrMsg('');
    const fp = await getDeviceId().catch(() => null);
    const { error } = await SB.from('event_feedback').insert({
      event_id: eventId,
      submitter_name: form.submitter_name.trim(),
      submitter_type: form.submitter_type,
      let_level: form.let_level || null,
      company: form.company.trim() || null,
      went_well: form.went_well.trim() || null,
      needs_improvement: form.needs_improvement.trim() || null,
      safety_concerns: form.safety_concerns.trim() || null,
      want_more_of: form.want_more_of.trim() || null,
      fun_rating: form.fun_rating,
      additional_notes: form.additional_notes.trim() || null,
      submitter_fp: fp,
    });
    if (error) {
      setState('err');
      setErrMsg('Could not submit — please try again in a minute.');
      return;
    }
    posthog.capture('event_feedback_submitted', { event_id: eventId });
    setState('ok');
  }

  if (event === undefined) {
    return <Shell><Centered>Loading…</Centered></Shell>;
  }
  if (event === null) {
    return <Shell><Centered>Feedback form not found. Double-check the link.</Centered></Shell>;
  }
  if (!event.feedback_enabled) {
    return <Shell><Centered>Feedback isn't open for this event right now.</Centered></Shell>;
  }
  if (state === 'ok') {
    return (
      <Shell>
        <Centered>
          <div style={{ fontSize: 34, marginBottom: 14 }}>✓</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: P.cream, fontWeight: 600, marginBottom: 8 }}>
            Thanks — feedback sent.
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, maxWidth: 360 }}>
            S-5 reads every submission. This is exactly the kind of thing that shapes how the next event runs.
          </div>
        </Centered>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 18px 60px' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.2em', marginBottom: 6 }}>
          EVENT FEEDBACK
        </div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 24, color: P.cream, fontWeight: 600, letterSpacing: '0.01em' }}>
          {event.title}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute, marginTop: 12, lineHeight: 1.6 }}>
          This is your chance to tell S-5 what actually happened out there — what worked, what didn't, and what you want more of.
          Be specific and honest; short one-word answers don't help anyone plan the next one. Nobody's grading you on this.
        </div>

        <form onSubmit={submit} style={{ marginTop: 26 }}>
          <Field label="Your name">
            <TextInput value={form.submitter_name} onChange={(v) => set('submitter_name', v)} placeholder="First and last name" />
          </Field>

          <Field label="You are a...">
            <Pills options={[{ value: 'cadet', label: 'Cadet' }, { value: 'staff', label: 'Staff' }]} value={form.submitter_type} onChange={(v) => set('submitter_type', v)} />
          </Field>

          <Field label="LET level">
            <Pills options={LET_LEVELS.map((l) => ({ value: l, label: l }))} value={form.let_level} onChange={(v) => set('let_level', v)} />
          </Field>

          <Field label="Company (optional)">
            <TextInput value={form.company} onChange={(v) => set('company', v)} placeholder="e.g. Alpha Company" />
          </Field>

          <Field label="How fun was this event overall?">
            <div style={{ display: 'flex', gap: 8 }}>
              {FUN_LABELS.map((label, i) => {
                const val = i + 1;
                const active = form.fun_rating === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set('fun_rating', val)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      background: active ? P.gold : 'transparent', border: `1px solid ${active ? P.gold : P.hair}`,
                      color: active ? P.ink : P.mute, padding: '10px 4px', cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{val}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {QUESTIONS.map((q) => (
            <Field key={q.id} label={q.label}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: P.faint, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5 }}>
                Good answer looks like: {q.example}
              </div>
              <TextInput multiline value={form[q.id]} onChange={(v) => set(q.id, v)} placeholder="Type your answer…" />
            </Field>
          ))}

          <Field label="Anything else? (optional)">
            <TextInput multiline value={form.additional_notes} onChange={(v) => set('additional_notes', v)} placeholder="Anything that didn't fit above…" />
          </Field>

          <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            name="website" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />

          {errMsg && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.red, marginTop: 12 }}>{errMsg}</div>}

          <button
            type="submit"
            disabled={!canSubmit || state === 'busy'}
            style={{
              width: '100%', marginTop: 24, background: canSubmit ? P.gold : 'transparent',
              border: `1px solid ${canSubmit ? P.gold : P.hair}`, color: canSubmit ? P.ink : P.faint,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.14em', fontWeight: 600,
              padding: '15px 22px', cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {state === 'busy' ? 'SENDING…' : 'SUBMIT FEEDBACK →'}
          </button>
          {!canSubmit && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.faint, letterSpacing: '0.06em', marginTop: 10, textAlign: 'center' }}>
              Name, LET level, and a fun rating are required — everything else helps but is optional.
            </div>
          )}
        </form>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div style={{ minHeight: '100vh', background: P.ink, fontFamily: 'Inter, sans-serif' }}>{children}</div>;
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14.5, color: P.cream, fontWeight: 500, marginBottom: 9 }}>{label}</div>
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
  if (multiline) return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} maxLength={3000} style={{ ...style, lineHeight: 1.55 }} />;
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
              background: active ? P.gold : 'transparent', border: `1px solid ${active ? P.gold : P.hair}`,
              color: active ? P.ink : P.mute, fontFamily: 'Inter, sans-serif', fontSize: 12.5,
              fontWeight: active ? 600 : 400, padding: '9px 15px', cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
