import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBallRequest} from '../src/lib/ballRequest.js';
const readError=async(data,error,fallback)=>data?.error||error?.message||fallback;
test('Thrown Ball requests resolve to errors so signup and verification can leave busy state',async()=>{
 const request=createBallRequest(async()=>{throw new TypeError('Network lost');},readError);
 assert.match((await request('ball-submit-signup',{},'Failed')).error,/response may have been lost/);
 assert.match((await request('ball-guest-verify',{peek:true},'Lookup failed.')).error,/Check your connection/);
});
test('Missing data cannot crash roster search and function error bodies remain visible',async()=>{
 const missing=createBallRequest(async()=>({data:null,error:null}),readError);
 assert.match((await missing('ball-search-roster',{},'Search failed.')).error,/incomplete response/);
 const denied=createBallRequest(async()=>({data:{error:'Signups are closed'},error:null}),readError);
 assert.equal((await denied('ball-submit-signup',{},'Failed')).error,'Signups are closed');
});
test('Ball requests apply a finite timeout and preserve successful results',async()=>{
 const request=createBallRequest(async(name,options)=>{assert.equal(options.timeout,30000);return {data:{ok:true},error:null};},readError);
 assert.deepEqual(await request('ball-guest-verify',{},'Failed'),{data:{ok:true}});
});
