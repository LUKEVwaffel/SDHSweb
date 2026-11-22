const COMPANY_ORDER = ['alpha', 'bravo', 'charlie', 'delta'];

function companyKey(value) {
  return (value || '').trim().toLowerCase();
}

export function buildDressQueue(cadets, guests, vips, vipDates) {
  // Male hosts still provide their date's company, but do not need a dress approval.
  const hosts = new Map(cadets.map((c) => [c.id, c]));
  return [
    ...cadets.filter((c) => c.cadet_gender === 'female').map((c) => ({
      ...c, kind: 'cadet', name: c.cadet_name, company: companyKey(c.cadet_company),
    })),
    ...guests.map((g) => {
      const host = hosts.get(g.signup_id);
      return { ...g, kind: 'guest', company: companyKey(g.guest_company) || (g.guest_is_cadet ? '' : companyKey(host?.cadet_company)), hostName: host?.cadet_name || '' };
    }),
    ...vips.map((v) => ({ ...v, kind: 'vip', company: 'vip' })),
    ...vipDates.map((d) => ({ ...d, kind: 'vipdate', company: 'vip' })),
  ];
}

export function groupDressQueue(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.company || 'unassigned';
    if (!groups.has(key)) {
      const label = key === 'vip' ? 'VIPs & VIP dates' : key === 'unassigned' ? 'Company not assigned' : `${key.toUpperCase()} Company`;
      groups.set(key, { key, label, items: [] });
    }
    groups.get(key).items.push(item);
  }
  const position = (key) => {
    const index = COMPANY_ORDER.indexOf(key);
    return index >= 0 ? index : key === 'vip' ? 100 : key === 'unassigned' ? 101 : 99;
  };
  return [...groups.values()].sort((a, b) => position(a.key) - position(b.key) || a.label.localeCompare(b.label))
    .map((group) => ({ ...group, items: group.items.sort((a, b) => (a.name || '').localeCompare(b.name || '')) }));
}
