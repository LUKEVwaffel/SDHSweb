import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import AdminGate from './AdminGate';
import { useOpticPhotos, useOpticSubEvents } from '../../hooks/useOpticPhotos';
import { useOpticConfig } from '../../hooks/useOpticConfig';
import { OPTIC_EVENT_TITLE, chunkIds, backfillGridThumbs } from '../../lib/opticComp';
import { removePhotoFiles } from '../../lib/photoStorage';
import { installPwaHooks, isStandalone, isIos } from './pwa';
import { usePwaUpdate, PwaUpdateBar } from './usePwaUpdate';
import { Albums, AlbumJump, groupByEvent, groupByTeam, matchesTeam, albumAnchor, TEAM_FILTERS } from './PwaAlbums';
import { PhotoViewer } from './PwaPhotoViewer';
import './lukepwa.css';

const TEAMS = [
  { id: 'male', label: 'MALE' },
  { id: 'coed', label: 'COED' },
  { id: 'both', label: 'BOTH' },
];
const TABS = ['tag', 'parents', 'subs'];

// The stations every Raider comp runs, in running order. Both teams do all
// of them, so each is team 'both'. Added with one tap from EVENTS, and
// automatically when switching to a comp that has no sub-events yet.
const STANDARD_EVENTS = ['Team Run', 'CCR', 'PTT', 'One Rope', 'Gauntlet', 'Obstacle Course'];
const normName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Insert whichever standard events `eventId` doesn't have yet. One at a time
 * so created_at keeps them in running order (albums follow that order).
 * @returns {Promise<{added:number, error:object|null}>}
 */
async function addStandardEvents(eventId, existingNames, createdBy) {
  const have = new Set(existingNames.map(normName));
  let added = 0;
  for (const name of STANDARD_EVENTS) {
    if (have.has(normName(name))) continue;
    // eslint-disable-next-line no-await-in-loop
    const { error } = await SB.from('raider_sub_events')
      .insert({ event_id: eventId, name, team: 'both', created_by: createdBy || null });
    if (error) return { added, error };
    added += 1;
  }
  return { added, error: null };
}
const PARENT_SEEN_KEY = 'optic_pwa_parent_seen';
const TILE_SIZE_KEY = 'optic_pwa_tile_size';

// Last session's photo list, kept on the phone so opening the console paints
// the albums instantly (from rows + already-cached images) instead of
// waiting on auth -> config -> photos before the first tile can even start
// downloading. The live list replaces it a moment later, and realtime keeps
// it current from there.
const CACHE_KEY = 'optic_pwa_cache_v1';
const CACHE_MAX = 1500;
const CACHE_WRITE_MS = 1200;
function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c && c.eventId && Array.isArray(c.photos) ? c : null;
  } catch { return null; }
}
function writeCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* quota / private mode */ }
}

// Open the connections to the photo + API origins while auth is still
// resolving, so the first requests skip DNS + TLS.
const PRECONNECT = [import.meta.env.VITE_OPTIC_R2_URL, import.meta.env.VITE_SUPABASE_URL]
  .map((u) => { try { return new URL(u).origin; } catch { return null; } })
  .filter(Boolean);
function preconnect() {
  for (const origin of PRECONNECT) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) continue;
    const l = document.createElement('link');
    l.rel = 'preconnect'; l.href = origin; l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
}
const TILE_SIZES = ['s', 'm', 'l'];
const readTileSize = () => {
  try { const v = localStorage.getItem(TILE_SIZE_KEY); return TILE_SIZES.includes(v) ? v : 'm'; } catch { return 'm'; }
};

// Android gives real haptics; iOS Safari ignores vibrate() harmlessly. Cheap
// win for how physical the console feels on a phone.
const haptic = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

// ── /lukepwa , OPTIC command console. Luke's homebase for the 12h day: every
// tap answers instantly, selection feels physical, publishing commits with a
// visible pulse. All curation / tagging / moderation happens here, from a
// phone, and nothing in this file can reach the parent or cadet UIs.
export default function LukePwaRoute() {
  useEffect(() => { installPwaHooks(); preconnect(); }, []);
  return (
    <AdminGate label="OPTIC · CURATION" remember>
      <LukePwa />
    </AdminGate>
  );
}

