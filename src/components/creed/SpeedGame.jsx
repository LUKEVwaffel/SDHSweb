import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { CREED_WORD_COUNT, CREED_LINES_WITH_GLOBAL, CREED_FLAT_WORDS } from '../../data/creed';
import { recordResult } from '../../lib/creedProgress';
import { P, MONO, BODY } from './creedShared';
import { GameHeader, GoldButton, ResultPanel } from './CreedUi';
import { PerfectScorePanel } from './CreedLeaderboardPanel';

function cleanMatch(typed, expectedClean) {
  return typed.replace(/[.,]/g, '').toLowerCase() === expectedClean.toLowerCase();
}

export default function SpeedGame({ onExit }) {
  const [phase, setPhase] = useState('READY'); // READY | RUNNING | DONE
  const [text, setText] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const textareaRef = useRef(null);

  const typedWords = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);

  const correctCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < typedWords.length && i < CREED_WORD_COUNT; i++) {
      if (cleanMatch(typedWords[i], CREED_FLAT_WORDS[i].clean)) n++;
    }
    return n;
  }, [typedWords]);

  const accuracy = Math.round((correctCount / CREED_WORD_COUNT) * 100);

  const wrongWords = useMemo(() => {
    if (phase !== 'DONE') return [];
    const items = [];
    for (let i = 0; i < typedWords.length && i < CREED_WORD_COUNT; i++) {
      if (!cleanMatch(typedWords[i], CREED_FLAT_WORDS[i].clean)) {
        items.push(`"${CREED_FLAT_WORDS[i].raw}" — you wrote "${typedWords[i]}"`);
      }
    }
    if (typedWords.length < CREED_WORD_COUNT) {
      items.push(`Ran out of words: never typed the last ${CREED_WORD_COUNT - typedWords.length}`);
    }
    return items;
  }, [phase, typedWords]);

  const elapsedMs = useMemo(() => {
    if (!startedAt) return 0;
    return (finishedAt || nowTick) - startedAt;
  }, [startedAt, finishedAt, nowTick]);

  // Floor the denominator so a near-instant completion (e.g. autofill) can't
  // produce an absurd WPM — a human can't legitimately clear this in <1s.
  const wpm = elapsedMs > 0 ? Math.round(correctCount / (Math.max(elapsedMs, 1000) / 60000)) : 0;

  // Live-updating clock while the run is active.
  useEffect(() => {
    if (phase !== 'RUNNING') return;
    const id = setInterval(() => setNowTick(Date.now()), 200);
    return () => clearInterval(id);
  }, [phase]);

  const begin = useCallback(() => {
    setPhase('RUNNING');
    setText('');
    setStartedAt(null);
    setFinishedAt(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const finish = useCallback(() => {
    setFinishedAt(Date.now());
    setPhase('DONE');
  }, []);

  const onChange = useCallback((e) => {
    const value = e.target.value;
    if (!startedAt && value.trim().length > 0) setStartedAt(Date.now());
    setText(value);
  }, [startedAt]);

  useEffect(() => {
    if (typedWords.length >= CREED_WORD_COUNT && phase === 'RUNNING') finish();
  }, [typedWords.length, phase, finish]);

  useEffect(() => {
    if (phase !== 'DONE') return;
    recordResult('speed', current => ({
      bestWpm: Math.max(current.bestWpm || 0, wpm),
      bestAccuracy: Math.max(current.bestAccuracy || 0, accuracy),
    }));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'READY') {
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Speed Challenge" onBack={onExit} />
        <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.28em', color: P.gold, opacity: 0.6, marginBottom: 14 }}>
            READY?
          </div>
          <p style={{ fontFamily: BODY, fontSize: 14, color: P.mute, lineHeight: 1.7, marginBottom: 24 }}>
            Type the full creed as fast and accurately as you can. The clock starts on your first keystroke.
          </p>
          <GoldButton onClick={begin}>START</GoldButton>
        </div>
      </div>
    );
  }

  if (phase === 'DONE') {
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Speed Challenge" onBack={onExit} />
        <ResultPanel
          heading={`${wpm} WPM`}
          stats={[
            { label: 'ACCURACY', value: `${accuracy}%` },
            { label: 'TIME', value: `${(elapsedMs / 1000).toFixed(1)}s` },
            { label: 'CORRECT', value: `${correctCount}/${CREED_WORD_COUNT}` },
          ]}
          wrongItems={wrongWords}
          onRetry={begin}
          onBack={onExit}
        />
        {accuracy === 100 && (
          <PerfectScorePanel gameKey="speed" gameLabel="Speed Challenge" metricLabel="WPM" metricValue={`${wpm}`} />
        )}
      </div>
    );
  }

  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>
      <GameHeader
        title="Speed Challenge"
        onBack={onExit}
        right={<span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', color: P.goldBright }}>{(elapsedMs / 1000).toFixed(1)}s</span>}
      />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>
        <div style={{ marginBottom: 20 }}>
          {CREED_LINES_WITH_GLOBAL.map(line => (
            <p key={line.id} style={{ fontFamily: BODY, fontSize: 16, lineHeight: 2.1, margin: '0 0 4px' }}>
              {line.words.map(w => {
                const isTyped = w.globalIdx < typedWords.length;
                const isCorrect = isTyped && cleanMatch(typedWords[w.globalIdx], w.clean);
                const color = !isTyped ? 'rgba(244,236,216,0.18)' : isCorrect ? P.correct : P.red;
                return <span key={w.idx} style={{ color }}>{isTyped ? w.raw : '···'} </span>;
              })}
            </p>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={onChange}
          onPaste={e => e.preventDefault()}
          placeholder="Go…"
          rows={4}
          style={{
            width: '100%', resize: 'vertical',
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${P.hairlineStrong}`,
            color: P.cream, fontFamily: BODY, fontSize: 15, lineHeight: 1.6,
            padding: '12px 14px', outline: 'none',
          }}
        />

        <div style={{ marginTop: 20 }}>
          <GoldButton onClick={finish} disabled={typedWords.length === 0}>FINISH NOW</GoldButton>
        </div>
      </div>
    </div>
  );
}
