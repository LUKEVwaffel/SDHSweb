import test from 'node:test';
import assert from 'node:assert/strict';
import { createDoorSource } from '../src/components/ball/checkin/doorSource.js';
const person = { person_kind: 'cadet', person_id: 'real-person', name: 'Database attendee', checked_in_at: null, revision: null };
test('Sandbox reads real roster but never sends attendance writes, including undo', async () => {
  const calls = [];
  const rpc = async (name) => { calls.push(name); assert.equal(name, 'ball_checkin_roster'); return { data: { people: [{ ...person }] }, error: null }; };
  const source = createDoorSource(rpc, true);
  assert.equal((await source.load()).data.people[0].name, person.name);
  await source.mark(person, true);
  assert.ok((await source.load()).data.people[0].checked_in_at);
  await source.mark(person, false);
  assert.equal((await source.load()).data.people[0].checked_in_at, null);
  assert.ok(calls.every(name => name === 'ball_checkin_roster'));
});
test('Reset removes practice overrides and restores database arrival status', async () => {
  const source = createDoorSource(async () => ({ data: { people: [{ ...person, checked_in_at: '2026-10-26T12:00:00Z' }] }, error: null }), true);
  await source.mark(person, false);
  assert.equal((await source.load()).data.people[0].checked_in_at, null);
  source.reset();
  assert.equal((await source.load()).data.people[0].checked_in_at, '2026-10-26T12:00:00Z');
});
test('Sandbox does not bypass roster authorization errors', async () => {
  const response = { data: null, error: { message: 'Check-in access required' } };
  const source = createDoorSource(async () => response, true);
  assert.deepEqual(await source.load(), response);
});
test('Live mode retains revision-protected attendance writes', async () => {
  let call;
  const source = createDoorSource(async (name, args) => { call = { name, args }; return { data: {}, error: null }; }, false);
  await source.mark(person, true);
  assert.equal(call.name, 'ball_set_arrival');
  assert.equal(call.args.p_person, person.person_id);
  assert.equal(call.args.p_present, true);
});

test('Practice pair arrival blocks an uncleared member and safely checks in both cleared members', async () => {
  const host = { ...person, group_key: 'couple', issues: [] };
  const guest = { ...host, person_id: 'real-guest', person_kind: 'guest' };
  const source = createDoorSource(async name => {
    assert.equal(name, 'ball_checkin_roster');
    return { data: { people: [host, guest] }, error: null };
  }, true);
  assert.ok((await source.checkInBoth([host, { ...guest, issues: ['Unpaid'] }])).error);
  assert.ok((await source.checkInBoth([host, host])).error);
  assert.ok((await source.load()).data.people.every(row => !row.checked_in_at));
  assert.equal((await source.checkInBoth([host, guest])).data.length, 2);
  assert.ok((await source.load()).data.people.every(row => row.checked_in_at));
});
