import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPlayback, ballShowAction, isBallScheduleActive, nextPlaybackWake, reconcilePlaybackSlides, resolveBallShow, startBallShow } from '../../../../../lib/ballPlayback';

export function useStudioPlayback(deck, startIndex, runShow, protectSchedule) {
  const show = useMemo(() => resolveBallShow(deck), [deck]);
  const [stored, setState] = useState(() => {
    const initial = { ...createPlayback(deck.slides.map(slide => slide.duration), startIndex, deck.loop), slideIds: deck.slides.map(slide => slide.id) };
    return runShow ? ballShowAction(initial, { type: 'start-show' }, show) : initial;
  });
  let state = reconcilePlaybackSlides(stored, deck.slides, deck.loop);
  if (state !== stored) {
    if (protectSchedule && show && isBallScheduleActive(stored)) {
      state = startBallShow(state, show);
    } else if (protectSchedule && show?.dinnerPhotos && stored.showPhase === 'dinner') {
      if (!show.dinnerPhotos.includes(state.index)) state = ballShowAction(state, { type: 'start-dinner' }, show);
      state = { ...state, showPhase: 'dinner', playing: stored.playing };
    }
    setState(state);
  }
  const ref = useRef(state);
  const showRef = useRef(show);
  ref.current = state;
  showRef.current = show;
  const send = useCallback(action => {
    const next = ballShowAction(ref.current, action, showRef.current, Date.now(), protectSchedule);
    ref.current = next;
    setState(next);
  }, [protectSchedule]);
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
  }, [state, send, show]);
  return { state, send, stateRef: ref, show, protectSchedule, scheduleActive: protectSchedule && isBallScheduleActive(state) };
}
