// Military Ball attire approvers — HARDCODED on purpose. Keep in sync with
// src/lib/ballApprovers.js. S-6 does not edit these; the Ball settings panel
// only provisions the portal PIN logins.

export const DRESS_APPROVERS = [
  { name: "Kylie Gray", phone: "(423) 681-3011" },
  { name: "Aubrey Gillott", phone: "(423) 309-0171" },
];

export const WESTON = { name: "Weston Noblit", phone: "(423) 987-2261" };

// One-line attire summary for the guest email, scoped to the guest's gender so
// a male guest never sees the female dress rules or the female approvers (and
// vice versa). `null`/unknown gender falls back to pointing at the linked page.
export function attireLineHtml(gender: string | null | undefined): string {
  if (gender === "female") {
    const who = DRESS_APPROVERS.map((a) => `${a.name} ${a.phone}`).join(" or ");
    return `<strong style="color:#F4ECD8;">Attire:</strong> a long formal dress, approved before the ball &mdash; text a photo (front and back, worn) to ${who}.`;
  }
  if (gender === "male") {
    return `<strong style="color:#F4ECD8;">Attire:</strong> a black-and-white suit with a bowtie, or full Class A with a white shirt and bowtie. Questions &mdash; ${WESTON.name} ${WESTON.phone}.`;
  }
  return `<strong style="color:#F4ECD8;">Attire:</strong> the full dress code and the right contact are on the confirmation page linked above.`;
}

export function attireLineText(gender: string | null | undefined): string {
  if (gender === "female") {
    const who = DRESS_APPROVERS.map((a) => `${a.name} ${a.phone}`).join(" or ");
    return `Attire: a long formal dress, approved before the ball — text a photo (front and back, worn) to ${who}.`;
  }
  if (gender === "male") {
    return `Attire: a black-and-white suit with a bowtie, or full Class A with a white shirt and bowtie. Questions — ${WESTON.name} ${WESTON.phone}.`;
  }
  return "Attire: the full dress code and the right contact are on the confirmation page linked above.";
}
