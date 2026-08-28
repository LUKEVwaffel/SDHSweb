import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDeviceId } from '../../lib/fingerprint';
import { useRheaPhotos } from '../../hooks/useRheaPhotos';
import {
  uploadRheaPhoto, isAllowedImage, ACCEPT_ATTR, REJECT_MESSAGE,
  feedAttribution, feedChip, downloadPhoto,
  hasOnboardedRhea, hasWalkthroughRhea, markWalkthroughRhea,
} from '../../lib/rheaComp';
import { installRheaPwaHooks, isStandalone } from './pwa';
import RheaOnboarding from './RheaOnboarding';
import posthog from '../../lib/posthog';
import './rhea.css';

let uid = 0;
const nextId = () => `u${Date.now()}_${uid++}`;

// ── /rhea — public parent upload + live feed. Hardcoded to one event. Zero
// navigation: landing on the link IS the flow. Mobile-first (parents in the
// stands on phones). Parent photos go live immediately (visibility='public',
// no staging), and the feed below streams every public photo (parent + Luke's
// published) in realtime. Front-of-house, so this surface carries the full
// polish: layered navy, gold hairlines, an immersive photo viewer, and a
// first-launch walkthrough for people who installed the app.
export default function Rhea() {
  const [onboarded, setOnboarded] = useState(() => isStandalone() || hasOnboardedRhea());

  useEffect(() => { installRheaPwaHooks(); }, []);

  if (!onboarded) return <RheaOnboarding onDone={() => setOnboarded(true)} />;
  return <RheaApp />;
}

function OpticGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="256" cy="256" r="176" fill="none" stroke="#C9A961" strokeWidth="18" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#C9A961" strokeOpacity="0.4" strokeWidth="7" />
      <polygon points="256,172 328.7,214 328.7,298 256,340 183.3,298 183.3,214" fill="#C9A961" />
      <polygon points="273,226.6 290,256 273,285.4 239,285.4 222,256 239,226.6" fill="#06101F" />
      <ellipse cx="232" cy="206" rx="15" ry="9" fill="#F4ECD8" fillOpacity="0.9" transform="rotate(-35 232 206)" />
    </svg>
  );
}