function LukePwa() {
  const [cache] = useState(readCache);
  const config = useOpticConfig();
  // Until optic_config answers, assume the comp hasn't changed since last
  // time so photos start loading in parallel with the config read. If it
  // has, eventId flips and the hook drops the seeded rows.
  const eventId = config.loading ? (config.eventId || cache?.eventId || null) : config.eventId;
  const eventTitle = config.eventTitle || (config.loading ? cache?.eventTitle : null);
  const seeded = cache && cache.eventId === eventId ? cache : null;
  const { photos, loading, error, refresh } = useOpticPhotos({
    eventId, scope: 'all', initialPhotos: seeded?.photos,
  });
  const { subEvents, refresh: refreshSubs } = useOpticSubEvents({
    eventId, initialSubEvents: seeded?.subEvents,
  });

  useEffect(() => {
    if (loading || !eventId || config.loading) return undefined;
    const t = setTimeout(() => writeCache({
      eventId, eventTitle, subEvents, photos: photos.slice(0, CACHE_MAX), at: Date.now(),
    }), CACHE_WRITE_MS);
    return () => clearTimeout(t);
  }, [photos, subEvents, eventId, eventTitle, loading, config.loading]);

  const [tab, setTab] = useState('tag');
  const [filter, setFilter] = useState('all'); // all | untagged | staged | live
  const [team, setTeam] = useState('all');     // all | male | coed | both, same rule as the parent feed
  const [collapsed, setCollapsed] = useState(() => new Set()); // `${tab}:${albumId}`
  const [viewer, setViewer] = useState(null);  // photo id open full screen, or null
  const [tileSize, setTileSize] = useState(readTileSize);
  const [scrollTo, setScrollTo] = useState(null); // album id to bring into view after render
  const [sel, setSel] = useState(() => new Set());
  const [pSel, setPSel] = useState(() => new Set()); // PARENTS-tab selection (separate from `sel`)
  const [actionErr, setActionErr] = useState('');
  const [overrides, setOverrides] = useState({});      // optimistic patch overlay
  const [pulseIds, setPulseIds] = useState(() => new Set()); // tiles flashing "changed"
  const [bump, setBump] = useState({});                // tab counts that just grew
  const [seenAt, setSeenAt] = useState(() => Number(localStorage.getItem(PARENT_SEEN_KEY) || 0));

  const email = useRef(null);
  const flashTimers = useRef({});
  const prevCounts = useRef({ luke: 0, parent: 0, subs: 0 });
  const updateReady = usePwaUpdate();

  useEffect(() => {
    SB.auth.getSession().then(({ data }) => { email.current = data.session?.user?.email || null; });
  }, []);

  // A fresh photos array from realtime/refetch is server truth , drop the
  // optimistic overlay so the two can't drift.
  useEffect(() => { setOverrides({}); }, [photos]);

  const merged = useMemo(
    () => photos.map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p)),
    [photos, overrides],
  );
  const lukePhotos = useMemo(
    () => merged.filter((p) => p.source === 'luke')
      .sort((a, b) => (a.visibility === b.visibility ? 0 : a.visibility === 'staged' ? -1 : 1)),
    [merged],
  );
  const parentPhotos = useMemo(() => merged.filter((p) => p.source === 'parent'), [merged]);
  const visibleParentIds = useMemo(
    () => parentPhotos.filter((p) => p.status !== 'hidden').map((p) => p.id),
    [parentPhotos],
  );
  const stagedIds = useMemo(
    () => lukePhotos.filter((p) => p.visibility === 'staged').map((p) => p.id),
    [lukePhotos],
  );
  const liveCount = lukePhotos.length - stagedIds.length;
  const untaggedCount = useMemo(
    () => lukePhotos.filter((p) => !p.raider_team && !p.sub_event_id).length,
    [lukePhotos],
  );

  // The photos actually shown in the Tagging albums, after status + team.
  const shown = useMemo(() => {
    let list = lukePhotos;
    if (filter === 'untagged') list = list.filter((p) => !p.raider_team && !p.sub_event_id);
    else if (filter === 'staged') list = list.filter((p) => p.visibility === 'staged');
    else if (filter === 'live') list = list.filter((p) => p.visibility === 'public');
    if (team !== 'all') list = list.filter((p) => matchesTeam(p, team));
    return list;
  }, [lukePhotos, filter, team]);
  const parentShown = useMemo(
    () => (team === 'all' ? parentPhotos : parentPhotos.filter((p) => matchesTeam(p, team))),
    [parentPhotos, team],
  );
  const tagGroups = useMemo(() => groupByEvent(shown, subEvents), [shown, subEvents]);
  const parentGroups = useMemo(() => groupByTeam(parentShown), [parentShown]);
  const teamCounts = useMemo(() => {
    const src = tab === 'parents' ? parentPhotos : lukePhotos;
    return {
      all: src.length,
      male: src.filter((p) => matchesTeam(p, 'male')).length,
      coed: src.filter((p) => matchesTeam(p, 'coed')).length,
      both: src.filter((p) => matchesTeam(p, 'both')).length,
    };
  }, [tab, parentPhotos, lukePhotos]);
  const newParentCount = useMemo(
    () => parentPhotos.filter((p) => new Date(p.created_at).getTime() > seenAt).length,
    [parentPhotos, seenAt],
  );
  const subCounts = useMemo(() => {
    const m = {};
    for (const p of merged) if (p.sub_event_id) m[p.sub_event_id] = (m[p.sub_event_id] || 0) + 1;
    return m;
  }, [merged]);

  // Bump a tab's count when it grows (new dump / new parent photo / new sub-event).
  useEffect(() => {
    const cur = { luke: lukePhotos.length, parent: parentPhotos.length, subs: subEvents.length };
    const grew = {};
    for (const k of ['luke', 'parent', 'subs']) {
      if (cur[k] > prevCounts.current[k]) grew[k] = true;
    }
    prevCounts.current = cur;
    if (Object.keys(grew).length) {
      setBump(grew);
      const t = setTimeout(() => setBump({}), 340);
      return () => clearTimeout(t);
    }
  }, [lukePhotos.length, parentPhotos.length, subEvents.length]);

  const flash = useCallback((ids) => {
    setPulseIds((s) => { const n = new Set(s); ids.forEach((i) => n.add(i)); return n; });
    ids.forEach((i) => {
      clearTimeout(flashTimers.current[i]);
      flashTimers.current[i] = setTimeout(() => {
        setPulseIds((s) => { const n = new Set(s); n.delete(i); return n; });
      }, 660);
    });
  }, []);

  // Drop selected ids that no longer exist (deleted, or realtime removed them).
  useEffect(() => {
    setSel((s) => {
      if (!s.size) return s;
      const valid = new Set(lukePhotos.map((p) => p.id));
      const n = new Set([...s].filter((id) => valid.has(id)));
      return n.size === s.size ? s : n;
    });
  }, [lukePhotos]);

  useEffect(() => {
    setPSel((s) => {
      if (!s.size) return s;
      const valid = new Set(parentPhotos.map((p) => p.id));
      const n = new Set([...s].filter((id) => valid.has(id)));
      return n.size === s.size ? s : n;
    });
  }, [parentPhotos]);

  const toggleSel = useCallback((id) => {
    haptic(9);
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const clearSel = useCallback(() => setSel(new Set()), []);
  const selectAllShown = useCallback(() => { haptic(14); setSel(new Set(shown.map((p) => p.id))); }, [shown]);
  const selectMany = useCallback((setter) => (ids, on) => {
    setter((s) => { const n = new Set(s); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; });
  }, []);

  const togglePSel = useCallback((id) => {
    haptic(9);
    setPSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const clearPSel = useCallback(() => setPSel(new Set()), []);
  const selectAllParents = useCallback(
    () => { haptic(14); setPSel(new Set(visibleParentIds)); },
    [visibleParentIds],
  );

  const go = useCallback((t) => { haptic(9); setTab(t); }, []);
  const toggleCollapse = useCallback((key) => {
    haptic(8);
    setCollapsed((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }, []);
  // Open an album: make sure it's expanded and on screen. Used by the jump
  // chips and by tapping a sub-event row in EVENTS.
  const jumpToAlbum = useCallback((t, albumId) => {
    setCollapsed((c) => { const n = new Set(c); n.delete(`${t}:${albumId}`); return n; });
    setScrollTo(albumId);
  }, []);
  const jumpToSub = useCallback((subId) => {
    haptic(9); setFilter('all'); setTeam('all'); setTab('tag'); jumpToAlbum('tag', subId);
  }, [jumpToAlbum]);
  useEffect(() => {
    if (!scrollTo) return;
    const el = document.getElementById(albumAnchor(scrollTo));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollTo(null);
  }, [scrollTo, tab]);
  const pickTileSize = useCallback((v) => {
    haptic(8); setTileSize(v);
    try { localStorage.setItem(TILE_SIZE_KEY, v); } catch { /* private mode */ }
  }, []);
  const openParents = useCallback(() => {
    haptic(9);
    setTab('parents');
    const now = Date.now();
    localStorage.setItem(PARENT_SEEN_KEY, String(now));
    setSeenAt(now);
  }, []);

  async function applyPatch(patch, ids) {
    const list = [...ids];
    if (!list.length) return;
    setActionErr('');
    haptic(12);
    setOverrides((o) => {
      const n = { ...o };
      list.forEach((id) => { n[id] = { ...(n[id] || {}), ...patch }; });
      return n;
    });
    flash(list);
    let e = null;
    for (const part of chunkIds(list)) {
      // eslint-disable-next-line no-await-in-loop
      ({ error: e } = await SB.from('photos').update(patch).in('id', part));
      if (e) break;
    }
    if (e) {
      setActionErr(e.message || 'Update failed. Check signal and tap again.');
      setOverrides((o) => { const n = { ...o }; list.forEach((id) => delete n[id]); return n; });
      haptic([8, 40, 8]);
      refresh(); // earlier chunks may have landed; show the real state
      return;
    }
    refresh();
  }

  async function hardDelete(photo) {
    if (!window.confirm('Permanently delete this photo? The file is removed for good.')) return;
    setActionErr('');
    haptic([10, 40, 10]);
    // File removal is best-effort, same as before: an orphaned file is
    // harmless, a row left pointing at a deleted file is not.
    await removePhotoFiles([photo]).catch(() => {});
    const { error: e } = await SB.from('photos').delete().eq('id', photo.id);
    if (e) { setActionErr(e.message || 'Delete failed. Tap again.'); return; }
    setSel((s) => { const n = new Set(s); n.delete(photo.id); return n; });
    refresh();
  }

  // Permanently delete every selected photo , storage objects and rows. No
  // undo; used from the bulk drawer for bad frames / dupes.
  async function bulkDelete() {
    const list = [...sel];
    if (!list.length) return;
    if (!window.confirm(`Permanently delete ${list.length} photo${list.length === 1 ? '' : 's'}? The files are removed for good, no undo.`)) return;
    setActionErr('');
    haptic([10, 40, 10]);
    const targets = merged.filter((p) => sel.has(p.id));
    await removePhotoFiles(targets).catch(() => {});
    let e = null;
    for (const part of chunkIds(list)) {
      // eslint-disable-next-line no-await-in-loop
      ({ error: e } = await SB.from('photos').delete().in('id', part));
      if (e) break;
    }
    if (e) { setActionErr(e.message || 'Delete failed. Check signal and tap again.'); refresh(); return; }
    clearSel();
    refresh();
  }

  // Soft-hide (status='hidden', reversible, file stays in storage) every
  // selected parent photo. Same optimistic path as tagging via applyPatch.
  function bulkHideParents() {
    if (!pSel.size) return;
    applyPatch({ status: 'hidden' }, pSel);
    clearPSel();
  }

  // Panic button: soft-hide every parent photo that's currently public. One
  // confirm tap, then it fires. Individual tiles can be unhidden afterward.
  function hideAllParents() {
    const ids = visibleParentIds;
    if (!ids.length) return;
    if (!window.confirm(`Hide all ${ids.length} visible parent photo${ids.length === 1 ? '' : 's'}? They stay recoverable , unhide any from its tile.`)) return;
    haptic([10, 40, 10]);
    applyPatch({ status: 'hidden' }, ids);
    clearPSel();
  }

  // Photos from before grid thumbs existed. Only offered once the column is
  // there (rows carry a grid_url key, even if null).
  const hasGridColumn = photos.length > 0 && 'grid_url' in photos[0];
  const missingGrid = useMemo(
    () => (hasGridColumn ? merged.filter((p) => !p.grid_url && p.storage_path) : []),
    [merged, hasGridColumn],
  );
  const [speed, setSpeed] = useState(null); // null | { done, total } | { msg }
  async function speedUp() {
    if (!missingGrid.length || (speed && !speed.msg)) return;
    haptic(14);
    setSpeed({ done: 0, total: missingGrid.length });
    const r = await backfillGridThumbs(missingGrid, (done, total) => setSpeed({ done, total }));
    haptic([10, 30, 10]);
    setSpeed({
      msg: r.blocked
        || `${r.done} PHOTO${r.done === 1 ? '' : 'S'} SPED UP${r.failed ? ` · ${r.failed} SKIPPED` : ''}`,
    });
    refresh();
  }

  // Blur saved: show the blurred copy right away (the row write already
  // landed), then let the refetch confirm it.
  function onBlurred(photo, { patch, cleanupFailed }) {
    setOverrides((o) => ({ ...o, [photo.id]: { ...(o[photo.id] || {}), ...patch } }));
    flash([photo.id]);
    if (cleanupFailed) {
      setActionErr('Blurred and replaced, but the old unblurred file could not be deleted from storage. Sign out and back in, then tell Luke/S6.');
    }
    refresh();
  }

  const collapsedFor = useCallback(
    (t) => new Set([...collapsed].filter((k) => k.startsWith(`${t}:`)).map((k) => k.slice(t.length + 1))),
    [collapsed],
  );
  const tagCollapsed = useMemo(() => collapsedFor('tag'), [collapsedFor]);
  const parentCollapsed = useMemo(() => collapsedFor('parents'), [collapsedFor]);

  // The viewer swipes through exactly what the open tab shows, album order.
  const viewerGroups = tab === 'parents' ? parentGroups : tagGroups;
  const viewerList = useMemo(() => viewerGroups.flatMap((g) => g.photos), [viewerGroups]);
  const groupNameOf = useMemo(() => {
    const m = new Map();
    for (const g of viewerGroups) for (const p of g.photos) m.set(p.id, g.name);
    return (p) => m.get(p.id);
  }, [viewerGroups]);
  const closeViewer = useCallback(() => setViewer(null), []);

  function viewerActions(p) {
    if (p.source === 'parent') {
      const hidden = p.status === 'hidden';
      return [
        { label: pSel.has(p.id) ? '✓ SELECTED' : 'SELECT', on: pSel.has(p.id), onClick: () => togglePSel(p.id) },
        { label: hidden ? 'UNHIDE' : 'HIDE', onClick: () => applyPatch({ status: hidden ? 'live' : 'hidden' }, [p.id]) },
        { label: 'DELETE', danger: true, onClick: () => hardDelete(p) },
      ];
    }
    const live = p.visibility === 'public';
    return [
      { label: sel.has(p.id) ? '✓ SELECTED' : 'SELECT', on: sel.has(p.id), onClick: () => toggleSel(p.id) },
      { label: live ? 'UNPUBLISH' : 'PUBLISH', onClick: () => applyPatch({ visibility: live ? 'staged' : 'public' }, [p.id]) },
      { label: 'DELETE', danger: true, onClick: () => hardDelete(p) },
    ];
  }

  const drawerOpen = sel.size > 0 && tab === 'tag' && !viewer;
  const tabIndex = TABS.indexOf(tab);

  return (
    <div className="lp" data-drawer={drawerOpen} data-size={tileSize}>
      <header className="lp-head">
        <div>
          <div className="lp-kicker">DISPATCH · OPTIC</div>
          <div className="lp-title">{(eventTitle || OPTIC_EVENT_TITLE).toUpperCase()}</div>
        </div>
        <div className="lp-sync">
          <span className="lp-dot" data-stale={!!error} />
          {error ? 'OFFLINE' : loading ? 'SYNC' : 'LIVE'}
        </div>
      </header>

      {!isStandalone() && <InstallStrip />}

      {!eventId && (
        <div className="lp-banner">
          NO ACTIVE EVENT. Set optic_config.active_event_id or nothing here is live. Old comps stay untouched.
        </div>
      )}

      <CompControl eventId={eventId} eventTitle={eventTitle} />
      <GateControl />

      <nav className="lp-tabs">
        <button className="lp-tab" data-active={tab === 'tag'} onClick={() => go('tag')}>
          TAGGING <Count n={lukePhotos.length} bump={bump.luke} />
        </button>
        <button className="lp-tab" data-active={tab === 'parents'} onClick={openParents}>
          PARENTS <Count n={parentPhotos.length} bump={bump.parent} />
          {newParentCount > 0 && <span className="lp-tabbadge">{newParentCount}</span>}
        </button>
        <button className="lp-tab" data-active={tab === 'subs'} onClick={() => go('subs')}>
          EVENTS <Count n={subEvents.length} bump={bump.subs} />
        </button>
        <span className="lp-tab-ind" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
      </nav>

      {error && <div className="lp-banner">FEED ERROR: {error}</div>}
      {actionErr && (
        <div className="lp-banner">
          <span style={{ flex: 1 }}>{actionErr}</span>
          <button onClick={() => setActionErr('')} aria-label="Dismiss">×</button>
        </div>
      )}

      {loading && <LoadingGrid />}

      {!loading && tab !== 'subs' && (
        <div className="lp-toolbar">
          <div className="lp-seg lp-seg--team" role="group" aria-label="Team">
            {TEAM_FILTERS.map((t) => (
              <button
                key={t.id}
                data-on={team === t.id}
                aria-pressed={team === t.id}
                onClick={() => { haptic(8); setTeam(t.id); }}
              >
                {t.label}<span className="n">{teamCounts[t.id]}</span>
              </button>
            ))}
          </div>
          <div className="lp-seg lp-seg--mini" role="group" aria-label="Tile size">
            {TILE_SIZES.map((v) => (
              <button key={v} data-on={tileSize === v} aria-pressed={tileSize === v} onClick={() => pickTileSize(v)}>
                <span className="lp-sizeicon" data-v={v} aria-hidden="true" />
                <span className="lp-sr">{v === 's' ? 'Small' : v === 'm' ? 'Medium' : 'Large'} tiles</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && tab !== 'subs' && (missingGrid.length > 0 || speed) && (
        <div className="lp-speed">
          {speed && !speed.msg ? (
            <>
              <span>SPEEDING UP · {speed.done}/{speed.total}</span>
              <span className="lp-speed-bar"><i style={{ width: `${(speed.done / speed.total) * 100}%` }} /></span>
            </>
          ) : speed?.msg ? (
            <>
              <span style={{ flex: 1 }}>{speed.msg}</span>
              <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={() => setSpeed(null)}>OK</button>
            </>
          ) : (
            <>
              <span style={{ flex: 1 }}>{missingGrid.length} older photo{missingGrid.length === 1 ? '' : 's'} load slowly in the grid.</span>
              <button className="lp-btn lp-btn--sm" onClick={speedUp}>⚡ SPEED UP</button>
            </>
          )}
        </div>
      )}

      {!loading && tab === 'tag' && (
        <div className="lp-panel" key="tag">
          <div className="lp-strip">
            <span><b>{stagedIds.length}</b> STAGED</span>
            <span><b>{liveCount}</b> LIVE</span>
            <span><b>{untaggedCount}</b> UNTAGGED</span>
          </div>

          <div className="lp-filter">
            <FilterChip id="all" cur={filter} set={setFilter} n={lukePhotos.length}>ALL</FilterChip>
            <FilterChip id="untagged" cur={filter} set={setFilter} n={untaggedCount}>UNTAGGED</FilterChip>
            <FilterChip id="staged" cur={filter} set={setFilter} n={stagedIds.length}>STAGED</FilterChip>
            <FilterChip id="live" cur={filter} set={setFilter} n={liveCount}>LIVE</FilterChip>
          </div>

          <AlbumJump groups={tagGroups} onJump={(id) => jumpToAlbum('tag', id)} />

          <div className="lp-strip" style={{ paddingTop: 8 }}>
            <span>{shown.length} SHOWN{sel.size > 0 ? ` · ${sel.size} SELECTED` : ' · HOLD TO SELECT'}</span>
            {shown.length > 0 && (
              <button
                className="lp-btn lp-btn--ghost lp-btn--sm"
                style={{ marginLeft: 'auto' }}
                onClick={selectAllShown}
              >
                SELECT ALL {shown.length}
              </button>
            )}
            {sel.size > 0 && (
              <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={clearSel}>CLEAR</button>
            )}
          </div>

          <Albums
            groups={tagGroups}
            sel={sel}
            pulseIds={pulseIds}
            collapsed={tagCollapsed}
            onToggleCollapse={(id) => toggleCollapse(`tag:${id}`)}
            onToggleSel={toggleSel}
            onSelectMany={selectMany(setSel)}
            onOpen={setViewer}
            source="luke"
            emptyNode={lukePhotos.length ? (
              <Empty k="NOTHING HERE">No photos match this filter. Tap ALL and ALL TEAMS to see the full set.</Empty>
            ) : (
              <Empty k="STANDING BY">
                No dump yet. Photos from the SD-card tool appear here the moment they finish uploading.
              </Empty>
            )}
          />
        </div>
      )}

      {!loading && tab === 'parents' && (
        <div className="lp-panel" key="parents">
          <div className="lp-strip">
            <span>
              {parentShown.length} PARENT PHOTO{parentShown.length === 1 ? '' : 'S'}
              {pSel.size > 0 ? ` · ${pSel.size} SELECTED` : ' · HOLD TO SELECT'}
            </span>
            {visibleParentIds.length > 0 && (
              <button
                className="lp-btn lp-btn--ghost lp-btn--sm"
                style={{ marginLeft: 'auto' }}
                onClick={selectAllParents}
              >
                SELECT ALL {visibleParentIds.length}
              </button>
            )}
            {pSel.size > 0 && (
              <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={clearPSel}>CLEAR</button>
            )}
          </div>

          <div className="lp-strip" style={{ paddingTop: 8, gap: 6, flexWrap: 'wrap' }}>
            <button
              className="lp-btn lp-btn--sm"
              disabled={pSel.size === 0}
              onClick={bulkHideParents}
            >
              {pSel.size ? `HIDE ${pSel.size} SELECTED` : 'HIDE SELECTED'}
            </button>
            <button
              className="lp-btn lp-btn--danger lp-btn--sm"
              style={{ marginLeft: 'auto' }}
              disabled={visibleParentIds.length === 0}
              onClick={hideAllParents}
            >
              HIDE ALL PARENT UPLOADS
            </button>
          </div>

          <AlbumJump groups={parentGroups} onJump={(id) => jumpToAlbum('parents', id)} />

          <Albums
            groups={parentGroups}
            sel={pSel}
            pulseIds={pulseIds}
            collapsed={parentCollapsed}
            onToggleCollapse={(id) => toggleCollapse(`parents:${id}`)}
            onToggleSel={togglePSel}
            onSelectMany={selectMany(setPSel)}
            onOpen={setViewer}
            source="parent"
            emptyNode={parentPhotos.length ? (
              <Empty k="NOTHING HERE">No parent photos for this team. Tap ALL TEAMS.</Empty>
            ) : (
              <Empty k="ALL QUIET">
                No parent uploads yet. They land here live as families post from the stands.
              </Empty>
            )}
          />
        </div>
      )}

      {!loading && tab === 'subs' && (
        <div className="lp-panel" key="subs">
          <SubEvents
            eventId={eventId}
            subEvents={subEvents}
            counts={subCounts}
            emailRef={email}
            refreshSubs={refreshSubs}
            setActionErr={setActionErr}
            onJump={jumpToSub}
          />
        </div>
      )}

      <BulkDrawer
        open={drawerOpen}
        count={sel.size}
        subEvents={subEvents}
        onTeam={(t) => applyPatch({ raider_team: t }, sel)}
        onSubEvent={(s) => applyPatch({ sub_event_id: s.id, ...(s.team !== 'both' ? { raider_team: s.team } : {}) }, sel)}
        onClearSub={() => applyPatch({ sub_event_id: null }, sel)}
        onPublish={() => { haptic(22); applyPatch({ visibility: 'public' }, sel); clearSel(); }}
        onUnpublish={() => { applyPatch({ visibility: 'staged' }, sel); clearSel(); }}
        onDelete={bulkDelete}
        onClear={clearSel}
      />

      {viewer && (
        <PhotoViewer
          photos={viewerList}
          id={viewer}
          onId={setViewer}
          onClose={closeViewer}
          actions={viewerActions}
          onBlurred={onBlurred}
          groupName={groupNameOf}
        />
      )}

      <PwaUpdateBar show={updateReady} />
    </div>
  );
}

function Count({ n, bump }) {
  return <span className="lp-count" data-bump={bump ? 'true' : 'false'}>{n}</span>;
}

function FilterChip({ id, cur, set, n, children }) {
  return (
    <button
      className="lp-fchip"
      data-on={cur === id}
      aria-pressed={cur === id}
      onClick={() => { haptic(8); set(id); }}
    >
      {children}<span className="n">{n}</span>
    </button>
  );
}

function InstallStrip() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (dismissed) return null;
  return (
    <div className="lp-install">
      {prompt ? (
        <>
          <span>Install OPTIC as an app for the day.</span>
          <button
            className="lp-btn lp-btn--sm"
            onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}
          >
            INSTALL
          </button>
        </>
      ) : (
        <span style={{ color: 'var(--mute)' }}>
          {isIos() ? 'Install: Share icon → Add to Home Screen.' : 'Install: browser menu → Install app.'}
        </span>
      )}
      <button
        className="lp-btn lp-btn--ghost lp-btn--sm"
        style={{ marginLeft: 'auto' }}
        onClick={() => setDismissed(true)}
      >
        DISMISS
      </button>
    </div>
  );
}

function LoadingGrid() {
  return (
    <>
      <div className="lp-bar" />
      <div className="lp-grid">
        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="lp-skel" />)}
      </div>
    </>
  );
}

// Crude v1 schedule capture (real editor is a fast-follow): each sub-event
// row gets START / END stamp buttons Luke taps as a team actually begins and
// finishes that station — the MOI matrix has no pre-set clock times, teams
// rotate through 5 side-by-side stations as graders call them ready, so
// tap-to-stamp on the day beats typing a datetime-local mid-rotation. Once a
// window is stamped, RE-TAG runs optic_retag_photos and copies sub_event_id +
// raider_team onto every one of Luke's photos whose taken_at falls inside it.
function SubEvents({ eventId, subEvents, counts, emailRef, refreshSubs, setActionErr, onJump }) {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('both');
  const [busy, setBusy] = useState(false);
  const [freshId, setFreshId] = useState(null);
  const [retagging, setRetagging] = useState(false);
  const [retagMsg, setRetagMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [alertText, setAlertText] = useState('');
  const [prefilling, setPrefilling] = useState(false);

  const have = new Set(subEvents.map((s) => normName(s.name)));
  const missingStandard = STANDARD_EVENTS.filter((n) => !have.has(normName(n)));

  async function prefill() {
    if (!eventId || prefilling) return;
    setPrefilling(true); setActionErr('');
    haptic(14);
    const { error } = await addStandardEvents(eventId, subEvents.map((s) => s.name), emailRef.current);
    setPrefilling(false);
    if (error) { setActionErr(error.message || 'Could not add the standard events.'); haptic([8, 40, 8]); }
    else haptic([10, 30, 10]);
    refreshSubs();
  }

  async function create() {
    const n = name.trim();
    if (!n || busy) return;
    if (!eventId) { setActionErr('No active event set. Set optic_config.active_event_id first.'); return; }
    setBusy(true); setActionErr('');
    haptic(14);
    const { data, error } = await SB.from('raider_sub_events')
      .insert({ event_id: eventId, name: n, team, created_by: emailRef.current || null })
      .select().single();
    setBusy(false);
    if (error) { setActionErr(error.message || 'Could not create sub-event.'); haptic([8, 40, 8]); return; }
    setName(''); setTeam('both');
    if (data?.id) { setFreshId(data.id); setTimeout(() => setFreshId(null), 950); }
    refreshSubs();
  }

  async function stamp(id, field) {
    haptic(10);
    const { error } = await SB.from('raider_sub_events')
      .update({ [field]: new Date().toISOString() }).eq('id', id);
    if (error) { setActionErr(error.message || 'Could not stamp time.'); return; }
    refreshSubs();
  }

  async function clearWindow(id) {
    haptic(10);
    await SB.from('raider_sub_events').update({ starts_at: null, ends_at: null }).eq('id', id);
    refreshSubs();
  }

  // photos.sub_event_id is ON DELETE SET NULL (rhea_comp_photos.sql), so a
  // delete here never touches the photos themselves — it just un-tags them
  // back to "untagged" instead of erroring or cascading.
  async function deleteSubEvent(id, name, n) {
    const warn = n > 0
      ? `Delete "${name}"? ${n} photo${n === 1 ? '' : 's'} tagged to it will go back to untagged, not deleted.`
      : `Delete "${name}"?`;
    if (!window.confirm(warn)) return;
    haptic(10);
    const { error } = await SB.from('raider_sub_events').delete().eq('id', id);
    if (error) { setActionErr(error.message || 'Could not delete sub-event.'); return; }
    refreshSubs();
  }

  async function retag() {
    if (!eventId) { setActionErr('No active event set. Set optic_config.active_event_id first.'); return; }
    setRetagging(true); setRetagMsg(''); setActionErr('');
    haptic(16);
    const { data, error } = await SB.rpc('optic_retag_photos', { p_event_id: eventId });
    setRetagging(false);
    if (error) { setActionErr(error.message || 'Re-tag failed.'); haptic([8, 40, 8]); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setRetagMsg(`${row?.tagged ?? 0} TAGGED · ${row?.dead ?? 0} DEAD TIME`);
    haptic([10, 30, 10]);
  }

  // Batch push, one tap, never per-photo (see BUILD_PLAN slice 9). Custom
  // message so this doubles as net control ("CCR over by the water jugs in
  // 10 min"), not just a photo-alert ping. Empty box falls back to the
  // default photo-alert text. Requires optic_push.sql + the optic-send-push
  // edge fn deployed with VAPID secrets set; a clean "send failed" error here
  // just means that hasn't happened yet, not that anything is broken.
  async function sendAlert() {
    if (!eventId) { setActionErr('No active event set. Set optic_config.active_event_id first.'); return; }
    setSending(true); setSendMsg(''); setActionErr('');
    haptic(16);
    const text = alertText.trim();
    const { data, error } = await SB.functions.invoke('optic-send-push', {
      body: {
        event_id: eventId,
        title: 'OPTIC',
        body: text || 'New photos are up from the comp.',
      },
    });
    setSending(false);
    if (error) { setActionErr(error.message || 'Send failed. Is optic-send-push deployed with VAPID secrets set?'); haptic([8, 40, 8]); return; }
    setSendMsg(`SENT TO ${data?.sent ?? 0} DEVICE${data?.sent === 1 ? '' : 'S'}${data?.failed ? ` · ${data.failed} FAILED` : ''}`);
    setAlertText('');
    haptic([10, 30, 10]);
  }

  return (
    <>
      {eventId && missingStandard.length > 0 && (
        <div className="lp-speed" style={{ marginBottom: 2 }}>
          <span style={{ flex: 1 }}>
            {missingStandard.length === STANDARD_EVENTS.length
              ? 'Add the standard events (both teams):'
              : 'Missing standard events:'} {missingStandard.join(', ')}
          </span>
          <button className="lp-btn lp-btn--sm" onClick={prefill} disabled={prefilling}>
            {prefilling ? 'ADDING…' : `ADD ${missingStandard.length}`}
          </button>
        </div>
      )}

      <div className="lp-create">
        <input
          className="lp-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New sub-event, e.g. Rope Bridge, Team 3"
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
        />
        <div className="lp-seg" role="group" aria-label="Team">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              data-on={team === t.id}
              aria-pressed={team === t.id}
              onClick={() => { haptic(8); setTeam(t.id); }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="lp-btn" onClick={create} disabled={busy || !name.trim() || !eventId}>
          {busy ? 'CREATING…' : 'CREATE SUB-EVENT'}
        </button>
      </div>

      <div style={{ padding: '10px 14px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={retag} disabled={retagging || !eventId}>
          {retagging ? 'RE-TAGGING…' : 'RE-TAG PHOTOS FROM SCHEDULE'}
        </button>
        {retagMsg && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--gold)' }}>{retagMsg}</span>}
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 6 }}>
          NET CONTROL, MESSAGE EVERYONE SUBSCRIBED (BLANK = &quot;NEW PHOTOS ARE UP&quot;)
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="lp-input"
            style={{ flex: '1 1 220px' }}
            value={alertText}
            onChange={(e) => setAlertText(e.target.value)}
            placeholder='e.g. "CCR over by the water jugs in 10 min"'
            maxLength={160}
            onKeyDown={(e) => { if (e.key === 'Enter') sendAlert(); }}
          />
          <button className="lp-btn lp-btn--sm" onClick={sendAlert} disabled={sending || !eventId}>
            {sending ? 'SENDING…' : 'SEND ALERT'}
          </button>
        </div>
        {sendMsg && <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--gold)' }}>{sendMsg}</div>}
      </div>

      <div style={{ padding: '10px 14px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subEvents.length === 0 && (
          <Empty k="NO SUB-EVENTS">
            Create the first one above, then tag photos to it from the Tagging tab.
          </Empty>
        )}
        {subEvents.map((s) => {
          const n = counts[s.id] || 0;
          const running = !!s.starts_at && !s.ends_at;
          const windowed = !!s.starts_at && !!s.ends_at;
          return (
            <div key={s.id} className="lp-row" data-fresh={s.id === freshId} style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="press" style={{ all: 'unset', cursor: 'pointer', display: 'flex', flex: 1, minWidth: 0, gap: 8, alignItems: 'center' }} onClick={() => onJump(s.id)}>
                <span className="lp-row-name">{s.name}</span>
                <span className="lp-row-n">{n} PHOTO{n === 1 ? '' : 'S'} ›</span>
                <span className="lp-row-team">{s.team.toUpperCase()}</span>
              </button>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', color: running ? 'var(--gold)' : windowed ? 'var(--mute)' : 'var(--faint)' }}>
                {running ? 'RUNNING…' : windowed
                  ? `${new Date(s.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${new Date(s.ends_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'NO TIME SET'}
              </span>
              {!s.starts_at && (
                <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={() => stamp(s.id, 'starts_at')}>START</button>
              )}
              {running && (
                <button className="lp-btn lp-btn--sm" onClick={() => stamp(s.id, 'ends_at')}>END</button>
              )}
              {windowed && (
                <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={() => clearWindow(s.id)}>CLEAR TIME</button>
              )}
              <button
                className="lp-btn lp-btn--danger lp-btn--sm"
                onClick={() => deleteSubEvent(s.id, s.name, n)}
                aria-label={`Delete ${s.name}`}
              >
                DELETE
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function BulkDrawer({ open, count, subEvents, onTeam, onSubEvent, onClearSub, onPublish, onUnpublish, onDelete, onClear }) {
  return (
    <div className="lp-drawer" data-open={open} aria-hidden={!open}>
      <div className="lp-drawer-hd">
        <b>{count} SELECTED</b>
        <button className="lp-btn lp-btn--ghost lp-btn--sm" style={{ marginLeft: 'auto' }} onClick={onClear}>
          CLEAR
        </button>
      </div>

      <div className="lp-drawer-lbl">TEAM</div>
      <div className="lp-seg">
        {TEAMS.map((t) => <button key={t.id} onClick={() => onTeam(t.id)}>{t.label}</button>)}
      </div>

      <div className="lp-drawer-lbl">SUB-EVENT</div>
      <div className="lp-chips">
        {subEvents.length === 0 && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--faint)', padding: '10px 2px', whiteSpace: 'nowrap' }}>
            none yet, make one in EVENTS
          </span>
        )}
        {subEvents.map((s) => (
          <button key={s.id} className="lp-chip" onClick={() => onSubEvent(s)}>{s.name}</button>
        ))}
        {subEvents.length > 0 && <button className="lp-chip" onClick={onClearSub}>✕ CLEAR</button>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        <button className="lp-btn" style={{ flex: 2 }} onClick={onPublish}>PUBLISH</button>
        <button className="lp-btn lp-btn--ghost" style={{ flex: 1 }} onClick={onUnpublish}>UNPUBLISH</button>
      </div>
      <button className="lp-btn lp-btn--danger" style={{ width: '100%', marginTop: 6 }} onClick={onDelete}>
        DELETE PERMANENTLY
      </button>
    </div>
  );
}

// Switch which comp OPTIC is live for, from the phone — no SQL. Picks (or
// creates) a posted Raider event, points optic_config.active_event_id at it
// (fresh, empty feed; past comps keep their photos under their own
// event_id), and re-locks the gate on an AUTO countdown to 8:00 AM local on
// the event's date — same "open after check-in/briefing" rule every comp
// has used. Writes are admin-only via RLS (optic_config: is_admin; events
// insert/update: S5/S6), and this whole surface is behind AdminGate.
const DEFAULT_OPEN_HOUR = 8;

function CompControl({ eventId, eventTitle }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [pick, setPick] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    SB.from('events').select('id, title, date, status').eq('team', 'raiders')
      .order('date', { ascending: false }).limit(30)
      .then(({ data }) => setEvents(data || []));
  }, [open]);

  function opensAtFor(date) {
    // Local wall-clock 08:00 on the comp date (Luke's phone is on ET).
    const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d, DEFAULT_OPEN_HOUR, 0, 0).toISOString();
  }

  async function switchTo(ev) {
    const when = new Date(opensAtFor(ev.date));
    if (!window.confirm(`Switch OPTIC to "${ev.title}"?\n\nThe live feed starts empty and stays LOCKED until ${when.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Past comps' photos are kept.`)) return;
    setBusy(true); setErr(''); setMsg(''); haptic(14);
    try {
      if (ev.status !== 'posted') {
        // photos_require_posted_event rejects uploads to a draft event.
        const { error } = await SB.from('events').update({ status: 'posted' }).eq('id', ev.id);
        if (error) throw error;
      }
      const now = new Date().toISOString();
      const cfg = await SB.from('optic_config').update({ active_event_id: ev.id, updated_at: now }).eq('id', 'default');
      if (cfg.error) throw cfg.error;
      const gate = await SB.from('rhea_gate')
        .update({ mode: 'auto', opens_at: when.toISOString(), is_open: false, updated_at: now })
        .eq('id', 'default');
      if (gate.error) throw gate.error;
      // Fresh comp with no stations yet: set up the standard ones. A comp
      // that already has its own list is left alone. Best-effort; the
      // EVENTS tab offers the same button if this doesn't land.
      const subs = await SB.from('raider_sub_events').select('name').eq('event_id', ev.id);
      if (!subs.error && !(subs.data || []).length) {
        const { data: sess } = await SB.auth.getSession();
        await addStandardEvents(ev.id, [], sess.session?.user?.email);
      }
      setMsg(`Live for ${ev.title}. Locked until ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
      setOpen(false);
    } catch (e) {
      setErr(e?.message || 'Switch failed, tap again.');
    }
    setBusy(false);
  }

  async function createAndSwitch() {
    const title = newTitle.trim();
    if (!title || !newDate) return;
    setBusy(true); setErr('');
    const { data, error } = await SB.from('events').insert({
      title, date: newDate, team: 'raiders', category: 'RAIDER', status: 'posted', will_have_pictures: true,
    }).select('id, title, date, status').single();
    setBusy(false);
    if (error) { setErr(error.message || 'Could not create event.'); return; }
    setNewTitle(''); setNewDate('');
    await switchTo(data);
  }

  const picked = events.find((e) => e.id === pick);

  return (
    <div className="lp-gate">
      <div className="lp-gate-row" style={{ justifyContent: 'space-between' }}>
        <span className="lp-gate-status">LIVE COMP · {eventTitle ? eventTitle.toUpperCase() : 'NONE SET'}</span>
        <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={() => setOpen((o) => !o)} disabled={busy}>
          {open ? 'CANCEL' : 'SWITCH COMP'}
        </button>
      </div>
      {open && (
        <>
          <div className="lp-gate-row">
            <select className="lp-gate-input" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
              <option value="">Pick a Raider event…</option>
              {events.map((e) => (
                <option key={e.id} value={e.id} disabled={e.id === eventId}>
                  {e.date} · {e.title}{e.status !== 'posted' ? ' (draft)' : ''}{e.id === eventId ? ' (live now)' : ''}
                </option>
              ))}
            </select>
            <button className="lp-btn lp-btn--sm" disabled={busy || !picked} onClick={() => switchTo(picked)}>
              SWITCH
            </button>
          </div>
          <div className="lp-gate-note">Not listed? Create it:</div>
          <div className="lp-gate-row" style={{ flexWrap: 'wrap' }}>
            <input
              className="lp-gate-input" style={{ flex: '1 1 160px' }} placeholder="Warren County Raider Competition"
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            />
            <input className="lp-gate-input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <button className="lp-btn lp-btn--sm" disabled={busy || !newTitle.trim() || !newDate} onClick={createAndSwitch}>
              CREATE + SWITCH
            </button>
          </div>
        </>
      )}
      {msg && <div className="lp-gate-note">{msg}</div>}
      {err && <div className="lp-gate-note" data-err="true">{err}</div>}
    </div>
  );
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's local zone.
function toLocalInput(ts) {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Beta gate control. Reads/writes the single rhea_gate row (table name
// predates the de-Rhea rename; admin-only via RLS, this whole surface is
// behind AdminGate). Tri-state kill switch in `mode`: FORCE OPEN / AUTO
// (countdown) / LOCK (force closed). LOCK wins over the clock and takes
// effect immediately for anyone already on /optic (the change rides the same
// realtime channel useOpticGate listens on). "SET TIME"
// reschedules the countdown and drops back to AUTO.
function GateControl() {
  const [row, setRow] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await SB.from('rhea_gate').select('*').eq('id', 'default').maybeSingle();
      if (data) { setRow(data); setDraft((d) => d || toLocalInput(data.opens_at)); }
    };
    load();
    // Unique per mount, same reason as useOpticConfig: a remount before the
    // old channel's leave is acked would get that dying channel back.
    const ch = SB.channel(`lp-gate-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rhea_gate', filter: 'id=eq.default' }, load)
      .subscribe();
    return () => { SB.removeChannel(ch); };
  }, []);

  if (!row) return null;
  const rawMode = row.mode === 'open' || row.mode === 'closed' ? row.mode : 'auto';
  // Pre-migration rows have no `mode`; the legacy `is_open=true` flag still
  // forces the feed open, so treat it as mode 'open' for the whole UI.
  const preMigration = row.mode == null;
  const mode = rawMode === 'auto' && row.is_open === true ? 'open' : rawMode;
  const opensAt = new Date(row.opens_at);
  const autoOpen = Date.now() >= opensAt.getTime();
  const openNow = mode === 'open' || (mode === 'auto' && autoOpen);
  const stateLabel = mode === 'open' ? 'FORCED OPEN'
    : mode === 'closed' ? 'FORCED CLOSED'
      : autoOpen ? 'AUTO · OPEN' : 'AUTO · LOCKED';

  async function patch(p) {
    setBusy(true); setErr(''); haptic(14);
    const { error } = await SB.from('rhea_gate')
      .update({ ...p, updated_at: new Date().toISOString() })
      .eq('id', 'default');
    if (error) setErr(error.message || 'Save failed, tap again.');
    setBusy(false);
  }

  // target: 'open' | 'auto' | 'closed'. Post-migration writes `mode`.
  // Pre-migration (no `mode` column) falls back to the legacy `is_open` flag,
  // which still forces the feed open early / releases it back to the countdown.
  function setGate(target) {
    return patch(preMigration ? { is_open: target === 'open' } : { mode: target });
  }

  const modeBtn = (m, activeClass = '') =>
    `lp-btn lp-btn--sm ${mode === m ? activeClass : 'lp-btn--ghost'}`.trim();

  return (
    <div className="lp-gate" data-open={openNow}>
      <div className="lp-gate-row">
        <span className="lp-gate-status">
          {openNow ? '● FEED OPEN' : '○ FEED LOCKED'} · {stateLabel}
        </span>
      </div>
      <div className="lp-gate-row" role="group" aria-label="Gate override" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button className={modeBtn('open')} disabled={busy || mode === 'open'} onClick={() => setGate('open')}>
          FORCE OPEN
        </button>
        <button className={modeBtn('auto')} disabled={busy || mode === 'auto'} onClick={() => setGate('auto')}>
          AUTO
        </button>
        <button
          className={modeBtn('closed', 'lp-btn--danger')}
          disabled={busy || mode === 'closed' || preMigration}
          onClick={() => setGate('closed')}
        >
          LOCK
        </button>
      </div>
      <div className="lp-gate-row">
        <input
          type="datetime-local"
          className="lp-gate-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="lp-btn lp-btn--ghost lp-btn--sm"
          disabled={busy || !draft}
          onClick={() => patch(
            preMigration
              ? { opens_at: new Date(draft).toISOString(), is_open: false }
              : { opens_at: new Date(draft).toISOString(), mode: 'auto' },
          )}
        >
          SET TIME
        </button>
      </div>
      {mode === 'auto' && (
        <div className="lp-gate-note">
          Auto-opens {opensAt.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      )}
      {mode === 'closed' && (
        <div className="lp-gate-note">Force-locked. Tap AUTO or FORCE OPEN to release.</div>
      )}
      {mode === 'open' && (
        <div className="lp-gate-note">Forced open, schedule ignored.</div>
      )}
      {preMigration && (
        <div className="lp-gate-note">
          Run rhea_gate_mode.sql to enable LOCK. FORCE OPEN / AUTO work now via the legacy flag.
        </div>
      )}
      {err && <div className="lp-gate-note" data-err="true">{err}</div>}
    </div>
  );
}

function Empty({ k, children }) {
  return (
    <div className="lp-empty">
      <span className="k">{k}</span>
      {children}
    </div>
  );
}
