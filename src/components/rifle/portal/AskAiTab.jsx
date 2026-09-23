import { useState, useRef, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald, inter } from '../theme';
import { SectionLabel, Stat, StatGrid, th, td } from './ui';

// Natural-language Q&A over the team's scores — calls the rifle-scores-ai
// edge function, which hands Claude the full shooters/matches/scores table
// (read-only) plus the question, and gets back a structured answer (headline
// stat + supporting stats + optional comparison table + narrative) via a
// forced tool call. See that function for the data shape and system prompt.
const SUGGESTIONS = [
  "What's the team's average total this season?",
  'Compare last season to this season',
  "Who's had the biggest improvement?",
  "What was our best match result?",
];

function Avatar({ who }) {
  const isAi = who === 'ai';
  return (
    <div style={{
      width: 26, height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.02em',
      border: `1px solid ${isAi ? P.hairStrong : P.hair}`,
      background: isAi ? 'rgba(201,169,97,0.14)' : 'rgba(244,236,216,0.06)',
      color: isAi ? P.gold : P.mute,
    }}>
      {isAi ? 'AI' : 'Y'}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: P.gold,
          opacity: 0.35, animation: `rifleAiPulse 1.1s ${i * 0.15}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`@keyframes rifleAiPulse { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); } 40% { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

function AnswerBody({ answer }) {
  const hasHeadline = !!answer.headline;
  const stats = Array.isArray(answer.stats) ? answer.stats.filter((s) => s && s.label) : [];
  const table = answer.table && Array.isArray(answer.table.headers) && Array.isArray(answer.table.rows) && answer.table.rows.length
    ? answer.table : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {hasHeadline && (
        <div style={{ position: 'relative', border: `1px solid ${P.hairStrong}`, background: 'linear-gradient(160deg, rgba(201,169,97,0.14), rgba(201,169,97,0.03))', padding: '14px 16px' }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.22em', opacity: 0.8, marginBottom: 6 }}>{answer.headline.label}</div>
          <div style={{ fontFamily: oswald, fontSize: 34, fontWeight: 600, color: P.cream, lineHeight: 1, letterSpacing: '0.01em' }}>{answer.headline.value}</div>
          {answer.headline.sub && <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, letterSpacing: '0.06em', marginTop: 6 }}>{answer.headline.sub}</div>}
        </div>
      )}

      {stats.length > 0 && (
        <StatGrid>
          {stats.map((s, i) => (
            <Stat key={i} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </StatGrid>
      )}

      {table && (
        <div style={{ overflowX: 'auto', border: `1px solid ${P.hair}` }}>
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
    </div>
  );
}

export default function AskAiTab() {
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]); // [{ question, answer, error }]
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread, asking]);

  async function ask(q) {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    setAsking(true);
    setQuestion('');
    setThread((t) => [...t, { question: text, answer: null, error: null }]);
    const { data, error } = await SB.functions.invoke('rifle-scores-ai', { body: { question: text } });
    setAsking(false);
    setThread((t) => t.map((m, i) => (i === t.length - 1
      ? { ...m, answer: data?.answer ?? null, error: error || data?.error ? (data?.error || error.message) : null }
      : m)));
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 320px)', minHeight: 380 }}>
      <SectionLabel tag="// ASK AI · SCORES Q&amp;A" title="Ask AI" sub="Ask about averages, trends, or comparisons across any season on record. Answers are computed from the actual score data, not guessed." />

      <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${P.hair}`, background: 'rgba(6,16,31,0.4)', padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {thread.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, letterSpacing: '0.08em', marginBottom: 4 }}>TRY ASKING</div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s} onClick={() => ask(s)}
                style={{ textAlign: 'left', background: 'transparent', border: `1px solid ${P.hair}`, color: P.mute, fontFamily: inter, fontSize: 13, padding: '10px 12px', cursor: 'pointer', transition: 'border-color 120ms ease, color 120ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.hairStrong; e.currentTarget.style.color = P.cream; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.hair; e.currentTarget.style.color = P.mute; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Avatar who="you" />
              <div style={{ fontFamily: inter, fontSize: 14, color: P.cream, paddingTop: 3 }}>{m.question}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Avatar who="ai" />
              <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                {m.error ? (
                  <div style={{ fontFamily: mono, fontSize: 12, color: P.red, border: `1px solid ${P.red}66`, background: `${P.red}12`, padding: '8px 10px' }}>{m.error}</div>
                ) : m.answer ? (
                  <AnswerBody answer={m.answer} />
                ) : (
                  <ThinkingDots />
                )}
              </div>
            </div>
            {i < thread.length - 1 && <div style={{ height: 1, background: P.hair, opacity: 0.6, marginTop: 4 }} />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <textarea
          value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Ask a question about the scores… (Enter to send)" rows={2}
          style={{ flex: 1, background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: inter, fontSize: 14, padding: '10px 12px', outline: 'none', resize: 'none', transition: 'border-color 120ms ease' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = P.hairStrong; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = P.hair; }}
        />
        <button
          onClick={() => ask()} disabled={asking || !question.trim()}
          style={{ background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', padding: '0 20px', cursor: asking ? 'wait' : 'pointer', opacity: question.trim() ? 1 : 0.5 }}
        >
          {asking ? '…' : 'ASK'}
        </button>
      </div>
    </div>
  );
}
