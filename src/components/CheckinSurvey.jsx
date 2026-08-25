import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';
import { QUESTIONS, CAMPAIGN_ID } from '../lib/checkinQuestions';
import { hasSeenCheckin, markCheckinSeen } from '../lib/checkinSeen';
import posthog from '../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.22)', green: '#27AE60', red: '#C0392B',
};

const SHOW_DELAY_MS = 4000;

// A question is fully answered once it has a value, and — if that value
// triggers a required describeOn box (see checkinQuestions.js, e.g. every
// "Other") — that box is filled in too. Optional describeOn triggers (the
// negative tail of findability/design_rating) don't block completeness.
function isAnswered(q, answers, details) {
  const val = answers[q.id];
  if (!val) return false;
  const trigger = q.describeOn?.[val];
  if (trigger?.required && !(details[q.id] || '').trim()) return false;
  return true;
}

function QuestionBlock({ q, index, value, detail, onAnswer, onDetail }) {
  const trigger = value ? q.describeOn?.[value] : null;
  return (
    <div style={{ padding: '16px 0', borderBottom: `1px solid ${P.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: value ? P.gold : P.faint, letterSpacing: '0.08em' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14.5, color: P.cream, letterSpacing: '0.01em', fontWeight: 500 }}>{q.prompt}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 26 }}>
        {q.options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onAnswer(q.id, opt.value)}
              style={{
                background: active ? P.gold : 'transparent',
                border: `1px solid ${active ? P.gold : P.hair}`,
                color: active ? P.ink : P.mute,
                fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: active ? 600 : 400,
                padding: '7px 13px', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {trigger && (
        <div style={{ paddingLeft: 26, marginTop: 10 }}>
          <textarea
            value={detail}
            onChange={(e) => onDetail(q.id, e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={trigger.placeholder}
            style={{
              width: '100%', maxWidth: 420, display: 'block', background: P.ink, border: `1px solid ${P.hair}`, color: P.cream,
              fontFamily: 'Inter, sans-serif', fontSize: 12.5, padding: '8px 10px', outline: 'none',
              boxSizing: 'border-box', resize: 'vertical',
            }}
          />
          {trigger.required && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.faint, letterSpacing: '0.08em', marginTop: 4 }}>
              REQUIRED TO CONTINUE
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CheckinSurvey() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [feedbackText, setFeedbackText] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | ok | err
  const [errMsg, setErrMsg] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false);

  useEffect(() => {
    if (hasSeenCheckin()) return;
    const t = setTimeout(() => { setVisible(true); setOpen(true); }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    markCheckinSeen();
    setOpen(false);
    setTimeout(() => setVisible(false), 250);
  }

  // Submitted responses just close — nothing to talk them out of. Otherwise
  // the first attempt to leave shows a "this really helps us" prompt instead
  // of closing immediately; a second confirm actually closes.
  function requestClose() {
    if (state === 'ok') { dismiss(); return; }
    setConfirmingClose(true);
  }

  function answer(id, value) {
    if (answers[id] !== value) setDetails((d) => ({ ...d, [id]: '' }));
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function setDetail(id, text) {
    setDetails((d) => ({ ...d, [id]: text }));
  }

  const answeredCount = QUESTIONS.filter((q) => isAnswered(q, answers, details)).length;
  const complete = answeredCount === QUESTIONS.length;

  async function submit(e) {
    e.preventDefault();
    if (honeypot) { dismiss(); return; } // bot
    if (!complete || state === 'busy') return;
    setState('busy');
    setErrMsg('');
    const fp = await getDeviceId().catch(() => null);
    const detailFields = QUESTIONS.reduce((acc, q) => {
      if (q.describeOn) acc[`${q.id}_detail`] = (details[q.id] || '').trim() || null;
      return acc;
    }, {});
    const { error } = await SB.from('site_checkin_responses').insert({
      campaign_id: CAMPAIGN_ID,
      ...answers,
      ...detailFields,
      feedback_text: feedbackText.trim() || null,
      page_path: location.pathname,
      submitter_fp: fp,
    });
    if (error) {
      setState('err');
      setErrMsg('Could not submit — please try again.');
      return;
    }
    posthog.capture('checkin_survey_submitted', { campaign_id: CAMPAIGN_ID });
    setState('ok');
    markCheckinSeen();
    setTimeout(dismiss, 1800);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(6,16,31,0.72)', backdropFilter: 'blur(3px)',
        opacity: open ? 1 : 0, transition: 'opacity 0.25s ease', padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Site feedback survey"
    >
      <div
        style={{
          width: '100%', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto',
          background: P.deep, border: `1px solid ${P.hair}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          transform: open ? 'translateY(0)' : 'translateY(12px)', transition: 'transform 0.25s ease',
        }}
      >
        <div style={{ position: 'sticky', top: 0, background: P.deep, borderBottom: `1px solid ${P.hair}`, padding: '20px 24px 16px', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 6 }}>
                QUICK CHECK-IN · HIGHLY RECOMMENDED
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: P.cream, letterSpacing: '0.01em', fontWeight: 600 }}>
                Help us make this site better
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: P.mute, marginTop: 6, lineHeight: 1.5 }}>
                10 quick questions, totally anonymous. Takes under a minute.
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: `1px solid ${P.hair}`, color: P.mute,
                width: 30, height: 30, flexShrink: 0, cursor: 'pointer', fontSize: 16, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 14, height: 3, background: P.hair, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(answeredCount / QUESTIONS.length) * 100}%`, background: P.gold, transition: 'width 0.2s ease' }} />
          </div>
        </div>

        {confirmingClose ? (
          <div style={{ padding: '28px 24px 32px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 17, color: P.cream, fontWeight: 600, marginBottom: 10 }}>
              This is highly recommended
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
              Your feedback directly shapes what we fix and build next. It only takes a minute — are you sure you want to skip it?
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => setConfirmingClose(false)}
                style={{
                  background: P.gold, border: `1px solid ${P.gold}`, color: P.ink,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', fontWeight: 600,
                  padding: '11px 22px', cursor: 'pointer',
                }}
              >
                KEEP ANSWERING
              </button>
              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: 'none', border: 'none', color: P.faint, fontFamily: 'Inter, sans-serif',
                  fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Skip anyway
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: '4px 24px 24px' }}>
            {QUESTIONS.map((q, i) => (
              <QuestionBlock
                key={q.id}
                q={q}
                index={i}
                value={answers[q.id]}
                detail={details[q.id] || ''}
                onAnswer={answer}
                onDetail={setDetail}
              />
            ))}

            <div style={{ paddingTop: 16 }}>
              <label style={{ display: 'block', fontFamily: 'Oswald, sans-serif', fontSize: 14.5, color: P.cream, fontWeight: 500, marginBottom: 8 }}>
                Anything broken, confusing, or missing? <span style={{ color: P.faint, fontWeight: 400, fontSize: 12 }}>(optional)</span>
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                maxLength={3000}
                rows={3}
                placeholder="Tell us what's not working, or what you wish this site had…"
                style={{
                  width: '100%', background: P.ink, border: `1px solid ${P.hair}`, color: P.cream,
                  fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '10px 12px', outline: 'none',
                  boxSizing: 'border-box', resize: 'vertical',
                }}
              />
            </div>

            <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              name="website" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />

            {errMsg && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: P.red, marginTop: 14 }}>{errMsg}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20 }}>
              <button
                type="submit"
                disabled={!complete || state === 'busy' || state === 'ok'}
                style={{
                  background: complete ? P.gold : 'transparent',
                  border: `1px solid ${complete ? P.gold : P.hair}`,
                  color: complete ? P.ink : P.faint,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', fontWeight: 600,
                  padding: '11px 22px', cursor: complete ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                }}
              >
                {state === 'busy' ? 'SENDING…' : state === 'ok' ? 'THANKS! ✓' : 'SUBMIT →'}
              </button>
              {!complete && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.faint, letterSpacing: '0.06em' }}>
                  {answeredCount}/{QUESTIONS.length} answered
                </span>
              )}
              <button
                type="button"
                onClick={requestClose}
                style={{
                  background: 'none', border: 'none', color: P.faint, fontFamily: 'Inter, sans-serif',
                  fontSize: 12, cursor: 'pointer', marginLeft: 'auto', textDecoration: 'underline',
                }}
              >
                No thanks
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
