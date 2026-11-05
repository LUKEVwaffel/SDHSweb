import { supabase as SB } from "./supabaseClient";
import { invokeError } from "./supabaseFnError";
import { createBallRequest } from "./ballRequest";
const callBall = createBallRequest(
  (name, options) => SB.functions.invoke(name, options),
  invokeError,
);
export const lookupCadet = (username) =>
  callBall("ball-lookup-cadet", { username }, "Cadet lookup failed.");
export async function searchRoster(signupToken, q) {
  const result = await callBall(
    "ball-search-roster",
    { signupToken, q },
    "Search failed.",
  );
  return result.error ? result : { data: result.data.results || [] };
}
export const resolveRosterCadet = (signupToken, cadetId) =>
  callBall(
    "ball-search-roster",
    { signupToken, cadet_id: cadetId },
    "Cadet lookup failed.",
  );
export const submitSignup = (signupToken, payload) =>
  callBall(
    "ball-submit-signup",
    { signupToken, ...payload },
    "Submission failed.",
  );
export const submitVipSignup = (payload) =>
  callBall("ball-submit-vip-signup", payload, "Submission failed.");
export const guestPeek = (token) =>
  callBall(
    "ball-guest-verify",
    { token, peek: true },
    "Invitation lookup failed.",
  );
export const guestVerify = (token, { allergies, accepted_dress_code, phone }) =>
  callBall("ball-guest-verify", {
    token,
    allergies,
    accepted_dress_code,
    phone,
  }, "Verification failed.");
