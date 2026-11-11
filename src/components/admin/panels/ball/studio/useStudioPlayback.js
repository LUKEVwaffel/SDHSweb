import { useState, useRef, useCallback, useEffect } from 'react';
import {createPlayback,playbackAction,remainingTime,reconcilePlaybackSlides} from '../../../../../lib/ballPlayback';
export function useStudioPlayback(deck,startIndex) {
  const [stored,setState]=useState(()=>({...createPlayback(deck.slides.map(s=>s.duration),startIndex,deck.loop),slideIds:deck.slides.map(s=>s.id)}));
  const state=reconcilePlaybackSlides(stored,deck.slides,deck.loop);
  if(state!==stored)setState(state);
  const ref=useRef(state);ref.current=state;
  const send=useCallback(action=>{const next=playbackAction(ref.current,action);ref.current=next;setState(next);},[]);
  useEffect(()=>{
    if(!state.playing||state.blackout)return;
    const timer=setTimeout(()=>send({type:'tick'}),Math.max(1,remainingTime(state)));
    return()=>clearTimeout(timer);
  },[state,send]);
  return {state,send,stateRef:ref};
}
