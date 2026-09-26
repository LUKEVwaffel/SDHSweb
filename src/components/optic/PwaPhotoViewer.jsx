import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { raiderTeamLabel, isBlurredPhoto, blurOpticPhoto } from '../../lib/opticComp';

const haptic = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };
const SWIPE_PX = 50;

// ── Full-screen photo viewer for /lukepwa. Swipe (or arrow keys) through the
// photos in the order the albums show them; the bottom bar carries the
// per-photo actions, including BLUR FACES, which opens the editor below.
export function PhotoViewer({ photos, id, onId, onClose, actions, onBlurred, groupName }) {
  const lastIdx = useRef(0);
  let idx = photos.findIndex((p) => p.id === id);
  if (idx === -1) idx = Math.min(lastIdx.current, photos.length - 1);
  lastIdx.current = Math.max(0, idx);
  const photo = photos[idx];
  const [editing, setEditing] = useState(false);
  const touch = useRef(null);
  // Full-res URLs that have finished downloading + decoding. Until the open
  // photo's is in here, the viewer shows the small grid image the tile
  // already has cached, so opening a photo or swiping never shows a blank.
  const [ready, setReady] = useState(() => new Set());
  const markReady = useCallback((url) => {
    setReady((s) => (s.has(url) ? s : new Set(s).add(url)));
  }, []);

  // The photo we were on got deleted: follow to its neighbour, or close.
  useEffect(() => {
    if (!photo) onClose();
    else if (photo.id !== id) onId(photo.id);
  }, [photo, id, onId, onClose]);

  const go = useCallback((d) => {
    const n = idx + d;
    if (n < 0 || n >= photos.length) return;
    haptic(6);
    onId(photos[n].id);
  }, [idx, photos, onId]);

  useEffect(() => {
    if (editing) return undefined;
    const k = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [go, onClose, editing]);

  // Lock the page underneath while the viewer is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load (and decode off the main thread) the open photo first, then its
  // neighbours, so a swipe lands on an already-sharp image.
  const openUrl = photo?.photo_url;
  const nextUrl = photos[idx + 1]?.photo_url;
  const prevUrl = photos[idx - 1]?.photo_url;
  useEffect(() => {
    let dead = false;
    const warm = (url) => {
      if (!url) return Promise.resolve();
      const i = new Image();
      i.decoding = 'async';
      i.src = url;
      return i.decode().then(() => { if (!dead) markReady(url); }).catch(() => {});
    };
    warm(openUrl).then(() => { if (!dead) { warm(nextUrl); warm(prevUrl); } });
    return () => { dead = true; };
  }, [openUrl, nextUrl, prevUrl, markReady]);

  if (!photo) return null;

  if (editing) {
    return (
      <BlurEditor
        photo={photo}
        onCancel={() => setEditing(false)}
        onSaved={(result) => { setEditing(false); onBlurred(photo, result); }}
      />
    );
  }

  const team = raiderTeamLabel(photo.raider_team);
  const when = new Date(photo.taken_at || photo.created_at)
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const meta = [
    groupName?.(photo),
    team,
    photo.source === 'parent' ? (photo.uploader_name || 'Parent') : null,
    when,
  ].filter(Boolean).join(' · ');

  return (
    <div className="lp-view" role="dialog" aria-label="Photo viewer">
      <div className="lp-view-top">
        <button className="lp-view-x" onClick={onClose} aria-label="Close">✕</button>
        <span className="lp-view-pos">{idx + 1} / {photos.length}</span>
        <span className="lp-pills lp-pills--static">
          {photo.source === 'luke' && (
            <span className="lp-tilepill" data-live={photo.visibility === 'public'}>
              {photo.visibility === 'public' ? 'LIVE' : 'STAGED'}
            </span>
          )}
          {photo.status === 'hidden' && <span className="lp-tilepill" data-hidden="true">HIDDEN</span>}
          {isBlurredPhoto(photo) && <span className="lp-tilepill" data-blur="true">BLURRED</span>}
        </span>
      </div>

      <div
        className="lp-view-stage"
        onTouchStart={(e) => {
          if (e.touches.length !== 1) { touch.current = null; return; }
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
          else if (dy > SWIPE_PX * 2 && Math.abs(dy) > Math.abs(dx) * 1.4) onClose();
        }}
      >
        <img
          key={photo.id}
          className="lp-view-img"
          src={ready.has(photo.photo_url) ? photo.photo_url : (photo.grid_url || photo.thumb_url || photo.photo_url)}
          data-full={ready.has(photo.photo_url)}
          alt=""
          draggable={false}
        />
        {idx > 0 && (
          <button className="lp-view-nav" data-dir="prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>
        )}
        {idx < photos.length - 1 && (
          <button className="lp-view-nav" data-dir="next" onClick={() => go(1)} aria-label="Next photo">›</button>
        )}
      </div>

      <div className="lp-view-bar">
        {meta && <div className="lp-view-meta">{meta}</div>}
        <div className="lp-view-acts">
          <button className="lp-btn lp-btn--sm" onClick={() => { haptic(12); setEditing(true); }}>
            ◐ BLUR FACES
          </button>
          {actions(photo).map((a) => (
            <button
              key={a.label}
              className={`lp-btn lp-btn--sm ${a.danger ? 'lp-btn--danger' : 'lp-btn--ghost'}`}
              data-on={a.on || undefined}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Blur editor. Tap a face to drop a blur circle on it, drag a circle to
// move it, the slider sizes the selected one, ZOOM gets close enough to
// place a circle on a face at the back of a group shot. The preview uses a
// CSS backdrop blur; SAVE bakes the real blur into the pixels (see
// blurOpticPhoto) and replaces the photo everywhere it's served.
const DEFAULT_R = 0.06;      // circle radius, fraction of image width
const MIN_R = 0.012;
const MAX_R = 0.4;
const TAP_SLOP_PX = 8;
const ZOOMS = [1, 2, 3];

let nextId = 1;

function BlurEditor({ photo, onCancel, onSaved }) {
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const press = useRef(null);
  const [nat, setNat] = useState(null);       // { w, h } natural image size
  const [fit, setFit] = useState(null);       // { w, h } px at zoom 1
  const [zoom, setZoom] = useState(1);
  const [spots, setSpots] = useState([]);     // { id, cx, cy, r }
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const aspect = nat ? nat.w / nat.h : 1;

  // Size the image to fit the stage at zoom 1; zoom just multiplies it.
  const measure = useCallback(() => {
    const st = stageRef.current;
    if (!st || !nat) return;
    const sw = st.clientWidth;
    const sh = st.clientHeight;
    const scale = Math.min(sw / nat.w, sh / nat.h);
    setFit({ w: nat.w * scale, h: nat.h * scale });
  }, [nat]);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Keep whatever was centred (or the selected circle) centred across zooms.
  const setZoomAround = (z) => {
    const st = stageRef.current;
    if (!st || !fit) { setZoom(z); return; }
    const sel = spots.find((s) => s.id === active);
    const fx = sel ? sel.cx : (st.scrollLeft + st.clientWidth / 2) / (fit.w * zoom);
    const fy = sel ? sel.cy : (st.scrollTop + st.clientHeight / 2) / (fit.h * zoom);
    setZoom(z);
    requestAnimationFrame(() => {
      st.scrollLeft = fx * fit.w * z - st.clientWidth / 2;
      st.scrollTop = fy * fit.h * z - st.clientHeight / 2;
    });
  };

  const pointFrom = (e) => {
    const box = wrapRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  };

  // Tap on the photo (not a drag/scroll) = new circle there. Circles shrink
  // with zoom so a tap at 3x lands a circle sized for a small, distant face.
  const onWrapDown = (e) => { press.current = { x: e.clientX, y: e.clientY }; };
  const onWrapUp = (e) => {
    const p = press.current;
    press.current = null;
    if (!p || drag.current) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_SLOP_PX) return;
    const { x, y } = pointFrom(e);
    const id = nextId++;
    haptic(10);
    setSpots((s) => [...s, { id, cx: x, cy: y, r: Math.max(MIN_R, DEFAULT_R / zoom) }]);
    setActive(id);
  };

  const onSpotDown = (e, id) => {
    e.stopPropagation();
    press.current = null;
    setActive(id);
    const spot = spots.find((s) => s.id === id);
    const { x, y } = pointFrom(e);
    drag.current = { id, dx: spot.cx - x, dy: spot.cy - y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onSpotMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = pointFrom(e);
    setSpots((s) => s.map((o) => (o.id === d.id
      ? { ...o, cx: Math.min(1, Math.max(0, x + d.dx)), cy: Math.min(1, Math.max(0, y + d.dy)) }
      : o)));
  };
  const onSpotUp = () => { drag.current = null; };

  const sel = spots.find((s) => s.id === active);
  const setR = (r) => setSpots((s) => s.map((o) => (o.id === active ? { ...o, r } : o)));
  const remove = () => {
    haptic(8);
    setSpots((s) => s.filter((o) => o.id !== active));
    setActive(null);
  };

  async function save() {
    if (!spots.length || saving) return;
    const n = spots.length;
    if (!window.confirm(`Blur ${n} area${n === 1 ? '' : 's'} and replace this photo?\n\nThe unblurred version is deleted for good, everywhere it shows.`)) return;
    setSaving(true); setErr('');
    haptic(16);
    try {
      const ovals = spots.map((s) => ({ cx: s.cx, cy: s.cy, rx: s.r, ry: s.r * aspect }));
      const result = await blurOpticPhoto(photo, ovals);
      haptic([10, 30, 10]);
      onSaved(result);
    } catch (e) {
      setErr(e?.message || 'Blur failed. Check signal and try again.');
      haptic([8, 40, 8]);
      setSaving(false);
    }
  }

  const w = fit ? fit.w * zoom : 0;
  const h = fit ? fit.h * zoom : 0;

  return (
    <div className="lp-view lp-edit" role="dialog" aria-label="Blur faces">
      <div className="lp-view-top">
        <button className="lp-view-x" onClick={onCancel} disabled={saving} aria-label="Cancel">✕</button>
        <span className="lp-edit-title">BLUR FACES</span>
        <div className="lp-seg lp-seg--mini" role="group" aria-label="Zoom">
          {ZOOMS.map((z) => (
            <button key={z} data-on={zoom === z} aria-pressed={zoom === z} onClick={() => setZoomAround(z)}>
              {z}×
            </button>
          ))}
        </div>
      </div>

      <div className="lp-edit-stage" ref={stageRef} data-zoomed={zoom > 1}>
        {!nat && <div className="lp-edit-loading">LOADING PHOTO…</div>}
        <div
          ref={wrapRef}
          className="lp-edit-wrap"
          style={fit ? { width: w, height: h } : { visibility: 'hidden' }}
          onPointerDown={onWrapDown}
          onPointerUp={onWrapUp}
          onPointerCancel={() => { press.current = null; }}
        >
          <img
            src={photo.photo_url}
            alt=""
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
          {spots.map((s) => (
            <span
              key={s.id}
              className="lp-spot"
              data-active={s.id === active}
              style={{
                left: `${(s.cx - s.r) * 100}%`,
                top: `${(s.cy - s.r * aspect) * 100}%`,
                width: `${s.r * 200}%`,
                height: `${s.r * aspect * 200}%`,
              }}
              onPointerDown={(e) => onSpotDown(e, s.id)}
              onPointerMove={onSpotMove}
              onPointerUp={onSpotUp}
              onPointerCancel={onSpotUp}
            />
          ))}
        </div>
      </div>

      <div className="lp-view-bar">
        {err && <div className="lp-view-meta" data-err="true">{err}</div>}
        {sel ? (
          <div className="lp-edit-size">
            <span>SIZE</span>
            <input
              type="range"
              min={MIN_R}
              max={MAX_R}
              step={0.002}
              value={sel.r}
              onChange={(e) => setR(Number(e.target.value))}
              aria-label="Blur circle size"
            />
            <button className="lp-btn lp-btn--danger lp-btn--sm" onClick={remove}>REMOVE</button>
          </div>
        ) : (
          <div className="lp-view-meta">
            {spots.length ? 'Tap a circle to resize it, or tap another face.' : 'Tap each face to blur. Zoom in for faces at the back.'}
          </div>
        )}
        <div className="lp-view-acts">
          <button className="lp-btn lp-btn--ghost lp-btn--sm" onClick={onCancel} disabled={saving}>CANCEL</button>
          <button className="lp-btn" style={{ flex: 1 }} onClick={save} disabled={!spots.length || saving || !nat}>
            {saving ? 'SAVING…' : spots.length ? `SAVE BLUR · ${spots.length}` : 'SAVE BLUR'}
          </button>
        </div>
      </div>
    </div>
  );
}
