import { useRef, useMemo } from 'react';
import { raiderTeamLabel, isBlurredPhoto } from '../../lib/opticComp';

// ── /lukepwa albums. Replaces the one flat grid: photos are grouped into one
// album per sub-event (Rope Bridge, CCR, ...) in the order the events were
// made, with everything not tagged to an event in a last UNSORTED album. The
// team filter sits above (same ALL / MALE / COED rule as the parent feed:
// 'both' shows under either team), so "Coed at Rope Bridge" is two taps.
//
// Tiles follow the photo-app convention: tap opens the photo full screen,
// long-press (or the corner circle) starts selecting, and while anything is
// selected a plain tap toggles selection instead.

const LONG_PRESS_MS = 420;
// Roughly the first screenful: fetched eagerly at high priority, everything
// below that lazily, so the top of the page never queues behind offscreen tiles.
const EAGER_TILES = 12;
const MOVE_CANCEL_PX = 10;
const UNSORTED = '__unsorted';

export const TEAM_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'male', label: 'MALE' },
  { id: 'coed', label: 'COED' },
];

export const matchesTeam = (p, team) =>
  team === 'all' || p.raider_team === team || p.raider_team === 'both';

const capturedAt = (p) => new Date(p.taken_at || p.created_at).getTime();
const haptic = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

/**
 * Group photos into albums: one per sub-event (in `subEvents` order), then
 * any event tagged on a photo but missing from the list, then UNSORTED.
 * Photos inside an album run in capture order, so an album reads like the
 * event actually happened.
 */
export function groupByEvent(photos, subEvents) {
  const buckets = new Map();
  for (const p of photos) {
    const k = p.sub_event_id || UNSORTED;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p);
  }
  const groups = [];
  const take = (id, name, team) => {
    const list = buckets.get(id);
    if (!list) return;
    buckets.delete(id);
    groups.push({ id, name, team, photos: list.slice().sort((a, b) => capturedAt(a) - capturedAt(b)) });
  };
  for (const s of subEvents) take(s.id, s.name, s.team);
  for (const [id, list] of [...buckets]) {
    if (id === UNSORTED) continue;
    take(id, list[0].raider_sub_events?.name || 'Other event', list[0].raider_sub_events?.team || null);
  }
  take(UNSORTED, 'Unsorted', null);
  return groups;
}

/**
 * Parent uploads almost never carry a sub-event (parents only pick a team),
 * so grouping them by event would be one big UNSORTED album. They get one
 * album per team instead, newest first, since that's what just came in.
 */
const TEAM_ALBUMS = [
  ['male', 'Male Raiders'],
  ['coed', 'Coed Raiders'],
  ['both', 'Both teams'],
];
export function groupByTeam(photos) {
  const newest = (list) => list.slice().sort((a, b) => capturedAt(b) - capturedAt(a));
  const groups = TEAM_ALBUMS
    .map(([id, name]) => ({ id: `team-${id}`, name, team: null, photos: newest(photos.filter((p) => p.raider_team === id)) }))
    .filter((g) => g.photos.length);
  const none = photos.filter((p) => !TEAM_ALBUMS.some(([id]) => id === p.raider_team));
  if (none.length) groups.push({ id: UNSORTED, name: 'No team picked', team: null, photos: newest(none) });
  return groups;
}

/** "CCR · MALE": the name alone is ambiguous once a station has one sub-event per team. */
export const subEventLabel = (e) => (e.team && e.team !== 'both' ? `${e.name} · ${e.team.toUpperCase()}` : e.name);

export const albumAnchor = (id) => `lp-album-${id}`;

export function Albums({
  groups, sel, pulseIds, collapsed, onToggleCollapse, onToggleSel, onSelectMany, onOpen,
  source, emptyNode,
}) {
  if (!groups.length) return emptyNode;
  // Tiles above each album (collapsed albums show none), for EAGER_TILES.
  const offsets = [];
  let seen = 0;
  for (const g of groups) {
    offsets.push(seen);
    if (!collapsed.has(g.id)) seen += g.photos.length;
  }
  return (
    <div className="lp-albums">
      {groups.map((g, gi) => (
        <Album
          key={g.id}
          offset={offsets[gi]}
          group={g}
          sel={sel}
          pulseIds={pulseIds}
          collapsed={collapsed.has(g.id)}
          onToggleCollapse={() => onToggleCollapse(g.id)}
          onToggleSel={onToggleSel}
          onSelectMany={onSelectMany}
          onOpen={onOpen}
          source={source}
        />
      ))}
    </div>
  );
}

