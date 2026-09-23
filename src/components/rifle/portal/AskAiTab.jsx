import { useState, useRef, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter } from '../theme';
import { SectionLabel } from './ui';

// Natural-language Q&A over the team's scores — calls the rifle-scores-ai
// edge function, which hands Claude the full shooters/matches/scores table
// (read-only) plus the question. See that function for the data shape and
// system prompt.
const SUGGESTIONS = [
  "What's the team's average total this season?",
  'Compare last season to this season',
  "Who's had the biggest improvement?",
  "What was our best match result?",
];

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

      <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${P.hair}`, padding: 16, marginBottom: 14 }}>
        {thread.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, letterSpacing: '0.08em', marginBottom: 4 }}>TRY ASKING</div>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} style={{ textAlign: 'left', background: 'transparent', border: `1px solid ${P.hair}`, color: P.mute, fontFamily: inter, fontSize: 13, padding: '10px 12px', cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.08em', marginBottom: 6 }}>YOU</div>
            <div style={{ fontFamily: inter, fontSize: 14, color: P.cream, marginBottom: 12 }}>{m.question}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.08em', marginBottom: 6 }}>ANSWER</div>
            {m.error ? (
              <div style={{ fontFamily: mono, fontSize: 12, color: P.red }}>{m.error}</div>
            ) : m.answer ? (
              <div style={{ fontFamily: inter, fontSize: 14, color: P.cream, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.answer}</div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Thinking…</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <textarea
          value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Ask a question about the scores… (Enter to send)" rows={2}
          style={{ flex: 1, background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: inter, fontSize: 14, padding: '10px 12px', outline: 'none', resize: 'none' }}
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
