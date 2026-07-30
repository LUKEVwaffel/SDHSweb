// Legacy tab-id <-> path mapping, shared by App.jsx and any component that
// still navigates by the old hash-era id strings (e.g. 'company-alpha',
// 'profile-42'). Lets call sites convert to real router navigation one file
// at a time without every file needing its own id-to-path logic.
export function legacyIdToPath(id) {
  if (id === 'home') return '/';
  if (typeof id === 'string' && id.startsWith('profile-')) return `/profile/${id.replace('profile-', '')}`;
  if (typeof id === 'string' && id.startsWith('company-')) return `/company/${id.replace('company-', '')}`;
  return `/${id}`;
}

export function pathToLegacyId(pathname) {
  const seg = pathname.replace(/^\//, '');
  if (seg === '') return 'home';
  if (seg.startsWith('company/')) return `company-${seg.slice('company/'.length)}`;
  if (seg.startsWith('profile/')) return `profile-${seg.slice('profile/'.length)}`;
  return seg;
}
