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
