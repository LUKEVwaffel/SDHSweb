// Shared content for Military Ball's existing print slip and Dispatch's PDF bundle.
export const GUEST_VERIFICATION_COPY = {
  organization: "Trojan Battalion JROTC · Military Ball",
  title: "Guest Not Yet Verified",
  returnTo: "Return completed sheet to S-6",
  commanderLabel: "To the company commander",
  cadetLabel: "To the cadet",
  emailLabel: "Verification email sent to",
  correction: "If the email above is wrong, write the correct one here:",
  correctedBy: "Corrected by (name)",
  date: "Date",
  footer: "Once complete, return this sheet to the S-6 desk.",
};
export function guestVerificationSlip(data) {
  const companyLabel = String(data.companyLabel || "No company on file")
    .toUpperCase();
  const cadetName = String(data.cadetName || "Not on file");
  const guestName = String(data.guestName || "Not on file");
  return {
    ...GUEST_VERIFICATION_COPY,
    companyLabel,
    cadetName,
    guestName,
    letLevel: String(data.letLevel || "").replace(/^LET\s*/i, ""),
    sentTo: String(data.sentTo || "no email on file"),
    commanderInstruction:
      `Deliver this paper directly to ${cadetName} in ${companyLabel} company.`,
    cadetInstruction:
      `Your guest, ${guestName}, has not verified yet. Please check with your guest that the email below is correct, and have them check their spam/junk folder for the verification email.`,
  };
}
