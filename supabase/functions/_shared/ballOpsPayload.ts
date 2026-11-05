// Ops may print invitations and review payments/forms. Allergy and attire
// review fields belong to their separate staff roles and are not needed here.
const hostPrivate = [
  "cadet_allergies",
  "cadet_has_allergy",
  "cadet_allergy_email",
  "allergy_status",
  "allergy_contacted_at",
  "dress_approved",
  "dress_approved_by",
];
const guestPrivate = ["allergies", "dress_approved", "dress_approved_by"];
const omit = (record: Record<string, unknown> | null, keys: string[]) =>
  record
    ? Object.fromEntries(
      Object.entries(record).filter(([key]) => !keys.includes(key)),
    )
    : null;
export function ballOpsPayload(packet: Record<string, any>): Record<string, unknown> & {signup:Record<string,unknown>|null;guest:Record<string,unknown>|null} {
  return {
    ...packet,
    signup: omit(packet.signup, hostPrivate),
    guest: omit(packet.guest, guestPrivate),
  };
}
