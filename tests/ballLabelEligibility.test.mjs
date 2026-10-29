import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getBallTicketReadinessIssues, isBallGuestFormRequired, isBallHostFormRequired, isBallLabelEligible} from '../src/lib/ballLabelEligibility.js';
const host={status:'fully_verified',cadet_gender:'female',field_trip_form_required:true,field_trip_form_received:true,amount_due:60,amount_paid:60,cash_received:true,dress_approved:true};
const guest={verified_at:'2026-10-22',field_trip_form_required:true,field_trip_form_received:true,dress_approved:true,guest_type:'date'};
test('required host and guest approval must explicitly be true',()=>{
  assert.equal(isBallLabelEligible(host,guest),true);
  for(const value of [null,undefined,false]){
    assert.equal(isBallLabelEligible({...host,dress_approved:value},guest),false);
    assert.equal(isBallLabelEligible(host,{...guest,dress_approved:value}),false);
  }
});
test('standard-uniform male cadets are exempt regardless of stored approval; standalone guests are not',()=>{
  assert.equal(isBallLabelEligible({...host,cadet_gender:'male',dress_approved:null}),true);
  assert.equal(isBallLabelEligible({...host,cadet_gender:'male',dress_approved:false}),true);
  assert.equal(isBallLabelEligible({...host,cadet_gender:'male',standalone_guest:true,dress_approved:null}),false);
  assert.equal(isBallLabelEligible({...host,cadet_gender:'male',standalone_guest:true,dress_approved:false}),false);
  assert.equal(isBallLabelEligible({...host,cadet_gender:null,dress_approved:null}),false);
});
test('standard-uniform host status does not block a reservation when guest attire is approved',()=>{
  const issues=getBallTicketReadinessIssues({...host,cadet_name:'Makaio Roos',cadet_gender:'male',dress_approved:false},{...guest,name:'Maylee Mitchell',dress_approved:true});
  assert.ok(!issues.some(issue=>issue.includes('attire')));
});
test('each required form and verification is checked independently',()=>{
  assert.equal(isBallLabelEligible({...host,field_trip_form_received:false},guest),false);
  assert.equal(isBallLabelEligible({...host,field_trip_form_required:false},{...guest,field_trip_form_received:false}),false);
  assert.equal(isBallLabelEligible({...host,status:'guest_pending'},guest),false);
  assert.equal(isBallLabelEligible(host,{...guest,verified_at:null}),false);
  assert.equal(isBallLabelEligible(host,{...guest,field_trip_form_required:false,field_trip_form_received:false,is_sdhs_jrotc:false,school_attended:'Central High School'}),true);
});
test('school identity overrides a stale form exemption while known outside-school identity is honored',()=>{
  assert.equal(isBallHostFormRequired({...host,cadet_gender:'male',standalone_guest:false,field_trip_form_required:false}),true);
  assert.equal(isBallGuestFormRequired({...guest,field_trip_form_required:false,is_sdhs_jrotc:true}),true);
  const cadetHost={...host,cadet_gender:'male',dress_approved:false};
  const sdhsGuest={...guest,field_trip_form_required:false,is_sdhs_jrotc:true,field_trip_form_received:false};
  assert.equal(isBallLabelEligible(cadetHost,sdhsGuest),false);
  assert.ok(getBallTicketReadinessIssues(cadetHost,sdhsGuest).includes("Guest's field-trip form is not marked received."));
  const explicitlyWaived={...guest,field_trip_form_required:false,is_sdhs_jrotc:false,school_attended:null,field_trip_form_received:false};
  assert.equal(isBallLabelEligible(cadetHost,explicitlyWaived),false);
  const knownOutsideGuest={...guest,field_trip_form_required:false,is_sdhs_jrotc:false,school_attended:'Central High School',field_trip_form_received:false};
  assert.equal(isBallLabelEligible(cadetHost,knownOutsideGuest),true);
});
test('partial, unknown and invalid amounts block even with a stale cash flag',()=>{
  assert.equal(isBallLabelEligible({...host,amount_paid:20},guest),false);
  for(const amount of [null,undefined,'',NaN,-1])assert.equal(isBallLabelEligible({...host,amount_due:amount},guest),false);
  assert.equal(isBallLabelEligible({...host,amount_paid:null},guest),true);
});
test('friend payment is required independently including host-delivered payments',()=>{
  const friend={...guest,guest_type:'friend',friend_amount_due:35,friend_payment_method:'self_pays',friend_cash_received:false};
  assert.equal(isBallLabelEligible(host,friend),false);
  assert.equal(isBallLabelEligible(host,{...friend,friend_cash_received:true}),true);
  assert.equal(isBallLabelEligible(host,{...friend,friend_payment_method:'host_delivers'}),true);
  assert.equal(isBallLabelEligible(host,{...friend,friend_amount_due:null,friend_cash_received:true}),false);
});
