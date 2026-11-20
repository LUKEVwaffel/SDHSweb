import test from 'node:test';
import assert from 'node:assert/strict';
import { doorGroups } from '../src/components/ball/checkin/doorRoster.js';
import { makeDoorPreview } from '../src/components/ball/checkin/doorPreview.js';

test('Either attendee name finds the complete reservation; search words may be reversed', () => {
  const people = makeDoorPreview();
  assert.equal(doorGroups(people).length, 5);
  const match = doorGroups(people, 'Guest');
  assert.equal(match.length, 1);
  assert.equal(match[0].people.length, 2);
  assert.equal(match[0].people[0].name, 'Sample Cadet');
  assert.equal(doorGroups(people, 'arrival separate').length, 1);
  assert.equal(doorGroups(people, 'missing name').length, 0);
});
test('Partially arrived reservations remain discoverable in both arrival filters', () => {
  const people = makeDoorPreview();
  assert.equal(doorGroups(people, '', 'arrived').length, 2);
  assert.equal(doorGroups(people, '', 'waiting').length, 4);
  assert.equal(doorGroups(people, '', 'help').length, 1);
  const group = doorGroups(people, 'separate', 'waiting')[0];
  assert.equal(group.people.filter(person => person.checked_in_at).length, 1);
});
test('Search ignores punctuation and accents without combining distinct groups', () => {
  const people = makeDoorPreview();
  people[0].name = 'Test O’Bríen';
  assert.equal(doorGroups(people, 'o brien').length, 1);
  assert.equal(doorGroups(people, 'ALPHA').length, 1);
});

test('VIP filter and name search include the VIP and their date in one reservation', () => {
  const vip = { person_kind: 'vip', person_id: 'vip', name: 'Visiting Leader', group_key: 'vip:vip', issues: [] };
  const date = { person_kind: 'vip_date', person_id: 'date', name: 'Robin Guest', group_key: vip.group_key, issues: [] };
  const people = [...makeDoorPreview().filter(person => person.person_kind !== 'vip'), date, vip];
  assert.deepEqual(doorGroups(people, 'guest robin')[0].people, [vip, date]);
  assert.deepEqual(doorGroups(people, 'leader', 'vip')[0].people, [vip, date]);
  assert.equal(doorGroups(people, '', 'vip').length, 1);
});
