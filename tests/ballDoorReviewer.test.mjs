import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPin } from '../supabase/functions/_shared/pin.ts';
import { identifyDoorReviewer } from '../supabase/functions/_shared/doorReviewer.ts';
const aubryHash = await hashPin('1001');
const kylieHash = await hashPin('2002');
const reviewers = [
  {key:'aubry',email:'aubry@example.invalid',name:'Aubry Gillott',pin_hash:aubryHash,active:true},
  {key:'kylie',email:'kylie@example.invalid',name:'Kylie Gray',pin_hash:kylieHash,active:true},
];
test('Code identifies the correct reviewer without a selected name', async () => {
  assert.equal((await identifyDoorReviewer('1001',reviewers)).reviewer.key,'aubry');
  assert.equal((await identifyDoorReviewer('2002',reviewers)).reviewer.key,'kylie');
});
test('Unknown code cannot record a decision', async () => {
  const result=await identifyDoorReviewer('3003',reviewers);
  assert.equal(result.reviewer,null); assert.ok(result.error);
});
test('Duplicate codes fail closed instead of assigning the wrong reviewer', async () => {
  const result=await identifyDoorReviewer('1001',reviewers.map(person=>({...person,pin_hash:aubryHash})));
  assert.equal(result.reviewer,null); assert.match(result.error,/different/);
});
test('Inactive and non-designated reviewers cannot approve', async () => {
  assert.equal((await identifyDoorReviewer('1001',[{...reviewers[0],active:false}])).reviewer,null);
  assert.equal((await identifyDoorReviewer('1001',[{...reviewers[0],key:'other'}])).reviewer,null);
});
test('Existing reviewer lockout is honored', async () => {
  const result=await identifyDoorReviewer('1001',[{...reviewers[0],pin_locked_until:new Date(Date.now()+60000).toISOString()}]);
  assert.equal(result.reviewer,null); assert.match(result.error,/locked/);
});
