import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshQueue} from '../src/components/boards/meeting/refreshQueue.js';
import {draftKey,readDraft,writeDraft,recoverPracticeForm,normalizePracticeForm} from '../src/components/boards/meeting/draftRecovery.js';
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('a post-save refresh waits for the older read and fetches the saved state',async()=>{
 const old=defer();const seen=[];let calls=0;
 const q=createRefreshQueue(()=>++calls===1?old.promise:Promise.resolve({score:20}),s=>seen.push(s.score),e=>{throw e;});
 const first=q.refresh();await Promise.resolve();const saved=q.refresh(true);old.resolve({score:0});await Promise.all([first,saved]);
 assert.deepEqual(seen,[0,20]);assert.equal(calls,2);
});
test('concurrent ordinary refreshes share one request',async()=>{
 const waiting=defer();let calls=0;const q=createRefreshQueue(()=>{calls++;return waiting.promise;},()=>{},()=>{});
 const a=q.refresh(),b=q.refresh();waiting.resolve({});await Promise.all([a,b]);assert.equal(calls,1);
});
test('an old account response is discarded after signout/account switch',async()=>{
 const waiting=defer();let epoch=1;const seen=[];
 const q=createRefreshQueue(()=>waiting.promise,s=>seen.push(s),()=>{},()=>epoch);
 const p=q.refresh();await Promise.resolve();epoch=2;waiting.resolve({company:'alpha'});await p;assert.deepEqual(seen,[]);
});
test('a timed-out read releases the queue and a later reconnect works',async()=>{
 let calls=0;const errors=[],seen=[];
 const q=createRefreshQueue(signal=>++calls===1?new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('offline')),{once:true})):Promise.resolve('reconnected'),s=>seen.push(s),e=>errors.push(e.message),()=>0,15);
 await q.refresh();await q.refresh();assert.equal(errors.length,1);assert.match(errors[0],/timed out/);assert.deepEqual(seen,['reconnected']);
});
test('a recovered sheet keeps its old revision, so it cannot overwrite another leader',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const key=draftKey('alpha@example.invalid','session-a','cadet-a');
 const form=normalizePracticeForm({rank:'PVT',scores:{score_facing:3},comment:'Unsent notes'});
 assert.equal(writeDraft(storage,key,form,'old-revision'),true);
 const recovered=recoverPracticeForm({rank:'PVT',scores:{score_facing:1}},readDraft(storage,key));
 assert.equal(recovered.baseRevision,'old-revision');assert.equal(recovered.form.comment,'Unsent notes');
 assert.equal(readDraft(storage,draftKey('bravo@example.invalid','session-a','cadet-a')),null);
});
test('a lost save response is recognized when the server already holds the same form',()=>{
 const form=normalizePracticeForm({rank:'PVT',scores:{score_facing:3},uniform:{mode:'class_a',missing:[],infractions:[]},comment:'Saved'});
 const server={rank_before:'PVT',scores:{score_facing:3,score_uniform:9},uniform_inspection:{mode:'class_a',missing:[],infractions:[]},comment:'Saved'};
 assert.equal(recoverPracticeForm(server,{form,baseRevision:null}),null);
});
test('storage denial and corrupt local recovery do not crash the score sheet',()=>{
 assert.equal(writeDraft({setItem(){throw Error('private storage');}},'key',{},null),false);
 assert.equal(readDraft({getItem:()=>'{broken'},'key'),null);
 assert.equal(readDraft({getItem:()=>JSON.stringify({version:1,savedAt:Date.now()})},'key'),null);
});

import {requiresPinSetup} from '../src/components/boards/meeting/identityState.js';
test('an existing portal login cannot skip first-time board PIN setup',()=>{
 const member={company:'alpha',board_role:'co',is_s6:false};
 const directory=[{company:'alpha',board_role:'co',needs_setup:true}];
 assert.equal(requiresPinSetup(member,directory),true);
 assert.equal(requiresPinSetup(member,[{...directory[0],needs_setup:false}]),false);
 assert.equal(requiresPinSetup({...member,is_s6:true},directory),false);
 assert.equal(requiresPinSetup({board_role:'sai'},directory),false);
});
