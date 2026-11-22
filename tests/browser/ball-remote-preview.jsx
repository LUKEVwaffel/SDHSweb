// DEV-only remote UI test. Public sample token and in-memory transport; no network.
import React from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import BallStudioRemote from '../../src/components/admin/panels/ball/studio/BallStudioRemote';
import {makeDeck} from '../../src/lib/ballPresentation';
import {createPlayback,playbackAction,remainingTime,createCommandReceiver} from '../../src/lib/ballPlayback';
if(!import.meta.env.DEV)throw Error('Development only.');
const deck=makeDeck();deck.slides[0].notes='Welcome our guests and introduce the evening.';
let state=createPlayback(deck.slides.map(s=>s.duration)),handler,sequence=0,ack=null,online=true;
const receive=createCommandReceiver(()=>deck.slides.length,a=>{state=playbackAction(state,a);});
function publish(){if(!online)return;handler?.({payload:{kind:'state',seq:++sequence,ack,deckName:deck.name,theme:deck.theme,showNumbers:false,index:state.index,total:deck.slides.length,current:deck.slides[state.index],next:deck.slides[state.index+1]||null,playing:state.playing,blackout:state.blackout,loop:state.loop,remaining:remainingTime(state)}});}
const client={channel(){return {on(type,options,callback){handler=callback;return this;},subscribe(callback){setTimeout(()=>callback('SUBSCRIBED'),50);return this;},async send({payload}){if(!online)return 'error';if(payload.kind==='command'&&receive(payload))ack=payload.id;setTimeout(publish,80);return 'ok';}};},async removeChannel(){handler=null;}};
function Preview(){return <><div style={{padding:'8px 12px',font:'11px Inter,sans-serif',color:'#e4c17b'}}>LOCAL QA · Sample slides · No live connection <button onClick={()=>{online=!online;if(online)publish();}}>Toggle TV connection</button></div><BallStudioRemote client={client} initialToken={'a'.repeat(64)}/></>;}
createRoot(document.getElementById('root')).render(<Preview/>);
