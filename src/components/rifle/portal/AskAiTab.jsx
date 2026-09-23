import { useState, useRef, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald, inter } from '../theme';
import { SectionLabel, th, td } from './ui';

// Natural-language Q&A over the team's scores — calls the rifle-scores-ai
// edge function, which hands Claude the shooters/matches/scores table
// (read-only) plus the question, and gets back a structured answer (headline
// stat + supporting stats + optional comparison table + clickable follow-up
// questions + narrative) via a forced tool call. Any headline/stat with its
// own "followup" is clickable — tapping it re-asks that specific drill-down
// without retyping. See that function for the data shape and system prompt.
const SUGGESTIONS = [
  "What's the team's average total this season?",
  'Compare last season to this season',
  "Who's had the biggest improvement?",
  "What was our best match result?",
];

const radius = 14;
const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '3px 2px' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: P.gold,
          animation: `rifleAiPulse 1.1s ${i * 0.15}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`@keyframes rifleAiPulse { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); } 40% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

function Clickable({ onClick, children, style }) {
  const [hover, setHover] = useState(false);
  if (!onClick) return <div style={style}>{children}</div>;
  return (
    <button
      onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'block', width: '100%',
        transition: `border-color 120ms ${easing}, background 120ms ${easing}`,
        ...style,
        borderColor: hover ? P.hairStrong : style?.borderColor,
        background: hover ? 'rgba(201,169,97,0.1)' : style?.background,
      }}
    >
      {children}
    </button>
  );
}