function RheaApp() {
  const { photos, loading, error } = useRheaPhotos({ scope: 'public' });
  const [lightbox, setLightbox] = useState(null); // index into photos, or null
  const [walk, setWalk] = useState(() => isStandalone() && !hasWalkthroughRhea());

  return (
    <div className="rhea">
      <div className="rhea-shell">
        <Header onHelp={() => setWalk(true)} />
        <div className="rhea-wrap">
          <UploadCard />
          <Feed
            photos={photos}
            loading={loading}
            error={error}
            onOpen={(i) => setLightbox(i)}
          />
        </div>
      </div>

      {lightbox !== null && photos[lightbox] && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {walk && (
        <Walkthrough
          onClose={() => { markWalkthroughRhea(); setWalk(false); }}
        />
      )}
    </div>
  );
}

function Header({ onHelp }) {
  return (
    <header className="rhea-hdr">
      <div className="rhea-hdr-in">
        <OpticGlyph className="rhea-glyph" />
        <div>
          <div className="rhea-kick">SDHS JROTC · OPTIC</div>
          <div className="rhea-title">RHEA COUNTY RAIDER COMP</div>
        </div>
        <div className="rhea-hdr-right">
          <button className="rhea-help" onClick={onHelp} aria-label="Show walkthrough">?</button>
          <Link to="/" className="rhea-link">MAIN SITE ↗</Link>
        </div>
      </div>
    </header>
  );
}

function UploadCard() {
  const [items, setItems] = useState([]); // {id,file,previewUrl,status,error}
  const [name, setName] = useState('');
  const [rejected, setRejected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { getDeviceId(); }, []);
  useEffect(() => () => { itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl)); }, []); // eslint-disable-line

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    const ok = files.filter(isAllowedImage);
    const bad = files.filter((f) => !isAllowedImage(f));
    if (bad.length) setRejected(bad.map((f) => f.name));
    else setRejected([]);
    if (ok.length) {
      setItems((q) => [
        ...q,
        ...ok.map((file) => ({ id: nextId(), file, previewUrl: URL.createObjectURL(file), status: 'pending', error: null })),
      ]);
    }
  }, []);

  async function send() {
    const targets = itemsRef.current.filter((it) => it.status === 'pending' || it.status === 'failed');
    if (!targets.length || busy) return;
    setBusy(true);
    const deviceFp = await getDeviceId();
    let ok = 0;
    for (const it of targets) {
      setItems((q) => q.map((x) => (x.id === it.id ? { ...x, status: 'uploading', error: null } : x)));
      try {
        await uploadRheaPhoto(it.file, { source: 'parent', uploaderName: name, deviceFp });
        ok += 1;
        setItems((q) => q.map((x) => (x.id === it.id ? { ...x, status: 'done' } : x)));
      } catch (err) {
        setItems((q) => q.map((x) => (x.id === it.id ? { ...x, status: 'failed', error: err?.message || 'Upload failed' } : x)));
      }
    }
    setBusy(false);
    if (ok > 0) posthog.capture('rhea_parent_upload', { photo_count: ok });
  }

  function reset() {
    itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]); setRejected([]);
  }

  const pending = items.filter((it) => it.status === 'pending' || it.status === 'failed');
  const done = items.filter((it) => it.status === 'done');
  const allDone = items.length > 0 && pending.length === 0 && !busy;

  return (
    <section className="rhea-card" data-tour="composer">
      <div className="rhea-card-head">
        <div className="rhea-eyebrow">ADD YOUR PHOTOS</div>
        <div className="rhea-card-sub">
          Shots from the stands go straight to the live feed below. No account needed.
        </div>
      </div>

      <div className="rhea-card-body">
        <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

        <div
          className="rhea-drop"
          data-empty={items.length === 0}
          data-drag={dragOver}
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) addFiles(e.dataTransfer.files); }}
        >
          {items.length === 0 ? (
            <>
              <div className="rhea-drop-plus">+</div>
              <div className="rhea-drop-t">TAP TO CHOOSE PHOTOS</div>
              <div className="rhea-drop-hint">JPG / PNG · PICK SEVERAL AT ONCE</div>
            </>
          ) : (
            <div className="rhea-tray">
              {items.map((it) => (
                <div key={it.id} className="rhea-thumb" data-status={it.status}>
                  <img src={it.previewUrl} alt="" style={{ opacity: it.status === 'done' ? 0.5 : 1 }} />
                  {it.status === 'uploading' && <span className="rhea-thumb-badge">…</span>}
                  {it.status === 'done' && <span className="rhea-thumb-badge" data-kind="done">✓</span>}
                  {it.status === 'failed' && <span className="rhea-thumb-badge" data-kind="failed">✕</span>}
                  {it.status === 'pending' && !busy && (
                    <button className="rhea-thumb-x"
                      onClick={(e) => { e.stopPropagation(); setItems((q) => q.filter((x) => x.id !== it.id)); URL.revokeObjectURL(it.previewUrl); }}>×</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {rejected.length > 0 && <div className="rhea-reject">{REJECT_MESSAGE}</div>}

        <input
          className="rhea-name"
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
        />

        {allDone ? (
          <>
            <div className="rhea-ok">
              ✓ {done.length} PHOTO{done.length === 1 ? '' : 'S'} ADDED — SCROLL DOWN TO SEE {done.length === 1 ? 'IT' : 'THEM'} IN THE FEED
            </div>
            <button className="rhea-btn rhea-btn--ghost" onClick={reset}>ADD MORE</button>
          </>
        ) : (
          <button className="rhea-btn" onClick={send} disabled={busy || pending.length === 0}>
            {busy ? `UPLOADING… ${done.length}/${items.length}` : `POST ${pending.length || ''} PHOTO${pending.length === 1 ? '' : 'S'}`.trim()}
          </button>
        )}
      </div>
    </section>
  );
}

function Feed({ photos, loading, error, onOpen }) {
  return (
    <section data-tour="feed">
      <div className="rhea-live">
        <span className="rhea-live-dot" />
        <span className="rhea-live-label">LIVE FEED</span>
        <span className="rhea-live-count">
          {photos.length} PHOTO{photos.length === 1 ? '' : 'S'}
        </span>
      </div>

      {loading && (
        <div className="rhea-feed">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rhea-skel">
              <div className="rhea-skel-img" />
              <div className="rhea-skel-cap" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rhea-feed-msg" data-err="true">FEED ERROR — {error}</div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div className="rhea-empty">No photos yet. Be the first — add one above.</div>
      )}

      {!loading && photos.length > 0 && (
        <div className="rhea-feed">
          {photos.map((p, i) => (
            <FeedItem key={p.id} photo={p} pos={i} onOpen={() => onOpen(i)} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedItem({ photo, pos, onOpen }) {
  const chip = feedChip(photo);
  const who = feedAttribution(photo);
  const isLuke = photo.source === 'luke';
  return (
    <figure className="rhea-item" style={{ '--d': `${Math.min(pos, 8) * 45}ms` }}>
      <button className="rhea-shot" onClick={onOpen} aria-label="View photo full screen">
        <img src={photo.photo_url} alt="" loading="lazy" />
      </button>
      <figcaption className="rhea-cap">
        <span className="rhea-who" data-luke={isLuke}>{who}</span>
        {chip && <span className="rhea-chip">{chip}</span>}
        <time className="rhea-time">
          {new Date(photo.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </time>
      </figcaption>
    </figure>
  );
}

// ── immersive full-screen viewer ──────────────────────────────────────────
const SWIPE_THRESHOLD = 60;

function Lightbox({ photos, index, onIndex, onClose }) {
  const [chrome, setChrome] = useState(true);
  const [drag, setDrag] = useState(0);
  const startX = useRef(null);
  const startY = useRef(null);
  const dragging = useRef(false);

  const go = useCallback((next) => {
    if (next < 0 || next >= photos.length) return;
    onIndex(next);
    setChrome(true);
  }, [photos.length, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight') go(index + 1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [index, go, onClose]);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = false;
  }
  function onTouchMove(e) {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!dragging.current && Math.abs(dx) > Math.abs(dy) + 6) dragging.current = true;
    if (dragging.current) {
      let d = dx;
      if ((index === 0 && d > 0) || (index === photos.length - 1 && d < 0)) d *= 0.32; // rubber-band edges
      setDrag(d);
    }
  }
  function onTouchEnd() {
    if (dragging.current) {
      if (drag <= -SWIPE_THRESHOLD) go(index + 1);
      else if (drag >= SWIPE_THRESHOLD) go(index - 1);
    } else if (startX.current != null) {
      setChrome((c) => !c); // a tap toggles the chrome
    }
    startX.current = null; startY.current = null; dragging.current = false;
    setDrag(0);
  }

  const photo = photos[index];
  const who = feedAttribution(photo);
  const chip = feedChip(photo);
  const isLuke = photo.source === 'luke';

  async function share() {
    const url = photo.photo_url;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Rhea County Raider Comp', text: `Photo by ${who}`, url });
        posthog.capture('rhea_photo_share', { photo_id: photo.id });
        return;
      }
    } catch { /* user cancelled or unsupported */ }
    try { await navigator.clipboard?.writeText(url); } catch { /* no clipboard */ }
  }

  return (
    <div
      className="rhea-lb"
      data-chrome={chrome}
      role="dialog"
      aria-label="Photo viewer"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="rhea-lb-bar">
        <span className="rhea-lb-idx">{index + 1} / {photos.length}</span>
        <button className="rhea-lb-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="rhea-lb-stage">
        <div
          className="rhea-lb-track"
          data-drag={drag !== 0}
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
        >
          {photos.map((p, i) => (
            <div className="rhea-lb-slide" key={p.id}>
              {Math.abs(i - index) <= 1 && (
                <img src={p.photo_url} alt="" draggable="false" />
              )}
            </div>
          ))}
        </div>

        <button className="rhea-lb-nav" data-side="prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous">‹</button>
        <button className="rhea-lb-nav" data-side="next" onClick={() => go(index + 1)} disabled={index === photos.length - 1} aria-label="Next">›</button>
      </div>

      <div className="rhea-lb-foot">
        <div className="rhea-lb-meta">
          <div className="rhea-lb-who" data-luke={isLuke}>{who}</div>
          <div className="rhea-lb-line">
            {chip && <span className="rhea-chip">{chip}</span>}
            <span className="rhea-time">
              {new Date(photo.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="rhea-lb-actions">
          {(navigator.share || navigator.clipboard) && (
            <button className="rhea-lb-act" onClick={share}>⇪ SHARE</button>
          )}
          <button className="rhea-lb-act" onClick={() => downloadPhoto(photo.photo_url, `rhea_${photo.id}.jpg`)}>⬇ SAVE</button>
        </div>
      </div>
    </div>
  );
}

// ── first-launch walkthrough (installed app only) ─────────────────────────
const WALK_STEPS = [
  {
    glyph: '📡',
    step: 'STEP 1 / 3',
    h: <>One live feed for <span className="accent">the whole day.</span></>,
    p: 'Every family and cadet posts to the same feed. It updates on its own as photos come in — no refresh, no hunting for a link.',
  },
  {
    glyph: '⤢',
    step: 'STEP 2 / 3',
    h: <>Tap any photo to <span className="accent">open it full screen.</span></>,
    p: 'Swipe left and right to move through the day. Pinch or tap the edges to browse. Save or share straight from the viewer.',
  },
  {
    glyph: '＋',
    step: 'STEP 3 / 3',
    h: <>See a moment? <span className="accent">Add it.</span></>,
    p: 'Use “Add your photos” at the top. Your shot is in the feed for every other family within seconds. No login, ever.',
  },
];

function Walkthrough({ onClose }) {
  const [i, setI] = useState(0);
  const last = i === WALK_STEPS.length - 1;
  const s = WALK_STEPS[i];

  function next() {
    try { navigator.vibrate?.(10); } catch { /* unsupported */ }
    if (last) { posthog.capture('rhea_walkthrough_done'); onClose(); }
    else setI(i + 1);
  }

  return (
    <div className="rhea-wt" role="dialog" aria-label="App walkthrough">
      <div className="rhea-wt-card" key={i}>
        <div className="rhea-wt-glyph">{s.glyph}</div>
        <div className="rhea-wt-step">{s.step}</div>
        <h2 className="rhea-wt-h">{s.h}</h2>
        <p className="rhea-wt-p">{s.p}</p>
        <div className="rhea-wt-foot">
          <div className="rhea-wt-dots" aria-hidden="true">
            {WALK_STEPS.map((_, n) => <span key={n} className="rhea-wt-dot" data-on={n === i} />)}
          </div>
          {!last && <button className="rhea-wt-skip" onClick={() => { posthog.capture('rhea_walkthrough_skip'); onClose(); }}>Skip</button>}
          <button className="rhea-wt-next" onClick={next}>{last ? 'GOT IT' : 'NEXT'}</button>
        </div>
      </div>
    </div>
  );
}
