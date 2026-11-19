import test from 'node:test';
import assert from 'node:assert/strict';
import { doorIssues } from '../src/components/ball/checkin/doorAdmission.js';
import { createDoorSource } from '../src/components/ball/checkin/doorSource.js';
const person = { person_kind:'guest',person_id:'test-person',name:'Test Guest',payment_complete:true,form_required:true,form_received:false,attire_status:'pending',verification_complete:true,student_status_unknown:false };
const roster = async name => { assert.equal(name,'ball_checkin_roster'); return { data:{ people:[{...person}] },error:null }; };

test('Unpaid or denied attendees cannot be admitted even when other requirements are complete', async () => {
  for (const change of [{ payment_complete:false,attire_status:'approved' },{ payment_complete:true,attire_status:'denied' }]) {
    const blocked={...person,form_received:true,...change};
    let invoked=false;
    const source=createDoorSource(async () => { invoked=true; },true);
    assert.ok((await source.mark(blocked,true)).error);
    assert.equal(invoked,false);
  }
  assert.ok(doorIssues({...person,payment_complete:false}).some(issue=>issue.includes('Cash is not accepted')));
});
test('A parent must be present and have signed; sandbox receipt never calls a live writer', async () => {
  const source=createDoorSource(roster,true,()=>assert.fail('Sandbox form receipt called the server'));
  assert.ok((await source.receiveForm(person,'Parent Name',false)).data.error);
  assert.equal((await source.load()).data.people[0].form_received,false);
  assert.ok((await source.receiveForm(person,'Parent Name',true)).data.result.form_received);
  const updated=(await source.load()).data.people[0];
  assert.equal(updated.form_received,true);
  assert.equal(updated.attire_status,'pending');
  assert.ok((await source.mark(updated,true)).error,'Paperwork must not bypass attire');
});
test('Sandbox attire requires the protected verifier and cannot silently become a live action', async () => {
  const calls=[];
  const source=createDoorSource(roster,true,async body => { calls.push(body); return { data:{result:{attire_status:'denied',attire_by:'Kylie Gray'}},error:null }; });
  await source.decideAttire(person,'0000',false); // Local mock only; no actual PIN verification request.
  assert.equal(calls[0].sandbox,true);
  assert.equal(calls[0].action,'attire');
  assert.equal(calls[0].approver,undefined);
  assert.equal(calls[0].approved,false);
  const denied=(await source.load()).data.people[0];
  assert.equal(denied.attire_status,'denied');
  assert.ok(denied.issues.some(issue=>issue.includes('Do not admit')));
  source.reset();
  assert.equal((await source.load()).data.people[0].attire_status,'pending');
});
test('Rejected passcode does not alter the roster', async () => {
  const source=createDoorSource(roster,true,async () => ({ data:{error:'Code not accepted'},error:null }));
  await source.decideAttire(person,'0000',true);
  assert.equal((await source.load()).data.people[0].attire_status,'pending');
});
test('School confirmation cannot skip the SDHS student form requirement', async () => {
  const source=createDoorSource(roster,true,()=>assert.fail('Sandbox school identification wrote to server'));
  await source.confirmStudent(person,true);
  const updated=(await source.load()).data.people[0];
  assert.equal(updated.form_required,true);
  assert.equal(updated.form_received,false);
  assert.equal(updated.student_status_unknown,false);
  assert.ok(updated.issues.some(issue=>issue.includes('Parent must attend')));
});
