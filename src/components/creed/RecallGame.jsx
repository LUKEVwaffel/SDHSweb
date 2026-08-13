import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { CREED_WORD_COUNT, CREED_LINES_WITH_GLOBAL, CREED_FLAT_WORDS } from '../../data/creed';
import { recordResult } from '../../lib/creedProgress';
import { P, MONO, DISPLAY, BODY } from './creedShared';
import { GameHeader, GoldButton, GhostButton, ResultPanel } from './CreedUi';
import { PerfectScorePanel } from './CreedLeaderboardPanel';

const MASTERY_THRESHOLD = 95;

function cleanMatch(typed, expectedClean) {
  return typed.replace(/[.,]/g, '').toLowerCase() === expectedClean.toLowerCase();
}

function hintFor(word) {
  if (word.clean.length <= 1) return word.clean;
  return word.clean[0] + '_'.repeat(word.clean.length - 1);
}

export default function RecallGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'HINTS' | 'BLANK'
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const textareaRef = useRef(null);

  const typedWords = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);

  const correctCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < typedWords.length && i < CREED_FLAT_WORDS.length; i++) {
      if (cleanMatch(typedWords[i], CREED_FLAT_WORDS[i].clean)) n++;
    }
    return n;
  }, [typedWords]);

  const accuracy = Math.round((correctCount / CREED_WORD_COUNT) * 100);

  const wrongWords = useMemo(() => {
    if (!done) return [];
    const items = [];
    for (let i = 0; i < typedWords.length && i < CREED_FLAT_WORDS.length; i++) {
      if (!cleanMatch(typedWords[i], CREED_FLAT_WORDS[i].clean)) {
        items.push(`"${CREED_FLAT_WORDS[i].raw}" — you wrote "${typedWords[i]}"`);
      }
    }
    if (typedWords.length < CREED_FLAT_WORDS.length) {
      items.push(`Ran out of words: never typed the last ${CREED_FLAT_WORDS.length - typedWords.length}`);
    }
    return items;
  }, [done, typedWords]);

  const start = useCallback((m) => {
    setMode(m);
    setText('');
    setDone(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const finish = useCallback(() => setDone(true), []);

  useEffect(() => {
    if (typedWords.length >= CREED_FLAT_WORDS.length && !done) setDone(true);
  }, [typedWords.length, done]);

  useEffect(() => {
    if (!done) return;
    recordResult('recall', current => {
      const next = { bestAccuracy: Math.max(current.bestAccuracy || 0, accuracy) };
      if (mode === 'HINTS' && accuracy >= MASTERY_THRESHOLD) next.hintLevelCleared = 'HINTS';
      if (mode === 'BLANK' && accuracy >= MASTERY_THRESHOLD) next.blankPageCleared = true;
      return next;
    });
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Type It From Memory" onBack={onExit} />
        <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.28em', color: P.gold, opacity: 0.6, marginBottom: 14 }}>
            CHOOSE MODE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => start('HINTS')} style={{
              background: P.navyDeep, border: `1px solid ${P.hairline}`, cursor: 'pointer',
              padding: '16px 20px', textAlign: 'left', color: P.cream,
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, letterSpacing: '0.06em',
            }}>
              WITH HINTS
              <span style={{ display: 'block', fontFamily: BODY, fontSize: 12, color: P.mute, fontWeight: 400, marginTop: 4 }}>
                First letter of each unwritten word shown as a crutch
              </span>
            </button>
            <button onClick={() => start('BLANK')} style={{
              background: P.navyDeep, border: `1px solid ${P.hairline}`, cursor: 'pointer',
              padding: '16px 20px', textAlign: 'left', color: P.cream,
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, letterSpacing: '0.06em',
            }}>
              BLANK PAGE
              <span style={{ display: 'block', fontFamily: BODY, fontSize: 12, color: P.mute, fontWeight: 400, marginTop: 4 }}>
                No hints — the real mastery test
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Type It From Memory" onBack={onExit} />
        <ResultPanel
          heading={`${accuracy}% ACCURATE`}
          stats={[
            { label: 'CORRECT', value: `${correctCount}/${CREED_WORD_COUNT}` },
            { label: 'MODE', value: mode === 'HINTS' ? 'HINTS' : 'BLANK' },
          ]}
          wrongItems={wrongWords}
          onRetry={() => start(mode)}
          onBack={onExit}
        />
        {accuracy === 100 && (
          <PerfectScorePanel gameKey="recall" gameLabel="Type It From Memory" metricLabel="ACCURACY" metricValue={`${accuracy}%`} />
        )}
      </div>
    );
  }

  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>
      <GameHeader
        title="Type It From Memory"
        onBack={onExit}
        right={<span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: P.mute }}>{mode} · {typedWords.length}/{CREED_WORD_COUNT} WORDS</span>}
      />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* live diff render */}
        <div style={{ marginBottom: 20 }}>
          {CREED_LINES_WITH_GLOBAL.map(line => (
            <p key={line.id} style={{ fontFamily: BODY, fontSize: 16, lineHeight: 2.1, margin: '0 0 4px' }}>
              {line.words.map(w => {
                const globalIdx = w.globalIdx;
                const isTyped = globalIdx < typedWords.length;
                const isCorrect = isTyped && cleanMatch(typedWords[globalIdx], w.clean);
                let content = w.raw;
                let color = P.mute;
                if (isTyped) {
                  color = isCorrect ? P.correct : P.red;
                } else if (mode === 'HINTS') {
                  content = hintFor(w);
                  color = 'rgba(244,236,216,0.35)';
                } else {
                  content = '···';
                  color = 'rgba(244,236,216,0.18)';
                }
                return <span key={w.idx} style={{ color }}>{content} </span>;
              })}
            </p>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onPaste={e => e.preventDefault()}
          placeholder="Start typing the creed from memory…"
          rows={4}
          style={{
            width: '100%', resize: 'vertical',
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${P.hairlineStrong}`,
            color: P.cream, fontFamily: BODY, fontSize: 15, lineHeight: 1.6,
            padding: '12px 14px', outline: 'none',
          }}
        />

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <GoldButton onClick={finish} disabled={typedWords.length === 0}>FINISH NOW</GoldButton>
          <GhostButton onClick={() => start(mode)}>RESTART</GhostButton>
        </div>
      </div>
    </div>
  );
}
