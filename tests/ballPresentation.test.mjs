import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDeck,makeSlide,moveSlide,readDeck,totalDuration,safePhotoUrl} from '../src/lib/ballPresentation.js';
import {loadStudioPhotos} from '../src/lib/ballStudioPhotos.js';
test('deck round trips with safe editable content and stable photo slots',()=>{
  const deck=makeDeck();deck.slides.push(makeSlide('duo',{photos:[null,{id:'photo',url:'https://photos.example/1.jpg',caption:'<script>text only</script>'}]}));
  const imported=readDeck(JSON.parse(JSON.stringify(deck)));
  assert.notEqual(imported.id,deck.id);assert.equal(imported.slides.length,5);assert.equal(imported.slides[4].photos[0],null);assert.equal(imported.slides[4].photos[1].caption,'<script>text only</script>');assert.equal(totalDuration(imported),40);
});
test('deck import rejects invalid shape and constrains unsafe values',()=>{
  assert.throws(()=>readDeck({version:1,slides:[]}));assert.throws(()=>readDeck({version:1,slides:[{layout:'script'}]}));
  const d=makeDeck();Object.assign(d.slides[0],{duration:-100,titleSize:10000,transition:'evil',font:'url(bad)',photos:[{url:'javascript:alert(1)'}]});
  const s=readDeck(d).slides[0];assert.equal(s.duration,1);assert.equal(s.titleSize,120);assert.equal(s.transition,'fade');assert.equal(s.font,'Oswald');assert.equal(s.photos[0],null);
  assert.equal(safePhotoUrl('data:image/svg+xml;base64,PHN2Zz4='),'');assert.equal(safePhotoUrl('javascript:alert(1)'),'');
});
test('reordering preserves identity and never mutates the prior sequence',()=>{
  const slides=makeDeck().slides;const ids=slides.map(s=>s.id);const moved=moveSlide(slides,0,3);assert.deepEqual(slides.map(s=>s.id),ids);assert.equal(moved[3].id,ids[0]);assert.deepEqual(new Set(moved.map(s=>s.id)),new Set(ids));assert.equal(moveSlide(slides,-1,2),slides);
});
test('library pages beyond API limits and isolates source failures',async()=>{
  const calls=[];
  const client={from(table){return {select(){return this;},order(){return this;},async range(start,end){calls.push({table,start,end});if(table==='tv_photos')return {error:{message:'offline'}};if(table==='events')return {data:[{id:'event',title:'Raider event'}]};if(table!=='photos')return {data:[]};return {data:Array.from({length:Math.max(0,Math.min(500,1203-start))},(_,i)=>({id:start+i,photo_url:`https://photos.example/${start+i}.jpg`,status:start+i===0?'hidden':'live',upload_status:'done',event_id:'event',team:'raiders'}))};}};}};
  const result=await loadStudioPhotos(client);assert.equal(result.photos.length,1202);assert.equal(result.photos.at(-1).id,'photos:1202');assert.equal(result.photos[0].event,'Raider event');assert.equal(result.warnings.length,1);assert.ok(calls.some(c=>c.table==='photos'&&c.start===1000));
});

