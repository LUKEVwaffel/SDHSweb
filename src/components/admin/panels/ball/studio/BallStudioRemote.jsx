import {useState,useRef,useEffect} from 'react';
import {supabase as SB} from '../../../../../lib/supabaseClient';
import {studioChannel,readRemoteToken,REMOTE_STALE_MS} from '../../../../../lib/ballStudioRemote';
import {usePresentationWake} from './usePresentationWake';
import SlideCanvas from './SlideCanvas';
import './ballRemote.css';
const seconds=ms=>`${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
export default function BallStudioRemote({client=SB,initialToken=''}={}) {
  const [token,setToken]=useState(()=>readRemoteToken(window.location.hash)||readRemoteToken(initialToken));const [link,setLink]=useState('');
  const [snapshot,setSnapshot]=useState(null);const [received,setReceived]=useState(0);const [now,setNow]=useState(Date.now());
  const [status,setStatus]=useState('CONNECTING');const [error,setError]=useState('');const [pending,setPending]=useState(null);const [target,setTarget]=useState('');
  const channel=useRef();const pendingRef=useRef(null);const latestSeq=useRef(0);const pendingTimers=useRef([]);const pairedAt=useRef(Date.now());
  usePresentationWake(!!token);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    if(!token)return;
    let subscribed=false;latestSeq.current=0;pairedAt.current=Date.now();setSnapshot(null);setReceived(0);setStatus('CONNECTING');
    const connection=studioChannel(client,token,message=>{
      if(message.kind==='closed'){setStatus('ENDED');setError('The TV ended this remote session. Scan a new QR code to reconnect.');setSnapshot(null);return;}
      if(message.kind!=='state'||!Number.isInteger(message.seq)||message.seq<=latestSeq.current||!Number.isInteger(message.index)||!message.current||!Number.isInteger(message.total)||message.total<1||message.index<0||message.index>=message.total)return;
      latestSeq.current=message.seq;setSnapshot(message);setReceived(Date.now());setStatus('CONNECTED');
      if(message.ack&&message.ack===pendingRef.current?.id){pendingRef.current=null;setPending(null);pendingTimers.current.forEach(clearTimeout);pendingTimers.current=[];setError('');}
    },state=>{
      subscribed=state==='SUBSCRIBED';if(!subscribed)setStatus('RECONNECTING');
      if(subscribed)connection.send({kind:'hello'}).catch(()=>setError('Could not reach the TV. Check your connection.'));
    });
    channel.current=connection;
    const hello=setInterval(()=>{if(subscribed)connection.send({kind:'hello'}).catch(()=>{});},2500);
    const visible=()=>{if(document.visibilityState==='visible')connection.send({kind:'hello'}).catch(()=>{});};document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(hello);pendingTimers.current.forEach(clearTimeout);pendingTimers.current=[];pendingRef.current=null;setPending(null);document.removeEventListener('visibilitychange',visible);connection.close();channel.current=null;};
  },[token,client]);
  const connected=!!snapshot&&status==='CONNECTED'&&now-received<REMOTE_STALE_MS;
  const waiting=!received&&now-pairedAt.current>10000;
  const remaining=snapshot?Math.max(0,snapshot.remaining-(snapshot.playing&&!snapshot.blackout?Math.max(0,now-received):0)):0;
  function command(action,index){
    if(!connected||pendingRef.current)return;
    const payload={kind:'command',id:crypto.randomUUID(),action,...(Number.isInteger(index)?{index}:{})};
    pendingRef.current=payload;setPending(payload);setError('');
    const transmit=()=>channel.current?.send(payload).catch(()=>{if(pendingRef.current?.id===payload.id)setError('Connection interrupted. Waiting for the TV to acknowledge…');});
    // Retry the same command ID. The TV deduplicates it, so Next never advances twice.
    if(pendingRef.current?.id===payload.id){pendingTimers.current=[setTimeout(transmit,1200),setTimeout(transmit,2600),setTimeout(()=>{if(pendingRef.current?.id===payload.id){pendingRef.current=null;setPending(null);setError('The TV did not acknowledge this control. Check the current slide before trying again.');}},5000)];}
    transmit();
  }
  function disconnect(){window.history.replaceState(null,'',window.location.pathname);setToken('');setSnapshot(null);setError('');}
  return <main className="ball-remote"><header><div className="br-eyebrow">Trojan Battalion</div><h1>Ball Remote</h1><div className={`br-status ${connected?'is-live':''}`} role="status">{connected?'TV connected':status==='ENDED'?'Session ended':received?'TV connection lost':waiting?'Waiting for the TV':token?'Connecting to presentation':'Pair with your presentation'}</div></header>
    {!token?<form className="br-pair-form" onSubmit={e=>{e.preventDefault();const next=readRemoteToken(link);if(!next){setError('Paste the complete private remote link from the TV.');return;}window.history.replaceState(null,'',`#${next}`);setError('');setToken(next);}}><p>On the TV, open your presentation and choose <strong>Connect phone</strong>. Scan its QR code with your phone’s camera, or paste the private link here.</p><label>Private remote link<textarea value={link} onChange={e=>setLink(e.target.value)} rows={3} autoCapitalize="none" autoCorrect="off" spellCheck={false}/></label><button className="br-primary" type="submit">Connect to TV</button></form>:<>
      {!connected&&<div className="br-connection-note">{received?'Waiting to reconnect. TV controls are paused until a fresh status arrives.':waiting?'Keep the presentation open on the TV. If it was closed, scan the new QR code from a new playback session.':'Controls unlock when the TV confirms its current slide.'}</div>}
      {snapshot&&<><div className="br-deck-name">{snapshot.deckName}</div><section className="br-current"><div className="br-section-label"><span>ON SCREEN · {snapshot.index+1} / {snapshot.total}</span><span>{snapshot.blackout?'BLACKOUT':snapshot.playing?'AUTOPLAY':'MANUAL'}</span></div><SlideCanvas slide={snapshot.current} deck={{theme:snapshot.theme,showNumbers:snapshot.showNumbers}} index={snapshot.index}/></section>
      <div className="br-timing"><span>{snapshot.blackout?'Timer paused for blackout':snapshot.playing?'Time remaining':'Autoplay duration remaining'}</span><strong>{seconds(remaining)}</strong></div>
      <section className="br-controls" aria-label="TV controls"><button disabled={!connected||!!pending||snapshot.index===0} onClick={()=>command('previous')}>Previous</button><button className="br-next" disabled={!connected||!!pending||(!snapshot.loop&&snapshot.index===snapshot.total-1)} onClick={()=>command('next')}>Next slide</button><button disabled={!connected||!!pending} onClick={()=>command(snapshot.playing?'pause':'play')}>{snapshot.playing?'Pause autoplay':'Start autoplay'}</button><button className={snapshot.blackout?'br-black-active':''} disabled={!connected||!!pending} onClick={()=>command('blackout')}>{snapshot.blackout?'Show presentation':'Blackout TV'}</button></section>
      <div className="br-command-status" aria-live="polite">{pending?'Sending control…':connected?'Ready': 'TV connection lost · controls paused'}</div>
      <section className="br-notes"><h2>Speaker notes</h2><p>{snapshot.current.notes||'No speaker notes for this slide.'}</p><small>These notes stay on your phone.</small></section>
      {snapshot.next&&<section className="br-next-preview"><div className="br-section-label">UP NEXT · {snapshot.next.title||snapshot.next.layout}</div><SlideCanvas slide={snapshot.next} deck={{theme:snapshot.theme,showNumbers:false}} index={(snapshot.index+1)%snapshot.total}/></section>}
      <details className="br-more"><summary>More controls</summary><form onSubmit={e=>{e.preventDefault();const n=Number(target);if(Number.isInteger(n)&&n>=1&&n<=snapshot.total)command('goto',n-1);}}><label>Jump to slide<input type="number" min={1} max={snapshot.total} required value={target} onChange={e=>setTarget(e.target.value)} inputMode="numeric"/></label><button disabled={!connected||!!pending}>Go</button></form><button disabled={!connected||!!pending} onClick={()=>command('restart')}>Return to beginning</button><button disabled={!connected||!!pending} onClick={()=>command('loop')}>{snapshot.loop?'Turn looping off':'Loop presentation'}</button></details>
      </>}
      <button className="br-disconnect" onClick={disconnect}>Disconnect this phone</button>
    </>}
    {error&&<p className="br-error" role="alert">{error}</p>}
    <footer>Keep this page open while presenting. Full screen is controlled on the TV.</footer>
  </main>;
}
