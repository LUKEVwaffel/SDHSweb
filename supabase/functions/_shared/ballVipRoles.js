export const VIP_ROLE_LABELS = {
  visiting_leadership: 'Visiting XO/BC/CSM',
  visiting_xo_bc: 'Visiting XO/BC',
  visiting_xo: 'Visiting XO',
  visiting_bc: 'Visiting BC',
  visiting_csm: 'Visiting CSM',
  past_king_queen: 'Past King/Queen',
};
export const VIP_ROLES = Object.keys(VIP_ROLE_LABELS);
/** @param {unknown} value @returns {string} */
export function normalizeVipRole(value) {
  const role = typeof value === 'string' ? value.trim() : '';
  return role === 'visiting_xo_bc' ? 'visiting_leadership' : role;
}