import {saveStudioCloud} from '../src/lib/ballStudioCloud.js';
test('cloud saves use the known revision and refuse conflicting writes',async()=>{
  const filters=[];let inserted=false;
  const client={from(table){assert.equal(table,'admin_settings');return {update(){return this;},insert(){inserted=true;return this;},eq(key,value){filters.push([key,value]);return this;},async select(){return {data:[]};}};}};
  const deck={...makeDeck(),cloudRevision:'2026-11-10T12:00:00.000Z'};
  await assert.rejects(()=>saveStudioCloud(client,deck,'staff'),/changed on another device/);
  assert.deepEqual(filters,[['key',`ball_presentation:${deck.id}`],['updated_at',deck.cloudRevision]]);assert.equal(inserted,false);
});
test('a new cloud deck is inserted and does not overwrite an existing record',async()=>{
  let payload;
  const client={from(){return {insert(row){payload=row;return this;},async select(){return {data:[{updated_at:payload.updated_at}]};}};}};
  const deck=makeDeck();const revision=await saveStudioCloud(client,deck,'staff');assert.equal(payload.key,`ball_presentation:${deck.id}`);assert.equal(payload.updated_by,'staff');assert.equal(payload.value,deck);assert.equal(revision,payload.updated_at);
});
test('cloud permission and network failures remain visible',async()=>{
  const client={from(){return {insert(){return this;},async select(){return {error:{message:'Permission denied'}};}};}};
  await assert.rejects(()=>saveStudioCloud(client,makeDeck(),'staff'),/Permission denied.*browser copy/);
});

import {createPlayback,remainingTime,playbackAction,validateRemoteCommand} from '../src/lib/ballPlayback.js';
import {createRemoteToken,validRemoteToken,readRemoteToken,remoteUrl} from '../src/lib/ballStudioRemote.js';
import {auditPresentation} from '../src/lib/ballStudioAudit.js';
test('blackout freezes remaining autoplay time and resumes from that point',()=>{
 let s=createPlayback([8,10],0,false,0);s=playbackAction(s,{type:'play'},0);s=playbackAction(s,{type:'blackout'},3000);assert.equal(remainingTime(s,20000),5000);s=playbackAction(s,{type:'blackout'},20000);assert.equal(remainingTime(s,24000),1000);s=playbackAction(s,{type:'tick'},25000);assert.equal(s.index,1);assert.equal(s.remaining,10000);
});
test('pause, resume, manual moves, boundaries and looping behave consistently',()=>{
 let s=playbackAction(createPlayback([8,8],0,false,0),{type:'play'},0);s=playbackAction(s,{type:'pause'},2000);assert.equal(remainingTime(s,9000),6000);s=playbackAction(s,{type:'play'},10000);s=playbackAction(s,{type:'tick'},16000);assert.equal(s.index,1);s=playbackAction(s,{type:'tick'},24000);assert.equal(s.playing,false);assert.equal(s.remaining,0);s=playbackAction(s,{type:'play'},25000);assert.equal(s.remaining,8000);s=playbackAction(s,{type:'loop'},25000);s=playbackAction(s,{type:'next'},26000);assert.equal(s.index,0);assert.equal(s.playing,true);s=playbackAction(s,{type:'previous'},26000);assert.equal(s.index,0);
});
test('autoplay ignores early ticks, bad jumps and unknown actions',()=>{
 const s=createPlayback([8,8],0,false,0);assert.equal(playbackAction(s,{type:'tick'},10000),s);assert.equal(playbackAction(s,{type:'goto',index:NaN},0),s);assert.equal(playbackAction(s,{type:'delete-deck'},0),s);const play=playbackAction(s,{type:'play'},0);assert.equal(playbackAction(play,{type:'tick'},2000),play);
});
test('single-slide loops restart the entrance without changing slides',()=>{
 let s=playbackAction(createPlayback([1],0,true,0),{type:'play'},0);s=playbackAction(s,{type:'tick'},1000);assert.equal(s.index,0);assert.equal(s.visit,1);assert.equal(s.playing,true);
});
test('remote links use 256-bit session secrets and reject short or malformed links',()=>{
 const a=createRemoteToken(),b=createRemoteToken();assert.notEqual(a,b);assert.equal(validRemoteToken(a),true);assert.equal(a.length,64);assert.equal(readRemoteToken(remoteUrl('https://school.example',a)),a);assert.equal(readRemoteToken('ABC123'),'');assert.equal(validRemoteToken('x'.repeat(64)),false);
});
test('remote accepts only the playback control vocabulary and valid slide targets',()=>{
 const base={id:crypto.randomUUID()};assert.deepEqual(validateRemoteCommand({...base,action:'next'},4),{type:'next'});assert.equal(validateRemoteCommand({...base,action:'goto',index:4},4),null);assert.equal(validateRemoteCommand({...base,action:'goto',index:1.5},4),null);assert.equal(validateRemoteCommand({...base,action:'delete'},4),null);assert.equal(validateRemoteCommand({id:'bad',action:'next'},4),null);
});
test('pre-show audit finds empty slots, unavailable photos and low resolution, checking each URL once',async()=>{
 const deck=makeDeck();deck.slides=[makeSlide('duo',{photos:[{url:'https://photo.example/a.jpg'},null]}),makeSlide('photo',{photos:[{url:'https://photo.example/a.jpg'}]}),makeSlide('photo',{photos:[{url:'https://photo.example/b.jpg'}]})];const calls=[];
 const result=await auditPresentation(deck,async url=>{calls.push(url);if(url.endsWith('b.jpg'))throw Error('offline');return {width:640,height:480};});assert.equal(calls.length,2);assert.equal(result.checkedPhotos,2);assert.equal(result.issues.filter(i=>i.kind==='missing').length,1);assert.equal(result.issues.filter(i=>i.kind==='resolution').length,2);assert.equal(result.issues.filter(i=>i.kind==='unavailable').length,1);
});
test('photo motion and matte framing survive editable deck export and import',()=>{
 const deck=makeDeck();deck.slides=[makeSlide('photo',{motion:'zoom',frame:'matte'})];const s=readDeck(deck).slides[0];assert.equal(s.motion,'zoom');assert.equal(s.frame,'matte');
});

