// Development-only fixtures for practicing without changing the live guest list.
export function makeDoorPreview() {
  const person = (kind, id, name, company, group, companion = null, issues = [], arrived = false) => ({ person_kind: kind, person_id: id, name, company, group_key: group, companion, issues, checked_in_at: arrived ? new Date().toISOString() : null, revision: null });
  return [
    person('cadet', 'sample-1', 'Sample Cadet', 'Alpha', 'sample-couple', 'Sample Guest'),
    person('guest', 'sample-2', 'Sample Guest', 'Alpha', 'sample-couple', 'Sample Cadet'),
    person('cadet', 'sample-3', 'Practice Arrival', 'Bravo', 'sample-arrived', null, [], true),
    person('cadet', 'sample-4', 'Needs Assistance', 'Charlie', 'sample-help', null, ['Permission form missing']),
    person('vip', 'sample-5', 'Visiting Leader', 'VIP', 'sample-vip'),
    person('cadet', 'sample-6', 'Separate Arrival', 'Delta', 'sample-separate', 'Arriving Later', [], true),
    person('guest', 'sample-7', 'Arriving Later', 'Delta', 'sample-separate', 'Separate Arrival'),
  ];
}
