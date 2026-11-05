import { supabase as SB } from "./supabaseClient";
import { ballOpsErrorMessage } from "./ballOpsError";
export async function ballOpsFunction(name, body) {
  const { data, error } = await SB.functions.invoke(name, {
    body,
    timeout: 30000,
  });
  if (error) {
    let message = error.message;
    let status = error.context?.status;
    try {
      const detail = await error.context.json();
      message = detail.error || detail.message || message;
    } catch { /* Network errors have no response body. */ }
    // A missing function can fail browser preflight before its 404 is exposed
    // by the SDK. A public GET cannot mutate records and distinguishes it from
    // an uncertain save caused by a dropped response.
    if (!status && /Failed to send|fetch|timeout/i.test(message)) {
      try {
        const probe = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`,
          {
            method: "GET",
            credentials: "omit",
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
          },
        );
        if (probe.status === 404) status = 404;
      } catch { /* Keep the transport error if the network is unavailable. */ }
    }
    throw new Error(
      ballOpsErrorMessage({ name, action: body.action, message, status }),
    );
  }
  if (data?.error) {
    throw new Error(
      ballOpsErrorMessage({ name, action: body.action, message: data.error }),
    );
  }
  if (!data || typeof data !== "object") {
    throw new Error(
      "The server returned an incomplete response. Please retry.",
    );
  }
  return data;
}
export const opsRequest = (body) =>
  ballOpsFunction("ball-ops-reservation", body);
