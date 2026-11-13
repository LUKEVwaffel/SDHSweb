// Serialize refreshes. A refresh requested after a write must fetch AFTER any
// older in-flight read, rather than treating that old read as the saved result.
export function createRefreshQueue(fetchState, apply, fail, getEpoch = () => 0, timeoutMs = 10000) {
  let active = null;
  let controller = null;
  async function refresh(force = false) {
    if (active) {
      await active;
      if (!force) return;
      if (active) return active;
    }
    const epoch = getEpoch();
    const aborter = new AbortController();
    controller = aborter;
    const timeout = setTimeout(() => aborter.abort(), timeoutMs);
    const request = Promise.resolve().then(async () => {
      try {
        const state = await fetchState(aborter.signal);
        if (epoch === getEpoch()) apply(state);
      } catch (error) {
        if (epoch === getEpoch()) fail(aborter.signal.aborted ? new Error('The connection timed out. Reconnecting…') : error);
      } finally {
        clearTimeout(timeout);
        if (active === request) { active = null; controller = null; }
      }
    });
    active = request;
    return request;
  }
  return { refresh, abort: () => controller?.abort() };
}
