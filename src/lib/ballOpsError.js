export function ballOpsErrorMessage({ name, action, message = "", status }) {
  if (
    (name === "ball-ops-reservation" && status === 404) ||
    /function.*not found|Could not find the function/i.test(message)
  ) {
    return "The Ball Ops reservation tools have not been deployed to the server yet. S-6 needs to install the database update and deploy ball-ops-reservation. Nothing was saved by this request.";
  }
  if (/Failed to send|fetch|timeout|Connection failed/i.test(message)) {
    if (
      name === "ball-ops-reservation" &&
      ["create", "remove_guest", "complete_guest", "receive_tickets"].includes(
        action,
      )
    ) {
      return "Could not confirm the save. Check your connection, then retry the same request to check the saved result.";
    }
    if (name === "ball-resend-guest-invite") {
      return "Could not confirm email delivery. The reservation is saved. Check your connection and retry the invitation.";
    }
    return "Could not load the Ball reservation tools. Check your connection or ask S-6 to check the backend deployment. This action does not change reservations.";
  }
  return message || "The request failed. Please retry.";
}
