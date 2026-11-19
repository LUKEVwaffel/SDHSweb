import { useState, useRef, useCallback, useEffect } from 'react';
import { createPlayback, ballShowAction, nextPlaybackWake, reconcilePlaybackSlides, resolveBallShow } from '../../../../../lib/ballPlayback';

export function useStudioPlayback(deck, startIndex, runShow) {
  const show = resolveBallShow(deck);
  const [stored, setState] = useState(() => {
    const initial = { ...createPlayback(deck.slides.map(slide => slide.duration), startIndex, deck.loop), slideIds: deck.slides.map(slide => slide.id) };
    return runShow ? ballShowAction(initial, { type: 'start-show' }, show) : initial;
  });
  const state = reconcilePlaybackSlides(stored, deck.slides, deck.loop);
  if (state !== stored) setState(state);
  const ref = useRef(state);
  const showRef = useRef(show);
  ref.current = state;
  showRef.current = show;
  const send = useCallback(action => {
    const next = ballShowAction(ref.current, action, showRef.current);
    ref.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    const wait = nextPlaybackWake(state, showRef.current);
    if (!Number.isFinite(wait)) return;
    const timer = setTimeout(() => send({ type: 'tick' }), Math.max(1, wait));
    const onVisible = () => { if (document.visibilityState === 'visible') send({ type: 'tick' }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state, send]);
  return { state, send, stateRef: ref, show };
}