import {createCommandReceiver} from '../src/lib/ballPlayback.js';
test('remote retries acknowledge the same command without advancing twice',()=>{
 const actions=[];const receive=createCommandReceiver(()=>5,a=>actions.push(a));const message={id:crypto.randomUUID(),action:'next'};
 assert.equal(receive(message),true);assert.equal(receive(message),true);assert.equal(receive(message),true);assert.equal(actions.length,1);assert.equal(receive({id:crypto.randomUUID(),action:'goto',index:99}),false);
});

test('a saved presentation can be reopened, edited and saved repeatedly under the same identity',async()=>{
 const rows=new Map();
 const client={from(){let action,payload,filters=[];return {insert(row){action='insert';payload=row;return this;},update(row){action='update';payload=row;return this;},eq(k,v){filters.push([k,v]);return this;},async select(){if(action==='insert'){if(rows.has(payload.key))return {error:{message:'duplicate'}};rows.set(payload.key,payload);return {data:[{updated_at:payload.updated_at}]};}const key=filters.find(([k])=>k==='key')[1];const old=rows.get(key);if(!old||!filters.every(([k,v])=>old[k]===v))return {data:[]};rows.set(key,{...old,...payload});return {data:[{updated_at:payload.updated_at}]};}};}};
 let deck=makeDeck();const originalId=deck.id;
 deck.cloudRevision=await saveStudioCloud(client,deck,'staff');
 for(const title of ['Revised welcome','Final welcome']){
  const row=rows.get(`ball_presentation:${originalId}`);
  deck={...readDeck(JSON.parse(JSON.stringify(row.value))),id:originalId,cloudRevision:row.updated_at};
  deck.slides[0].title=title;deck.cloudRevision=await saveStudioCloud(client,deck,'staff');
 }
 assert.equal(rows.size,1);assert.equal(rows.get(`ball_presentation:${originalId}`).value.slides[0].title,'Final welcome');
});

test('saving an existing presentation always advances its revision',async()=>{
 const deck={...makeDeck(),cloudRevision:'2099-01-01T00:00:00.000Z'};
 const client={from(){return {update(){return this;},eq(){return this;},async select(){return {data:[{}]};}};}};
 const next=await saveStudioCloud(client,deck,'staff');assert.ok(Date.parse(next)>Date.parse(deck.cloudRevision));
});
