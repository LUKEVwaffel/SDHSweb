// Optional live authentication smoke test. Creates one temporary viewer account
// with fictional details, never a company seat, and deletes it in finally.
// Prints no PINs, tokens, emails, or birthday data.
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const url=process.env.VITE_SUPABASE_URL, anon=process.env.VITE_SUPABASE_ANON_KEY, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anon||!key)throw Error('Use the existing local environment files');
const svc=createClient(url,key,{auth:{persistSession:false}}),client=createClient(url,anon,{auth:{persistSession:false}});
const email=`boards-audit-${crypto.randomUUID()}@example.invalid`;
const pin=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');
const salt=crypto.getRandomValues(new Uint8Array(16));
const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},raw,256);
const hash=`pbkdf2$210000$${Buffer.from(salt).toString('base64')}$${Buffer.from(bits).toString('base64')}`;
let userId,memberId;
try{
 const user=await svc.auth.admin.createUser({email,email_confirm:true});if(user.error)throw Error('Fixture auth creation failed: '+user.error.code);userId=user.data.user.id;
 const member=await svc.from('board_members').insert({email,display_name:'Temporary authentication audit',board_role:'viewer',company:null}).select('public_id').single();
 if(member.error)throw Error('Fixture membership failed: '+member.error.code);memberId=member.data.public_id;
 const credential=await svc.from('board_credentials').insert({email,pin_hash:hash});if(credential.error)throw Error('Fixture PIN failed: '+credential.error.code);
 const request=async(body)=>{const response=await fetch(`${url}/functions/v1/board-onboarding`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 const wrong=await request({action:'pin_login',member_id:memberId,pin:pin==='9999'?'0000':'9999'});assert.equal(wrong.status,401,'Wrong PIN accepted');
 const good=await request({action:'pin_login',member_id:memberId,pin});assert.equal(good.status,200,JSON.stringify({stage:'PIN login',status:good.status,error:good.data.error}));
 assert.equal(typeof good.data.token_hash,'string');
 const exchange=await client.auth.verifyOtp({token_hash:good.data.token_hash,type:'magiclink'});assert.ifError(exchange.error);assert.equal(exchange.data.user.id,userId);
 const who=await client.rpc('board_whoami');assert.ifError(who.error);assert.equal(who.data[0].board_role,'viewer');
 const edgeGuard=await client.functions.invoke('board-practice-sign',{body:{session_id:'00000000-0000-4000-8000-000000000000',pin:'0000'}});assert.equal(edgeGuard.error?.context?.status,403,'A genuine Auth session was rejected by the Edge JWT gateway instead of reaching the role check');
 const state=await client.rpc('board_practice_state');assert.ifError(state.error);assert.equal(state.data.identity[0].email,email);assert.deepEqual(state.data.account_status,[],'Viewer can read private verification status');
 const denied=await client.rpc('board_practice_start',{p_title:'Unauthorized fixture',p_company:null});assert.ok(denied.error,'Viewer started a meeting');
 console.log('PASS: live wrong-PIN rejection, PIN login, real Auth session exchange, identity, and viewer permission checks');
}finally{
 if(memberId){const removal=await svc.from('board_members').delete().eq('email',email);if(removal.error)throw Error('Fixture membership cleanup failed');}
 if(userId){const removal=await svc.auth.admin.deleteUser(userId);if(removal.error)throw Error('Fixture auth cleanup failed');}
 console.log('Temporary authentication fixture removed.');
}
