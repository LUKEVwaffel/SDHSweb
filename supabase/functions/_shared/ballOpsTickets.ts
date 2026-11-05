import { isBallLabelEligible } from "./ballTicketEligibility.js";
type Row = Record<string, any>;
// Read-only compatibility while the new SQL is being installed. Never invent
// received tickets from a company name or allow a browser-only delivery write.
export function ballOpsTicketsFromSnapshot(snapshot: Row) {
  const guests = new Map<string, Row>(
    snapshot.guests.map((g: Row) => [g.signup_id, g]),
  );
  const roster = new Map<string, Row>(
    snapshot.roster.map((c: Row) => [c.id, c]),
  );
  const deliveries = new Map<string, Row>(
    snapshot.deliveries.map((d: Row) => [d.signup_id, d]),
  );
  const gender = (value: unknown) => String(value || "").trim().toLowerCase();
  return {
    tracking_available: false,
    checked_at: snapshot.checked_at,
    tickets: snapshot.hosts.map((h: Row) => {
      const g = guests.get(h.id),
        c = roster.get(g?.sdhs_matched_cadet_id),
        d = deliveries.get(h.id);
      const pickupGuest = !!g && g.guest_type !== "friend" &&
        ["female", "f"].includes(gender(h.cadet_gender)) &&
        ["male", "m"].includes(gender(c?.gender || g.gender));
      return {
        signup_id: h.id,
        ready: isBallLabelEligible(h, g),
        distributed: d?.distributed === true,
        recipient_name: pickupGuest ? g!.name : h.cadet_name,
        recipient_company: (pickupGuest ? c?.company : null) ||
          h.cadet_company || "Unassigned",
        received_by_name: d?.recipient_name,
        received_company: d?.recipient_company,
        distributed_at: d?.distributed_at,
        distributed_by: d?.distributed_by,
        ticket_count: g ? 2 : 1,
        historical: false,
        version: `read-only:${snapshot.version}:${h.id}`,
      };
    }),
  };
}
