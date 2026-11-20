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
  if (!['next','previous','goto','restart','play','pause','blackout','loop','start-show','start-dinner','end-dinner'].includes(message.action)) return null;
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

// Keep preview pointed at a real slide when the editor adds or deletes slides.
export function reconcilePlaybackSlides(state, slides, loop = false) {
  const ids=slides.map(s=>s.id);
  const durations=slides.map(s=>Math.max(1,Math.min(600,Number(s.duration)||8))*1000);
  if(state.slideIds?.length===ids.length&&ids.every((id,i)=>state.slideIds[i]===id&&state.durations[i]===durations[i])&&state.loop===loop)return state;
  const currentId=state.slideIds?.[state.index];
  const retainedIndex=ids.indexOf(currentId);
  const index=retainedIndex>=0?retainedIndex:Math.min(state.index,slides.length-1);
  return {...createPlayback(slides.map(s=>s.duration),index,loop),slideIds:ids,blackout:state.blackout,visit:state.visit+1};
}

// A configured show loops the preshow until the ceremony clock takes over.
export function resolveBallShow(deck) {
  const { show, slides } = deck;
  const startAt = Date.parse(show?.startAt);
  const podium = slides.findIndex(slide => slide.id === show?.podiumId);
  const welcome = slides.findIndex(slide => slide.id === show?.welcomeId);
  if (!Number.isFinite(startAt) || podium < 1 || welcome !== podium + 1) return null;
  const podiumSeconds = Math.max(1, Math.min(600, Number(slides[podium].duration) || 120));
  const preshowAt = Date.parse(show.preshowAt);
  const featured = Array.isArray(show.featuredIds)
    ? [...new Set(show.featuredIds.map(id => slides.findIndex(slide => slide.id === id)))].filter(index => index > 0 && index < podium)
    : [];
  const preshow = Array.isArray(show.preshowIds)
    ? [...new Set(show.preshowIds.map(id => slides.findIndex(slide => slide.id === id)))].filter(index => index >= 0 && index < podium)
    : null;
  const dinner = slides.findIndex(slide => slide.id === show.dinnerId);
  const dinnerPhotos = dinner > welcome
    ? slides.slice(0, podium).flatMap((slide, index) => slide.layout === 'photo' && slide.photos.some(Boolean) ? [index] : [])
    : [];
  const afterWelcome = ids => Array.isArray(ids)
    ? [...new Set(ids.map(id => slides.findIndex(slide => slide.id === id)))].filter(index => index > welcome)
    : [];
  const grog = afterWelcome(show.grogIds);
  const toasts = afterWelcome(show.toastIds);
  const seniors = afterWelcome(show.seniorIds);
  return {
    startAt, podium, welcome, welcomeAt: startAt + podiumSeconds * 1000,
    ...(dinnerPhotos.length ? { dinner, dinnerPhotos } : {}),
    ...(grog.length ? { grog } : {}),
    ...(toasts.length ? { toasts } : {}),
    ...(seniors.length ? { seniors } : {}),
    ...(preshow ? { preshow: preshow.length ? preshow : [0] } : {}),
    ...(Number.isFinite(preshowAt) && preshowAt < startAt ? { preshowAt } : {}),
    ...(featured.length ? { featured } : {}),
  };
}

export function ballShowCues(show, slideCount) {
  return [
    show.welcome,
    ...Array.from({ length: slideCount - show.welcome - 1 }, (_, i) => show.welcome + i + 1),
    ...(show.featured ?? []),
  ];
}

export function ballPreshowSlides(show) {
  return show.preshow ?? Array.from({ length: show.podium }, (_, index) => index);
}

export function nextPreshowSlide(show, index, direction = 1) {
  return nextInRotation(ballPreshowSlides(show), index, direction);
}

function nextInRotation(rotation, index, direction) {
  const position = rotation.indexOf(index);
  if (position === -1) return rotation[0];
  return rotation[(position + direction + rotation.length) % rotation.length];
}

export function nextDinnerSlide(show, index, direction = 1) {
  return nextInRotation(show.dinnerPhotos, index, direction);
}

