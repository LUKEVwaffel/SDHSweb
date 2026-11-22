export const personKey = person => `${person.person_kind}:${person.person_id}`;
export const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const isVip = person => person.person_kind === 'vip' || person.person_kind === 'vip_date';
export function canCheckInBoth(people) {
  if (people?.length !== 2) return false;
  const [first, second] = people;
  return first.group_key === second.group_key && personKey(first) !== personKey(second)
    && people.every(person => !person.checked_in_at && !person.issues.length);
}

export function doorGroups(people, query = '', filter = 'all') {
  const groups = new Map();
  for (const person of people) {
    if (!groups.has(person.group_key)) groups.set(person.group_key, { id: person.group_key, people: [] });
    groups.get(person.group_key).people.push(person);
  }
  const terms = normalizeName(query).split(' ').filter(Boolean);
  return [...groups.values()].map(group => ({ ...group, people: group.people.sort((a, b) => Number(['guest', 'vip_date'].includes(a.person_kind)) - Number(['guest', 'vip_date'].includes(b.person_kind))) }))
    .filter(group => {
      const text = normalizeName(group.people.map(person => `${person.name} ${person.company || ''}`).join(' '));
      return terms.every(term => text.includes(term)) && (filter === 'all'
        || (filter === 'waiting' && group.people.some(person => !person.checked_in_at))
        || (filter === 'vip' && group.people.some(isVip))
        || (filter === 'arrived' && group.people.some(person => person.checked_in_at))
        || (filter === 'help' && group.people.some(person => !person.checked_in_at && person.issues.length)));
    }).sort((a, b) => a.people[0].name.localeCompare(b.people[0].name));
}