function AnswerBody({ answer, onFollowup }) {
  const hasHeadline = !!answer.headline;
  const stats = Array.isArray(answer.stats) ? answer.stats.filter((s) => s && s.label) : [];
  const table = answer.table && Array.isArray(answer.table.headers) && Array.isArray(answer.table.rows) && answer.table.rows.length
    ? answer.table : null;
  const followups = Array.isArray(answer.followups) ? answer.followups.filter(Boolean).slice(0, 4) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {hasHeadline && (
        <Clickable
          onClick={answer.headline.followup ? () => onFollowup(answer.headline.followup) : null}
          style={{
            position: 'relative', border: `1px solid ${P.hairStrong}`,
            background: 'linear-gradient(160deg, rgba(201,169,97,0.16), rgba(201,169,97,0.03))',
            padding: '14px 16px', borderRadius: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.22em', opacity: 0.8, marginBottom: 6 }}>{answer.headline.label}</div>
              <div style={{ fontFamily: oswald, fontSize: 34, fontWeight: 600, color: P.cream, lineHeight: 1, letterSpacing: '0.01em' }}>{answer.headline.value}</div>
              {answer.headline.sub && <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, letterSpacing: '0.06em', marginTop: 6 }}>{answer.headline.sub}</div>}
            </div>
            {answer.headline.followup && <div style={{ fontFamily: mono, fontSize: 14, color: P.gold, opacity: 0.6, marginTop: 2 }}>↗</div>}
          </div>
        </Clickable>
      )}

      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {stats.map((s, i) => {
            const color = s.tone === 'up' ? P.win : s.tone === 'down' ? P.warn : P.cream;
            return (
              <Clickable
                key={i} onClick={s.followup ? () => onFollowup(s.followup) : null}
                style={{ border: `1px solid ${P.hair}`, padding: '10px 12px', background: 'rgba(10,22,40,0.5)', borderRadius: 8, textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.7, marginBottom: 6 }}>{s.label}</div>
                  {s.followup && <div style={{ fontFamily: mono, fontSize: 10, color: P.faint }}>↗</div>}
                </div>
                <div style={{ fontFamily: oswald, fontSize: 22, color, letterSpacing: '0.02em', lineHeight: 1 }}>{s.value}</div>
              </Clickable>
            );
          })}
        </div>
      )}

      {table && (
        <div style={{ overflowX: 'auto', border: `1px solid ${P.hair}`, borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 360 }}>
            <thead>
              <tr>{table.headers.map((h, i) => <th key={i} style={th(i === 0 ? 'left' : 'right')}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>{row.map((c, j) => <td key={j} style={td(j === 0 ? 'left' : 'right')}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {answer.narrative && (
        <div style={{ fontFamily: inter, fontSize: 13.5, color: P.mute, lineHeight: 1.65 }}>{answer.narrative}</div>
      )}

      {followups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 2 }}>
          {followups.map((f, i) => (
            <button
              key={i} onClick={() => onFollowup(f)}
              style={{
                background: 'transparent', border: `1px solid ${P.hairStrong}`, borderRadius: 999,
                color: P.gold, fontFamily: mono, fontSize: 10.5, letterSpacing: '0.03em',
                padding: '6px 12px', cursor: 'pointer', transition: `background 120ms ${easing}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,169,97,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {f} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AskAiTab() {
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]); // [{ question, answer, error, ts }]
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const [taFocus, setTaFocus] = useState(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread, asking]);

  async function ask(q) {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    setAsking(true);
    setQuestion('');
    setThread((t) => [...t, { question: text, answer: null, error: null, ts: Date.now() }]);
    const { data, error } = await SB.functions.invoke('rifle-scores-ai', { body: { question: text } });
    setAsking(false);
    setThread((t) => t.map((m, i) => (i === t.length - 1
      ? { ...m, answer: data?.answer ?? null, error: error || data?.error ? (data?.error || error.message) : null }
      : m)));
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
  }

  function autoGrow(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 320px)', minHeight: 420 }}>
      <SectionLabel tag="// ASK AI · SCORES Q&amp;A" title="Ask AI" sub="Ask about averages, trends, or comparisons across any season on record. Answers are computed from the actual score data, not guessed." />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, border: `1px solid ${P.hair}`, background: 'rgba(6,16,31,0.55)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${P.hair}`, background: 'rgba(10,22,40,0.6)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: asking ? P.gold : P.win, boxShadow: asking ? `0 0 0 3px rgba(201,169,97,0.18)` : `0 0 0 3px rgba(126,200,126,0.15)`, transition: `background 200ms ${easing}` }} />
          <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.14em' }}>{asking ? 'THINKING…' : 'READY · LIVE SCORE DATA'}</div>
          <div style={{ flex: 1 }} />
          {thread.length > 0 && (
            <button
              onClick={() => setThread([])}
              style={{ all: 'unset', cursor: 'pointer', fontFamily: mono, fontSize: 10, color: P.faint, letterSpacing: '0.1em', padding: '3px 6px' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = P.red; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = P.faint; }}
            >
              CLEAR
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {thread.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, letterSpacing: '0.08em' }}>TRY ASKING</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s} onClick={() => ask(s)}
                    style={{ textAlign: 'left', background: 'rgba(201,169,97,0.05)', border: `1px solid ${P.hair}`, borderRadius: 999, color: P.mute, fontFamily: inter, fontSize: 13, padding: '9px 14px', cursor: 'pointer', transition: `border-color 120ms ${easing}, color 120ms ${easing}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.hairStrong; e.currentTarget.style.color = P.cream; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.hair; e.currentTarget.style.color = P.mute; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thread.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{
                  maxWidth: '78%', padding: '10px 14px', background: P.gold, color: P.ink,
                  fontFamily: inter, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  borderRadius: `${radius}px ${radius}px 3px ${radius}px`,
                }}>
                  {m.question}
                </div>
                <div style={{ fontFamily: mono, fontSize: 9, color: P.faint, marginTop: 3, marginRight: 3 }}>{timeLabel(m.ts)}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{
                  maxWidth: m.answer && !m.error ? '94%' : '78%', minWidth: m.error || !m.answer ? undefined : 220,
                  padding: '12px 14px', background: P.navy, border: `1px solid ${m.error ? `${P.red}66` : P.hair}`,
                  borderRadius: `${radius}px ${radius}px ${radius}px 3px`, boxSizing: 'border-box',
                }}>
                  {m.error ? (
                    <div style={{ fontFamily: mono, fontSize: 12, color: P.red }}>{m.error}</div>
                  ) : m.answer ? (
                    <AnswerBody answer={m.answer} onFollowup={ask} />
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: 12, borderTop: `1px solid ${P.hair}` }}>
          <textarea
            ref={taRef}
            value={question}
            onChange={(e) => { setQuestion(e.target.value); autoGrow(e); }}
            onKeyDown={onKeyDown}
            onFocus={() => setTaFocus(true)}
            onBlur={() => setTaFocus(false)}
            placeholder="Ask a question about the scores… (Enter to send)" rows={1}
            style={{
              flex: 1, background: P.deep, border: `1px solid ${taFocus ? P.gold : P.hair}`, borderRadius: 10,
              color: P.cream, fontFamily: inter, fontSize: 14, padding: '11px 13px', outline: 'none', resize: 'none',
              minHeight: 42, maxHeight: 120, boxSizing: 'border-box', transition: `border-color 120ms ${easing}`,
            }}
          />
          <button
            onClick={() => ask()} disabled={asking || !question.trim()}
            aria-label="Send"
            style={{
              width: 42, height: 42, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: P.gold, color: P.ink, border: 'none', borderRadius: 10, fontSize: 16,
              cursor: asking ? 'wait' : 'pointer', opacity: question.trim() ? 1 : 0.5, transition: `opacity 120ms ${easing}`,
            }}
          >
            {asking ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