export function startBallShow(state, show, now = Date.now()) {
  const first = playbackAction(state, { type: 'goto', index: 0 }, now);
  if (now < show.preshowAt) return { ...first, playing: false, showPhase: 'waiting' };
  // Opening late joins the rotation at the slide scheduled for this wall-clock time.
  let elapsed = show.preshowAt ? Math.max(0, now - show.preshowAt) : 0;
  const rotation = ballPreshowSlides(show);
  const loop = rotation.map(index => first.durations[index]);
  elapsed %= loop.reduce((sum, duration) => sum + duration, 0);
  const position = loop.findIndex(duration => {
    if (elapsed < duration) return true;
    elapsed -= duration;
    return false;
  });
  return ballShowAction({
    ...first, index: rotation[position], remaining: loop[position] - elapsed, playing: true, showPhase: 'preshow',
  }, { type: 'tick' }, show, now);
}

export function isBallScheduleActive(state) {
  return ['waiting', 'preshow', 'podium'].includes(state.showPhase);
}

export function ballScheduleTime(timestamp) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  }).format(timestamp) + ' Eastern';
}

export function ballShowAction(state, action, show, now = Date.now(), protectSchedule = false) {
  if (!show) return playbackAction(state, action, now);
  if (protectSchedule) {
    if (isBallScheduleActive(state) && !['tick', 'blackout'].includes(action.type)) return state;
    if (action.type === 'start-show') return state;
    if (state.showPhase !== 'dinner' && ['play', 'pause', 'toggle-play', 'loop'].includes(action.type)) return state;
  }
  if (action.type === 'start-show') return startBallShow(state, show, now);
  if (action.type === 'start-dinner' && show.dinnerPhotos) {
    return { ...playbackAction(state, { type: 'goto', index: show.dinnerPhotos[0] }, now), playing: true, showPhase: 'dinner' };
  }
  if (state.showPhase === 'dinner') {
    if (action.type === 'goto' || action.type === 'end-dinner') {
      const index = action.type === 'goto' ? action.index : show.dinner;
      return { ...playbackAction(state, { type: 'goto', index }, now), playing: false, showPhase: null };
    }
    if (action.type === 'restart') return playbackAction(state, { type: 'goto', index: show.dinnerPhotos[0] }, now);
    if (action.type === 'next' || action.type === 'previous'
      || (action.type === 'tick' && state.playing && !state.blackout && remainingTime(state, now) <= 1)) {
      const index = nextDinnerSlide(show, state.index, action.type === 'previous' ? -1 : 1);
      return playbackAction(state, { type: 'goto', index }, now);
    }
    return playbackAction(state, action, now);
  }
  if (!state.showPhase) {
    if (state.index >= show.podium && ['play', 'toggle-play', 'loop'].includes(action.type)) return state;
    const next = playbackAction(state, action, now);
    return next.playing && next.index >= show.podium ? { ...next, playing: false } : next;
  }

  // An explicit jump is a manual takeover. The clock must leave that cue on screen.
  if (action.type === 'goto') {
    const manual = playbackAction(state, action, now);
    return { ...manual, playing: false, showPhase: null };
  }
  if (state.showPhase === 'waiting') {
    if (action.type === 'tick' && now >= show.preshowAt) return startBallShow(state, show, now);
    return action.type === 'blackout' ? playbackAction(state, action, now) : state;
  }
  if (action.type === 'tick') {
    if (now >= show.welcomeAt) {
      return { ...playbackAction(state, { type: 'goto', index: show.welcome }, now), playing: false, showPhase: null };
    }
    if (now >= show.startAt) {
      if (state.showPhase === 'podium') return state;
      return { ...playbackAction(state, { type: 'goto', index: show.podium }, now), playing: false, showPhase: 'podium' };
    }
  }
  if (state.showPhase === 'podium') return action.type === 'blackout' ? playbackAction(state, action, now) : state;
  if (action.type === 'restart' && show.preshow) return playbackAction(state, { type: 'goto', index: show.preshow[0] }, now);
  if (action.type === 'next' || (action.type === 'previous' && show.preshow)
    || (action.type === 'tick' && state.playing && !state.blackout && remainingTime(state, now) <= 1)) {
    const index = nextPreshowSlide(show, state.index, action.type === 'previous' ? -1 : 1);
    return playbackAction(state, { type: 'goto', index }, now);
  }
  return playbackAction(state, action, now);
}

export function nextPlaybackWake(state, show, now = Date.now()) {
  const slide = state.playing && !state.blackout ? remainingTime(state, now) : Infinity;
  if (!show || !state.showPhase || state.showPhase === 'dinner') return slide;
  const deadlines = { waiting: show.preshowAt, preshow: show.startAt, podium: show.welcomeAt };
  return Math.min(slide, deadlines[state.showPhase] - now);
}

export function ballCountdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}`
    : `${minutes}:${rest}`;
}
