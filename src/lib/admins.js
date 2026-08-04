// Maps DISPATCH admin login email -> public display name. Only two accounts
// ever upload photos through DISPATCH (Luke, Kaiden). Never render the raw
// email on the public frontend — always go through this map, fallback to a
// generic label so an unmapped future admin doesn't leak an address.
const ADMIN_NAMES = {
  'nositenoproblem12@gmail.com': 'Luke',
  'alexzandergray2008@gmail.com': 'Kaiden',
  // TODO: add Kaiden's login email here, e.g. 'kaiden@example.com': 'Kaiden',
};

export function adminDisplayName(email) {
  if (!email) return null;
  return ADMIN_NAMES[email.toLowerCase()] || 'Staff';
}
