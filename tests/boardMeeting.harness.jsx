// Browser QA only: this Vite development entry is excluded from production.
// The actual components run against a fictional transport with no real writes.
import React from 'react';
import {createRoot} from 'react-dom/client';
import MeetingApp from '../src/components/boards/meeting/MeetingApp';
import {CATEGORIES,uniformScore,totalScore} from '../src/lib/boardRules';
import '../src/index.css';
const KEY='tb-local-workshop-audit-v3';
const companies=['alpha','bravo','charlie','delta'],seats=['co','xo','1sg'];
const actor=new URLSearchParams(location.search).get('actor')||'host';
const me=actor==='host'?{email:'presenter@fixture.invalid',display_name:'Audit Presenter',board_role:'viewer',company:null,is_s6:true}:{email:`${actor}@fixture.invalid`,display_name:`Audit ${actor}`,board_role:actor.split('.')[0],company:actor.split('.')[1],is_s6:false};
const names=companies.flatMap(company=>seats.map(board_role=>({member_id:`${board_role}.${company}`,display_name:`Audit ${board_role.toUpperCase()} ${company}`,board_role,company,email:`${board_role}.${company}@fixture.invalid`,needs_setup:false})));
const initial=()=>({sessions:[],rounds:[],sheets:[],signatures:[],presence:names.map(m=>({...m,last_seen:new Date().toISOString()})),directory:names,account_status:names.map(m=>({...m,has_dob:true,has_pin:true}))});
if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(initial()));
const read=()=>JSON.parse(localStorage.getItem(KEY));
const write=data=>{localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('audit-change'));};
const clone=data=>JSON.parse(JSON.stringify(data));
const roundId=()=>crypto.randomUUID();
const callbacks=new Set();
window.addEventListener('storage',e=>{if(e.key===KEY)callbacks.forEach(f=>f());});
window.addEventListener('audit-change',()=>callbacks.forEach(f=>f()));
const authClient={getSession:async()=>({data:{session:{user:{email:me.email}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>location.reload()};
const identity={whoami:async()=>[me],directory:async()=>names};
const realtime={channel(){const subscribed=[];const channel={on(_type,_filter,callback){subscribed.push(callback);return channel;},subscribe(){subscribed.forEach(f=>callbacks.add(f));return channel;},close(){subscribed.forEach(f=>callbacks.delete(f));}};return channel;},removeChannel:c=>c.close()};
const api={
 async load(signal){if(signal?.aborted)throw Error('Aborted');const d=read();d.identity=[me];if(!me.is_s6){d.sessions=d.sessions.filter(s=>s.company===me.company);d.sheets=d.sheets.filter(s=>s.company===me.company);d.signatures=d.signatures.filter(s=>s.company===me.company);d.account_status=[];}return clone(d);},
 async heartbeat(){},
 async start(){const d=read();const id=roundId();const now=new Date().toISOString();d.rounds.push({id,host_controlled:true,status:'running',started_at:now});companies.forEach(company=>d.sessions.unshift({id:roundId(),round_id:id,company,status:'running',started_at:now,required_signers:names.filter(m=>m.company===company).map(m=>({email:m.email,name:m.display_name,seat:m.board_role})),roster:Array.from({length:8},(_,i)=>({id:`${company}-${i}`,name:`Cadet ${company} ${i+1}`,company,let_level:2,grade:10,cadet_rank:'PVT',leadership_position:false}))}));write(d);return id;},
 async save(p){const d=read();const s=d.sessions.find(x=>x.id===p.session_id);if(s.status!=='running')throw Error('Session ended');const c=s.roster.find(c=>c.id===p.cadet_id);let row=d.sheets.find(x=>x.session_id===s.id&&x.cadet_id===c.id);if(row&&row.revision!==p.expected_revision)throw Error('Another leader saved this cadet. Reload before saving.');if(!row){row={id:roundId(),session_id:s.id,cadet_id:c.id,cadet_name:c.name,company:s.company,let_level:2};d.sheets.push(row);}const scores={...p.scores,score_uniform:uniformScore(p.uniform_inspection)};Object.assign(row,p,{scores,total:totalScore(scores),revision:roundId(),simulated:false});write(d);return clone(row);},
 async discard(id){const d=read();d.sheets=d.sheets.filter(s=>s.id!==id);write(d);},
 async end(id){const d=read();const r=d.rounds.find(r=>r.id===id);r.status='review';d.sessions.filter(s=>s.round_id===id).forEach(s=>{s.status='review';s.review_snapshot=s.roster.slice(0,6).map(c=>{const existing=d.sheets.find(x=>x.session_id===s.id&&x.cadet_id===c.id&&x.status==='complete');return existing??{id:roundId(),session_id:s.id,company:s.company,cadet_id:c.id,cadet_name:c.name,let_level:2,rank_before:'PVT',scores:Object.fromEntries(CATEGORIES.map(c=>[c.key,c.max])),decision:'promote',promote_to:'PV2',status:'complete',total:20,simulated:true,comment:'Fictional browser audit example'};});});write(d);},
 async sign(id,pin){if(pin!=='1234'){const e=new Error('invalid');e.body={error:'invalid',remaining:4};throw e;}const d=read();const s=d.sessions.find(s=>s.id===id);if(s.status!=='review')throw Error('Session is not awaiting signatures');if(!d.signatures.some(x=>x.session_id===id&&x.seat===me.board_role))d.signatures.push({session_id:id,company:s.company,seat:me.board_role,signed_by:me.email,signed_name:me.display_name,signed_at:new Date().toISOString()});if(d.signatures.filter(x=>x.session_id===id).length===3)s.status='signed';write(d);},
 async cancel(id,reason){const d=read();const r=d.rounds.find(r=>r.id===id);r.status='cancelled';r.cancellation_reason=reason;d.sessions.filter(s=>s.round_id===id&&s.status!=='signed').forEach(s=>s.status='cancelled');write(d);},
 async unlock(){},
};
const questionLoader=async()=>[{id:'jrotc-1',category:'jrotc',question:'What is the mission of JROTC?',answer:'To motivate young people to be better citizens.'}];
createRoot(document.getElementById('root')).render(<React.StrictMode><MeetingApp api={api} identity={identity} authClient={authClient} realtime={realtime} questionLoader={questionLoader}/></React.StrictMode>);
