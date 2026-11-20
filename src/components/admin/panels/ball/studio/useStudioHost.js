import {useState,useRef,useEffect,useCallback} from 'react';
import {supabase as SB} from '../../../../../lib/supabaseClient';
import {studioChannel,createRemoteToken} from '../../../../../lib/ballStudioRemote';
import {ballShowCues,isBallScheduleActive,nextDinnerSlide,nextPreshowSlide,remainingTime,createCommandReceiver} from '../../../../../lib/ballPlayback';
export function useStudioHost(deck, playback, pairOnOpen = false) {
  const [token,setToken]=useState(() => pairOnOpen ? createRemoteToken() : null);
  const [status,setStatus]=useState('OFF');
  const [phoneSeen,setPhoneSeen]=useState(0);
  const transport=useRef();const current=useRef();current.current={deck,playback};
  useEffect(()=>{
    if(!token)return;
    let sequence=0,lastAck=null;let subscribed=false;
    const receive=createCommandReceiver(()=>current.current.deck.slides.length,action=>current.current.playback.send(action));
    const publish=()=>{
      const {deck,playback}=current.current;const state=playback.stateRef.current;
      const payload={kind:'state',seq:++sequence,ack:lastAck,deckName:deck.name,theme:deck.theme,showNumbers:deck.showNumbers,index:state.index,total:deck.slides.length,current:deck.slides[state.index],next:deck.slides[state.index+1]||(state.loop?deck.slides[0]:null),playing:state.playing,blackout:state.blackout,loop:state.loop,remaining:remainingTime(state)};
      if (playback.show) {
        const { podium, welcome, startAt, welcomeAt, preshowAt } = playback.show;
        if (state.showPhase === 'preshow') {
          payload.nextIndex = nextPreshowSlide(playback.show, state.index);
          payload.next = deck.slides[payload.nextIndex];
        }
        if (state.showPhase === 'dinner') {
          payload.nextIndex = nextDinnerSlide(playback.show, state.index);
          payload.next = deck.slides[payload.nextIndex];
        }
        payload.dinnerSlideshow = Boolean(playback.show.dinnerPhotos);
        payload.showPhase = state.showPhase;
        payload.scheduleActive = playback.protectSchedule && isBallScheduleActive(state);
        payload.preshowAt = preshowAt;
        payload.scheduledTv = playback.protectSchedule;
        payload.countdown = state.showPhase === 'preshow' ? Math.max(0, startAt - Date.now())
          : state.showPhase === 'podium' ? Math.max(0, welcomeAt - Date.now()) : null;
        payload.manualCues = state.showPhase === 'waiting' || state.index >= podium;
        payload.cues = ballShowCues(playback.show, deck.slides.length).map(index => {
          const slide=deck.slides[index];
          const grog=playback.show.grog?.includes(index) || false;
          return {
            index, title: slide.title || 'Untitled cue', grog,
            ...(grog ? { card: {
              layout:slide.layout, title:slide.title, subtitle:slide.subtitle, eyebrow:slide.eyebrow,
              font:slide.font, titleSize:slide.titleSize, align:slide.align, duration:slide.duration,
              photos:slide.photos,
            } } : { time: index > welcome ? slide.eyebrow : '' }),
          };
        });
      }
      return transport.current?.send(payload).then(()=>setStatus('READY')).catch(()=>setStatus('RECONNECTING'));
    };
    const connection=studioChannel(SB,token,message=>{
      if(message.kind==='hello'){setPhoneSeen(Date.now());publish();}
      if(message.kind==='command'){
        if(!receive(message))return;
        setPhoneSeen(Date.now());
        lastAck=message.id;publish();
      }
    },state=>{subscribed=state==='SUBSCRIBED';setStatus(subscribed?'READY':'RECONNECTING');if(subscribed)publish();});
    transport.current=connection;
    const timer=setInterval(()=>{if(subscribed)publish();},1500);
    return()=>{clearInterval(timer);connection.close();transport.current=null;};
  },[token]);
  const stop=useCallback(async()=>{try{await transport.current?.send({kind:'closed'});}catch{/* Session is also revoked by removing the host channel. */}setToken(null);setStatus('OFF');setPhoneSeen(0);},[]);
  return {token,status,phoneSeen,start:()=>setToken(createRemoteToken()),stop};
}
