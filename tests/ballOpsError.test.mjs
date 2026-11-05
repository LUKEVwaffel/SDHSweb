import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ballOpsErrorMessage} from '../src/lib/ballOpsError.js';
test('A failed lookup does not imply a reservation may have been saved',()=>{
 for(const action of ['search','pricing','packet']){
  const message=ballOpsErrorMessage({name:'ball-ops-reservation',action,message:'Failed to send a request to the Edge Function'});
  assert.match(message,/does not change reservations/);
  assert.doesNotMatch(message,/may have reached|confirm the save/);
 }
});
test('An uncertain write preserves the retry warning but a missing endpoint identifies deployment',()=>{
 assert.match(ballOpsErrorMessage({name:'ball-ops-reservation',action:'create',message:'Failed to send'}),/Could not confirm the save/);
 assert.match(ballOpsErrorMessage({name:'ball-ops-reservation',action:'create',message:'Failed to send',status:404}),/not been deployed/);
 assert.match(ballOpsErrorMessage({name:'ball-ops-reservation',action:'search',message:'Requested function was not found'}),/Nothing was saved/);
});
