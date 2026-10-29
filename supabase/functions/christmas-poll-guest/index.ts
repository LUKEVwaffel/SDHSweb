import { json, preflight } from '../_shared/http.ts';
import { getCaller, serviceClient } from '../_shared/supabase.ts';
import { hashPin, verifyPin } from '../_shared/pin.ts';
import { issuePollGuestToken, validPollGuestToken } from '../_shared/pollGuestToken.ts';

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return preflight();
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const body=await req.json();const svc=serviceClient();
  if(body.mode==='reset'){
   const caller=await getCaller(req);
   if(!caller||caller.role!=='s6'||caller.mustChangePassword)return json({error:'S-6 required'},403);
   if(typeof body.passcode!=='string'||body.passcode.length<6||body.passcode.length>32)return json({error:'Use a passcode of 6 to 32 characters'},400);
   const {error}=await svc.from('christmas_poll_guest_access').update({passcode_hash:await hashPin(body.passcode),pin_hash:null,fail_count:0,locked_until:null,updated_at:new Date().toISOString()}).eq('id',true);
   return error?json({error:'Could not reset guest access'},500):json({ok:true});
  }
  const {data:settings,error:readError}=await svc.from('christmas_poll_guest_access').select('passcode_hash,pin_hash').eq('id',true).single();
  if(readError||!settings?.passcode_hash)return json({error:'Guest access is not configured yet'},503);
  const secret=settings.passcode_hash+'|'+(settings.pin_hash||'');
  let token;
  if(body.mode==='login'||body.mode==='pin_login'){
   const usingPin=body.mode==='pin_login';
   if(typeof body.passcode!=='string'||(usingPin?!/^\d{4}$/.test(body.passcode):body.passcode.length<6||body.passcode.length>32))return json({error:'Password or PIN not accepted'},401);
   const attempt=await svc.rpc('reserve_christmas_guest_attempt');
   if(attempt.error)return json({error:'Could not verify guest access'},503);
   if(attempt.data!==true)return json({error:'Too many attempts. Wait 15 minutes or ask the organizer to reset the code.'},423);
   if(!await verifyPin(body.passcode,usingPin?settings.pin_hash:settings.passcode_hash))return json({error:'Password or PIN not accepted. Use your password if you have not set a PIN yet.'},401);
   const reset=await svc.from('christmas_poll_guest_access').update({fail_count:0,locked_until:null}).eq('id',true);
   if(reset.error)return json({error:'Could not complete guest sign-in'},503);
   token=await issuePollGuestToken(secret);
  }else if(body.mode==='results'||body.mode==='set_pin'){
   if(!await validPollGuestToken(body.token,secret))return json({error:'Guest session expired. Sign in again.'},401);
   if(body.mode==='set_pin'){
    if(typeof body.pin!=='string'||!/^\d{4}$/.test(body.pin))return json({error:'Enter exactly four digits'},400);
    const pinHash=await hashPin(body.pin);
    const change=await svc.from('christmas_poll_guest_access').update({pin_hash:pinHash,fail_count:0,locked_until:null,updated_at:new Date().toISOString()}).eq('id',true).eq('passcode_hash',settings.passcode_hash).select('id').single();
    if(change.error)return json({error:'PIN could not be saved'},503);
    token=await issuePollGuestToken(settings.passcode_hash+'|'+pinHash);
   }
  }else return json({error:'Invalid request'},400);
  const totals=await svc.rpc('christmas_poll_guest_totals');
  if(totals.error)return json({error:'Results could not be loaded'},503);
  return json({results:totals.data,pin_configured:body.mode==='set_pin'||!!settings.pin_hash,...(token?{token}:{})});
 }catch{return json({error:'Guest results are temporarily unavailable'},500);}
});
