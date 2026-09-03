// Military Ball attire approvers — HARDCODED on purpose.
//
// S-6 does not edit these anywhere in the app. The Ball settings panel only
// provisions their portal PIN logins (Attire Staff Accounts tab); the names and
// numbers shown to cadets and guests live here and change only with a code
// deploy. Keep this file and supabase/functions/_shared/ballApprovers.ts in sync.

export const DRESS_APPROVERS = [
  { name: 'Kylie Gray', phone: '(423) 681-3011' },
  { name: 'Aubrey Gillott', phone: '(423) 309-0171' },
];

// Male-guest attire (and male-cadet Class A questions).
export const WESTON = { name: 'Weston Noblit', phone: '(423) 987-2261' };