function Album({ group, offset, sel, pulseIds, collapsed, onToggleCollapse, onToggleSel, onSelectMany, onOpen, source }) {
  const ids = useMemo(() => group.photos.map((p) => p.id), [group.photos]);
  const selCount = ids.filter((id) => sel.has(id)).length;
  const allSel = selCount === ids.length && ids.length > 0;
  const staged = source === 'luke' ? group.photos.filter((p) => p.visibility === 'staged').length : 0;
  const hidden = source === 'parent' ? group.photos.filter((p) => p.status === 'hidden').length : 0;
  const selecting = sel.size > 0;
  const unsorted = group.id === UNSORTED;

  return (
    <section className="lp-album" id={albumAnchor(group.id)} data-unsorted={unsorted}>
      <header className="lp-album-hd">
        <button className="lp-album-toggle" onClick={onToggleCollapse} aria-expanded={!collapsed}>
          <span className="lp-album-chev" data-open={!collapsed}>›</span>
          <span className="lp-album-name">{group.name}</span>
          {group.team && group.team !== 'both' && (
            <span className="lp-album-team">{group.team.toUpperCase()}</span>
          )}
          <span className="lp-album-n">
            {ids.length}
            {staged > 0 && <em> · {staged} STAGED</em>}
            {hidden > 0 && <em> · {hidden} HIDDEN</em>}
          </span>
        </button>
        <button
          className="lp-album-sel"
          data-on={allSel}
          onClick={() => { haptic(12); onSelectMany(ids, !allSel); }}
        >
          {allSel ? 'DESELECT' : selCount ? `+${ids.length - selCount}` : 'SELECT'}
        </button>
      </header>

      {!collapsed && (
        <div className="lp-grid">
          {group.photos.map((p, i) => (
            <Tile
              key={p.id}
              photo={p}
              index={i}
              eager={offset + i < EAGER_TILES}
              on={sel.has(p.id)}
              pulse={pulseIds.has(p.id)}
              selecting={selecting}
              onToggleSel={onToggleSel}
              onOpen={onOpen}
              source={source}
              showEvent={unsorted}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Tile({ photo: p, index, eager, on, pulse, selecting, onToggleSel, onOpen, source, showEvent }) {
  const timer = useRef(null);
  const start = useRef(null);
  const longFired = useRef(false);

  const clear = () => { clearTimeout(timer.current); timer.current = null; };
  const down = (e) => {
    longFired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = setTimeout(() => {
      longFired.current = true;
      haptic(18);
      onToggleSel(p.id);
    }, LONG_PRESS_MS);
  };
  const move = (e) => {
    if (!timer.current || !start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_CANCEL_PX) clear();
  };
  const click = () => {
    if (longFired.current) { longFired.current = false; return; }
    if (selecting) onToggleSel(p.id);
    else onOpen(p.id);
  };

  const hidden = source === 'parent' && p.status === 'hidden';
  const team = raiderTeamLabel(p.raider_team);
  const cap = source === 'parent'
    ? p.uploader_name
    : [showEvent ? p.raider_sub_events?.name : null, team].filter(Boolean).join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      className="lp-tile"
      aria-pressed={on}
      data-sel={on}
      data-dim={hidden}
      data-pulse={pulse}
      style={{ animationDelay: `${Math.min(index * 18, 240)}ms` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={click}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } }}
    >
      <img
        src={p.grid_url || p.thumb_url || p.photo_url}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'low'}
        decoding="async"
        draggable={false}
      />
      <span className="lp-pills">
        {source === 'luke' && (
          <span className="lp-tilepill" data-live={p.visibility === 'public'}>
            {p.visibility === 'public' ? 'LIVE' : 'STAGED'}
          </span>
        )}
        {hidden && <span className="lp-tilepill" data-hidden="true">HIDDEN</span>}
        {isBlurredPhoto(p) && <span className="lp-tilepill" data-blur="true">BLURRED</span>}
      </span>
      <button
        className="lp-selbox"
        data-on={on}
        aria-label={on ? 'Deselect photo' : 'Select photo'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggleSel(p.id); }}
      />
      {cap && <span className="lp-cap">{cap}</span>}
    </div>
  );
}

/** Horizontal chip row that scrolls to an album. */
export function AlbumJump({ groups, onJump }) {
  if (groups.length < 2) return null;
  return (
    <div className="lp-filter lp-jump" role="navigation" aria-label="Jump to event">
      {groups.map((g) => (
        <button key={g.id} className="lp-fchip" onClick={() => { haptic(8); onJump(g.id); }}>
          {subEventLabel(g).toUpperCase()}<span className="n">{g.photos.length}</span>
        </button>
      ))}
    </div>
  );
}
