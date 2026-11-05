import {completeBallGuestVerification} from '../supabase/functions/_shared/ballGuestVerification.ts';
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
function fixture({already=false,failParent=false,removeGuest=false}={}) {
 const state={guest:{id:'guest',signup_id:'host',name:'Test Guest',verified_at:already?'2026-11-01T12:00:00Z':null,guest_phone:'4235550100'},host:{cadet_name:'Test Host',notification_email:null,status:'guest_pending'},parentWrites:0};
 let fail=failParent;
 const svc={from(table:string){let patch:Record<string,unknown>|null=null;let onlyUnverified=false;const run=async()=>{
  if(table==='ball_guests'){
   if(patch&&removeGuest)return {data:null,error:null};
   if(!patch&&removeGuest)return {data:null,error:null};
   if(onlyUnverified&&state.guest.verified_at)return {data:null,error:null};
   if(patch)Object.assign(state.guest,patch);
   return {data:{...state.guest},error:null};
  }
  if(fail){fail=false;return {data:null,error:{message:'Temporary parent save failure'}};}
  state.parentWrites++;if(patch)Object.assign(state.host,patch);return {data:{...state.host},error:null};
 };const chain={select:()=>chain,eq:()=>chain,is:()=>{onlyUnverified=true;return chain;},update:(value:Record<string,unknown>)=>{patch=value;return chain;},maybeSingle:run,single:run};return chain;}};
 return {svc:svc as never,state};
}
Deno.test('Retry repairs the parent after guest verification was already saved',async()=>{
 const {svc,state}=fixture({failParent:true});let rejected=false;
 try{await completeBallGuestVerification(svc,'token',{phone:'4235550199',allergies:null});}catch{rejected=true;}
 assert(rejected,'Initial parent failure was concealed');assert(state.guest.verified_at,'Guest write should already exist');assert(state.host.status==='guest_pending','Parent should not have saved');
 const retry=await completeBallGuestVerification(svc,'token',{phone:'4235550199',allergies:null});
 assert(retry.alreadyVerified,'Retry repeated registration');assert(state.host.status==='fully_verified','Retry left host stuck pending');assert(state.guest.guest_phone==='4235550199','Required phone was lost');
});
Deno.test('Reopening a verified invitation preserves the original guest answers',async()=>{
 const {svc,state}=fixture({already:true});const result=await completeBallGuestVerification(svc,'token',{phone:'4235550999',allergies:'Changed'});
 assert(result.alreadyVerified,'Verified invitation was treated as new');assert(state.guest.guest_phone==='4235550100','Repeat submission overwrote contact details');assert(state.host.status==='fully_verified','Parent was not reconciled');
});
Deno.test('A removed invitation cannot mark a host verified',async()=>{
 const {svc,state}=fixture({removeGuest:true});let rejected=false;
 try{await completeBallGuestVerification(svc,'token',{phone:'4235550100',allergies:null});}catch{rejected=true;}
 assert(rejected,'Missing invitation accepted');assert(state.parentWrites===0,'Missing guest changed parent');
});
