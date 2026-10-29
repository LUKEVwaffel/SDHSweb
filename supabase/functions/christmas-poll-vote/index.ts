import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/supabase.ts';

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return preflight();
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const body=await req.json();const device=String(body.device_fp||'');
  if(!/^(fp_[a-f0-9]{32}|browser_[a-f0-9-]{36})$/i.test(device))return json({error:'This browser could not be identified. Please try again.'},400);
  const svc=serviceClient();
  let already=false;
  if(body.mode==='vote'){
   const name=String(body.name||'').replace(/\p{Cc}/gu,'').replace(/\s+/g,' ').trim();
   if(!name||name.length>100)return json({error:'Please enter your name (up to 100 characters).'},400);
   if(!['november_1','after_thanksgiving'].includes(body.choice))return json({error:'Choose one of the two answers.'},400);
   const insert=await svc.from('christmas_music_poll_votes').insert({voter_name:name,choice:body.choice,device_fp:device,source:'public'});
   if(insert.error&&insert.error.code!=='23505')return json({error:'Your vote could not be saved. Please try again.'},500);
   already=insert.error?.code==='23505';
  }else if(body.mode!=='results')return json({error:'Invalid request'},400);
  const existing=await svc.from('christmas_music_poll_votes').select('choice').eq('device_fp',device).maybeSingle();
  if(existing.error)return json({error:'Could not confirm your vote'},503);
  if(!existing.data)return json({error:'Vote before viewing the poll split'},403);
  const totals=await svc.rpc('christmas_poll_guest_totals');
  if(totals.error)return json({error:'Your vote is saved, but the poll split is temporarily unavailable. Refresh to try again.'},503);
  const total=Number(totals.data.total);const sunday=total?Math.round(Number(totals.data.november_1)/total*100):0;
  // Public voters get only the split; no names, totals, device IDs or raw votes.
  return json({already_voted:already,choice:existing.data.choice,results:{november_1_percent:sunday,after_thanksgiving_percent:total?100-sunday:0}});
 }catch{return json({error:'The poll is temporarily unavailable. Please try again.'},500);}
});
