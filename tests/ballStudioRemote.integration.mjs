// Opt-in live transport test: ephemeral channels and sample state only; no DB writes.
// node --env-file=.env --env-file=.env.local --test tests/ballStudioRemote.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createRemoteToken,studioChannel} from '../src/lib/ballStudioRemote.js';
import {createPlayback,playbackAction,createCommandReceiver} from '../src/lib/ballPlayback.js';
test('live two-client remote: acknowledgements, retry deduplication, jump, pause, blackout, and revocation',{skip:!process.env.VITE_SUPABASE_URL,timeout:30000},async()=>{
 const clients=[0,1].map(()=>createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}));
 const token=createRemoteToken();let state=createPlayback([8,8,8]);let applications=0;const receive=createCommandReceiver(()=>3,a=>{applications++;state=playbackAction(state,a);});
 const ready=[];const waits=[];
 const waitFor=predicate=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('TV acknowledgement timed out')),8000);waits.push({predicate,resolve:m=>{clearTimeout(t);resolve(m);}});});
 const onMessage=m=>{for(let i=waits.length-1;i>=0;i--)if(waits[i].predicate(m)){waits[i].resolve(m);waits.splice(i,1);}};
 const channels=[];
 try {
  const hostReady=new Promise((resolve,reject)=>{ready[0]={resolve,reject};});const phoneReady=new Promise((resolve,reject)=>{ready[1]={resolve,reject};});
  channels[0]=studioChannel(clients[0],token,m=>{if(m.kind==='command'&&receive(m))channels[0].send({kind:'state',ack:m.id,index:state.index,playing:state.playing,blackout:state.blackout,applications}).catch(()=>{});},s=>{if(s==='SUBSCRIBED')ready[0].resolve();if(s==='CHANNEL_ERROR')ready[0].reject(Error('Host channel rejected'));});
  channels[1]=studioChannel(clients[1],token,onMessage,s=>{if(s==='SUBSCRIBED')ready[1].resolve();if(s==='CHANNEL_ERROR')ready[1].reject(Error('Phone channel rejected'));});
  await Promise.all([hostReady,phoneReady]);
  const send=async(action,index,id=crypto.randomUUID())=>{const result=waitFor(m=>m.ack===id);await channels[1].send({kind:'command',id,action,index});return result;};
  const id=crypto.randomUUID();assert.equal((await send('next',undefined,id)).index,1);const duplicate=await send('next',undefined,id);assert.equal(duplicate.index,1);assert.equal(duplicate.applications,1);
  assert.equal((await send('goto',2)).index,2);assert.equal((await send('play')).playing,true);assert.equal((await send('pause')).playing,false);assert.equal((await send('blackout')).blackout,true);assert.equal((await send('previous')).index,1);
  const ended=waitFor(m=>m.kind==='closed');await channels[0].send({kind:'closed'});assert.equal((await ended).kind,'closed');
 } finally {await Promise.all(channels.map(c=>c.close()));clients.forEach(c=>c.realtime.disconnect());}
});
