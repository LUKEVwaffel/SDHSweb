import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CREED_LINES } from '../../data/creed';
import { recordResult } from '../../lib/creedProgress';
import { P, MONO, BODY } from './creedShared';
import { GameHeader, GoldButton, GhostButton, ResultPanel } from './CreedUi';
import { PerfectScorePanel } from './CreedLeaderboardPanel';

function seededShuffle(items, seed) {
  const shuffled = items
    .map((item, i) => ({ item, key: Math.sin(seed + i * 5.147) }))
    .sort((a, b) => (a.key - Math.floor(a.key)) - (b.key - Math.floor(b.key)))
    .map(x => x.item);
  // Reroll if the shuffle happens to land in the original order.
  if (shuffled.every((it, i) => it.id === items[i].id)) {
    return seededShuffle(items, seed + 1);
  }
  return shuffled;
}

function SortableLine({ line, index, checked, isCorrect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id, disabled: checked });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const stateColor = !checked ? P.hairlineStrong : isCorrect ? P.correct : P.red;
  const stateBg = !checked ? P.navyDeep : isCorrect ? P.correctBg : P.wrongBg;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-testid={`line-${line.id}`}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        border: `1px solid ${stateColor}`, background: stateBg,
        padding: '14px 16px', marginBottom: 8,
        cursor: checked ? 'default' : 'grab', touchAction: 'none',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', color: P.gold,
          opacity: 0.7, flexShrink: 0, width: 20, textAlign: 'center',
        }}>{index + 1}</div>
        <div style={{ fontFamily: BODY, fontSize: 14.5, color: P.cream, lineHeight: 1.5, flex: 1 }}>{line.text}</div>
        {checked && <div style={{ color: stateColor, fontSize: 16, flexShrink: 0 }}>{isCorrect ? '✓' : '✕'}</div>}
      </div>
    </div>
  );
}

export default function SequencingGame({ onExit }) {
  const [seed, setSeed] = useState(0);
  const [order, setOrder] = useState(() => seededShuffle(CREED_LINES, 0));
  const [checked, setChecked] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(null);
  const [missedLineIds, setMissedLineIds] = useState(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const correctCount = useMemo(
    () => order.filter((line, i) => line.id === i).length,
    [order]
  );
  const allCorrect = correctCount === CREED_LINES.length;

  const onDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder(list => {
      const from = list.findIndex(l => l.id === active.id);
      const to = list.findIndex(l => l.id === over.id);
      return arrayMove(list, from, to);
    });
  }, []);

  const check = useCallback(() => {
    const ms = Date.now() - startedAt;
    setElapsedMs(ms);
    setChecked(true);
    if (!allCorrect) {
      setMissedLineIds(prev => {
        const next = new Set(prev);
        order.forEach((line, i) => { if (line.id !== i) next.add(line.id); });
        return next;
      });
    }
  }, [startedAt, order, allCorrect]);

  useEffect(() => {
    if (!checked || !allCorrect) return;
    recordResult('sequencing', current => ({
      bestTimeMs: current.bestTimeMs == null ? elapsedMs : Math.min(current.bestTimeMs, elapsedMs),
    }));
  }, [checked, allCorrect]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => {
    setSeed(s => s + 1);
    setOrder(seededShuffle(CREED_LINES, seed + 1));
    setChecked(false);
    setElapsedMs(null);
    setMissedLineIds(new Set());
  }, [seed]);

  if (checked && allCorrect) {
    const wrongLineTexts = CREED_LINES.filter(l => missedLineIds.has(l.id)).map(l => `Misordered earlier: "${l.text}"`);
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Line Sequencing" onBack={onExit} />
        <ResultPanel
          heading="ALL 8 LINES CORRECT"
          stats={[{ label: 'TIME', value: `${(elapsedMs / 1000).toFixed(1)}s` }]}
          wrongItems={wrongLineTexts}
          onRetry={retry}
          onBack={onExit}
        />
        {missedLineIds.size === 0 && (
          <PerfectScorePanel gameKey="sequencing" gameLabel="Line Sequencing" metricLabel="TIME" metricValue={`${(elapsedMs / 1000).toFixed(1)}s`} />
        )}
      </div>
    );
  }

  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>
      <GameHeader
        title="Line Sequencing"
        onBack={onExit}
        right={checked ? (
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: P.mute }}>{correctCount}/{CREED_LINES.length} CORRECT</span>
        ) : null}
      />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 64px' }}>
        <div style={{ fontFamily: BODY, fontSize: 13, color: P.mute, marginBottom: 20 }}>
          Drag the lines into the order they appear in the creed.
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {order.map((line, i) => (
              <SortableLine
                key={line.id}
                line={line}
                index={i}
                checked={checked}
                isCorrect={line.id === i}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          {checked && !allCorrect ? (
            <GhostButton onClick={() => setChecked(false)}>KEEP ADJUSTING</GhostButton>
          ) : (
            <GoldButton onClick={check}>CHECK ORDER</GoldButton>
          )}
        </div>
      </div>
    </div>
  );
}
