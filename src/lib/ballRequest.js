// Every public Ball API resolves to {data} or {error}; callers can reliably
// leave their busy state even when a request throws or returns invalid JSON.
export function createBallRequest(invoke, readError) {
  return async (name, body, fallback) => {
    try {
      const { data, error } = await invoke(name, { body, timeout: 30000 });
      if (error || data?.error) {
        return { error: await readError(data, error, fallback) };
      }
      if (!data || typeof data !== "object") {
        return {
          error:
            `${fallback} The server returned an incomplete response. Please retry.`,
        };
      }
      return { data };
    } catch {
      const writing =
        ["ball-submit-signup", "ball-submit-vip-signup", "ball-guest-verify"]
          .includes(name) && body.peek !== true;
      return {
        error: writing
          ? "Could not confirm the submission. Check your connection and retry; a response may have been lost."
          : `${fallback} Check your connection and try again.`,
      };
    }
  };
}
