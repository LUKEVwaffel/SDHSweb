// DEV-only fixture: real editor, deterministic archive, no production writes.
import React from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import {supabase as SB} from '../../src/lib/supabaseClient';
import BallPresentationStudio from '../../src/components/admin/panels/ball/studio/BallPresentationStudio';
if(!import.meta.env.DEV)throw new Error('Local preview only.');
const photos=Array.from({length:1203},(_,i)=>({id:`photo-${String(i).padStart(4,'0')}`,photo_url:`/images/raiders/raider-${i%9+1}.jpg`,thumb_url:`/images/raiders/raider-${i%9+1}.jpg`,grid_url:null,event_id:i%2?'competition':'service',team:i%2?'raiders':'battalion',uploader_name:`Archive photograph ${i+1}`,status:'live',upload_status:'done',created_at:`2026-10-${String(i%28+1).padStart(2,'0')}T12:00:00Z`}));
const cloud=new Map(JSON.parse(sessionStorage.getItem('ball-studio-qa-cloud')||'[]'));
const persistCloud=()=>sessionStorage.setItem('ball-studio-qa-cloud',JSON.stringify([...cloud]));
SB.from=table=>{
 let filters=[],payload=null,action='select',start=0,end=999;
 const query={select(){return query;},order(){return query;},range(a,b){start=a;end=b;return query;},eq(k,v){filters.push([k,v]);return query;},like(){return query;},insert(value){action='insert';payload=value;return query;},update(value){action='update';payload=value;return query;},then(resolve,reject){return Promise.resolve().then(()=>{
  if(table==='events')return {data:[{id:'competition',title:'Raider competition'},{id:'service',title:'Community service'}]};
  if(table==='photos')return {data:photos.slice(start,end+1)};
  if(table!=='admin_settings')return {data:[]};
  if(action==='insert'){if(cloud.has(payload.key))return {error:{message:'Deck already exists'}};cloud.set(payload.key,payload);persistCloud();return {data:[{updated_at:payload.updated_at}]};}
  if(action==='update'){const key=filters.find(([k])=>k==='key')?.[1];const row=cloud.get(key);if(!row||!filters.every(([k,v])=>row[k]===v))return {data:[]};cloud.set(key,{...row,...payload});persistCloud();return {data:[{updated_at:payload.updated_at}]};}
  return {data:[...cloud.values()]};
 }).then(resolve,reject);}};return query;
};
createRoot(document.getElementById('root')).render(<><div style={{padding:'8px 20px',color:'#e4c17b',font:'12px Inter,sans-serif'}}>LOCAL QA · 1,203 sample archive records · Cloud writes stay in this tab</div><BallPresentationStudio adminId="studio-local-qa"/></>);
