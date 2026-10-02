// Tiny, eagerly-loaded sandbox constants. The fake-data API itself
// (boardApi.demo.js) stays a lazy chunk that only loads on /boards/sandbox.
export const STORE_KEY = 'tb-sandbox-v1';

export const SANDBOX_ROLES = [
  { id: 'alpha', label: 'Alpha laptop' },
  { id: 'bravo', label: 'Bravo laptop' },
  { id: 'charlie', label: 'Charlie laptop' },
  { id: 'delta', label: 'Delta laptop' },
  { id: 'sai', label: 'Chief (SAI)' },
  { id: 'viewer', label: 'S-1 viewer' },
];

export function resetSandbox() {
  try { sessionStorage.removeItem(STORE_KEY); } catch { /* storage blocked — state was in-memory only */ }
}
