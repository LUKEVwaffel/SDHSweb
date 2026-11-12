import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDressQueue, groupDressQueue } from '../src/lib/ballDressQueue.js';

test('dates inherit their host company even when the host does not need dress approval', () => {
  const items = buildDressQueue([
    { id: 'host', cadet_name: 'Male Host', cadet_gender: 'male', cadet_company: ' Bravo ' },
    { id: 'cadet', cadet_name: 'Female Cadet', cadet_gender: 'female', cadet_company: 'ALPHA', dress_approved: true },
  ], [{ id: 'date', signup_id: 'host', name: 'Date', verified_at: null }], [], []);
  assert.equal(items.length, 2);
  assert.equal(items.some((x) => x.id === 'host'), false);
  assert.equal(items.find((x) => x.id === 'cadet').company, 'alpha');
  const date = items.find((x) => x.id === 'date');
  assert.equal(date.company, 'bravo');
  assert.equal(date.hostName, 'Male Host');
  assert.equal(date.kind, 'guest');
  assert.equal(date.verified_at, null);
  assert.equal(items.find((x) => x.id === 'cadet').dress_approved, true);
});

test('company groups keep cadets and dates together and sort names within company order', () => {
  const groups = groupDressQueue([
    { name: 'Delta', company: 'delta' },
    { name: 'Zoe', company: 'alpha', kind: 'cadet' },
    { name: 'Charlie', company: 'charlie' },
    { name: 'Amy', company: 'alpha', kind: 'guest' },
    { name: 'Bravo', company: 'bravo' },
  ]);
  assert.deepEqual(groups.map((g) => g.key), ['alpha', 'bravo', 'charlie', 'delta']);
  assert.deepEqual(groups[0].items.map((x) => x.name), ['Amy', 'Zoe']);
});

test('cadets registered as guests use their own roster company instead of their host company', () => {
  const items = buildDressQueue([
    { id: 'host', cadet_name: 'Host', cadet_gender: 'male', cadet_company: 'alpha' },
  ], [{ id: 'cadet-date', signup_id: 'host', name: 'Cadet Date', guest_company: ' CHARLIE ', guest_let_level: 2 }], [], []);
  assert.equal(items[0].company, 'charlie');
  assert.equal(items[0].hostName, 'Host');
  assert.equal(items[0].guest_let_level, 2);
  assert.equal(groupDressQueue(items)[0].key, 'charlie');
});

test('VIPs and dates with no known host remain visible in separate fallback groups', () => {
  const items = buildDressQueue([], [{ id: 'orphan', signup_id: 'missing', name: 'Guest' }],
    [{ id: 'vip', name: 'VIP' }], [{ id: 'vipdate', name: 'VIP Date' }]);
  const groups = groupDressQueue(items);
  assert.deepEqual(groups.map((g) => g.key), ['vip', 'unassigned']);
  assert.deepEqual(groups[0].items.map((x) => x.kind), ['vip', 'vipdate']);
  assert.equal(groups[1].items[0].id, 'orphan');
  assert.deepEqual(groupDressQueue([]), []);
});

test('a cadet guest with a missing roster company is not assigned the host company', () => {
  const items = buildDressQueue([{ id: 'host', cadet_gender: 'male', cadet_company: 'alpha' }],
    [{ id: 'cadet-date', signup_id: 'host', guest_is_cadet: true, guest_company: null }], [], []);
  assert.equal(groupDressQueue(items)[0].key, 'unassigned');
});
