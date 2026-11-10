import {useState,useRef,useEffect,useCallback} from 'react';
import {supabase as SB} from '../../../../../lib/supabaseClient';
import {studioChannel,createRemoteToken} from '../../../../../lib/ballStudioRemote';
import {remainingTime,createCommandReceiver} from '../../../../../lib/ballPlayback';
export function useStudioHost(deck, playback) {
  const [token,setToken]=useState(null);
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
      // Thumbnail URLs are omitted on the wire; the phone only renders two slides.
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
