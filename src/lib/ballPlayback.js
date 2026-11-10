/** Pure clock-aware playback state, shared by the website and offline export. */
export function createPlayback(durations, index = 0, loop = false, now = Date.now()) {
  const safe = durations.map(s => Math.max(1, Math.min(600, Number(s) || 8)) * 1000);
  const current = Math.max(0, Math.min(safe.length - 1, Math.trunc(index) || 0));
  return { durations: safe, index: current, loop, playing: false, blackout: false, remaining: safe[current], at: now, visit: 0 };
}
export function remainingTime(state, now = Date.now()) {
  return Math.max(0, state.remaining - (state.playing && !state.blackout ? Math.max(0, now - state.at) : 0));
}
export function playbackAction(state, action, now = Date.now()) {
  const next = { ...state, remaining: remainingTime(state, now), at: now };
  const go = target => {
    if (!Number.isFinite(target)) return state;
    next.index = Math.max(0, Math.min(state.durations.length - 1, Math.trunc(target)));
    next.remaining = state.durations[next.index]; next.visit++;
    return next;
  };
  switch (action.type) {
    case 'next':
    case 'tick':
      if (action.type === 'tick' && (!state.playing || state.blackout || next.remaining > 1)) return state;
      if (state.index === state.durations.length - 1) {
        if (state.loop) return go(0);
        return { ...next, playing: false, remaining: action.type === 'tick' ? 0 : next.remaining };
      }
      return go(state.index + 1);
    case 'previous': return go(state.index - 1);
    case 'goto': return go(action.index);
    case 'restart': return go(0);
    case 'play': if (next.remaining <= 0) next.remaining = state.durations[state.index]; return { ...next, playing: true };
    case 'pause': return { ...next, playing: false };
    case 'toggle-play': if (!state.playing && next.remaining <= 0) next.remaining = state.durations[state.index]; return { ...next, playing: !state.playing };
    case 'blackout': return { ...next, blackout: !state.blackout };
    case 'loop': return { ...next, loop: !state.loop };
    default: return state;
  }
}
export function validateRemoteCommand(message, total) {
  if (!message || typeof message.id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(message.id)) return null;
  if (!['next','previous','goto','restart','play','pause','blackout','loop'].includes(message.action)) return null;
  if (message.action === 'goto' && (!Number.isInteger(message.index) || message.index < 0 || message.index >= total)) return null;
  return { type: message.action, ...(message.action === 'goto' ? {index:message.index} : {}) };
}
export function createCommandReceiver(getTotal, apply) {
  const seen = new Set();
  return message => {
    const action = validateRemoteCommand(message, getTotal());
    if (!action) return false;
    if (!seen.has(message.id)) {
      seen.add(message.id);
      if (seen.size > 500) seen.delete(seen.values().next().value);
      apply(action);
    }
    return true;
  };
}
