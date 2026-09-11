import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getDeviceId } from '../../lib/fingerprint';
import { useOpticPhotos } from '../../hooks/useOpticPhotos';
import { useOpticLikes } from '../../hooks/useOpticLikes';
import { useOpticGate } from '../../hooks/useOpticGate';
import { useOpticConfig } from '../../hooks/useOpticConfig';
import {
  uploadOpticPhoto, isAllowedImage, OPTIC_ACCEPT_ATTR, REJECT_MESSAGE,
  feedAttribution, feedChip, downloadPhoto,
  hasOnboardedOptic, hasWalkthroughOptic, markWalkthroughOptic,
} from '../../lib/opticComp';
import { readTakenAt } from '../../lib/opticExif';
import { isHeic, convertHeicToJpeg } from '../../lib/heicConvert';
import { installOpticPwaHooks, isStandalone, isIos } from './pwa';
import { usePwaUpdate, PwaUpdateBar } from './usePwaUpdate';
import OpticOnboarding from './OpticOnboarding';
import posthog from '../../lib/posthog';
import './optic.css';

let uid = 0;
const nextId = () => `u${Date.now()}_${uid++}`;

// ── /optic , public parent upload + live feed. Zero navigation: landing on
// the link IS the flow. Mobile-first (parents in the stands on phones).
// Parent photos go live immediately (visibility='public', no staging), and
// the feed below streams every public photo (parent + Luke's published) in
// realtime. Front-of-house, so this surface carries the full polish: layered
// navy, a Shorts-style vertical photo reel, likes, and a first-launch
// walkthrough for people who installed the app.
export default function Optic() {
  const [onboarded, setOnboarded] = useState(() => isStandalone() || hasOnboardedOptic());

  useEffect(() => { installOpticPwaHooks(); }, []);

  if (!onboarded) return <OpticOnboarding onDone={() => setOnboarded(true)} />;
  return <OpticApp />;
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

const TEAM_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'male', label: 'MALE' },
  { id: 'coed', label: 'COED' },
];

function OpticApp() {
  const config = useOpticConfig();
  const gate = useOpticGate();
  const { photos, loading, error } = useOpticPhotos({ eventId: config.eventId, scope: 'public', enabled: gate.open });
  const likes = useOpticLikes(photos);
  const [reel, setReel] = useState(null); // index into visiblePhotos, or null
  const [teamFilter, setTeamFilter] = useState('all');
  const [walk, setWalk] = useState(() => isStandalone() && !hasWalkthroughOptic());
  const updateReady = usePwaUpdate();

  const showWalk = walk && gate.open;

  // 'both' (Luke's untagged-team-but-tagged-event shots) shows under either
  // team filter — it's the #1 ask from the OPTIC survey, so it stays simple:
  // ALL / MALE / COED, no UNASSIGNED bucket yet.
  const teamCounts = useMemo(() => ({
    all: photos.length,
    male: photos.filter((p) => p.raider_team === 'male' || p.raider_team === 'both').length,
    coed: photos.filter((p) => p.raider_team === 'coed' || p.raider_team === 'both').length,
  }), [photos]);
  const visiblePhotos = useMemo(() => {
    if (teamFilter === 'all') return photos;
    return photos.filter((p) => p.raider_team === teamFilter || p.raider_team === 'both');
  }, [photos, teamFilter]);

  return (
    <div className="rhea">
      <div className="rhea-shell">
        <Header onHelp={() => setWalk(true)} />
        <BetaBanner />
        {gate.loading ? (
          <div className="rhea-wrap"><div className="rhea-feed-msg">LOADING…</div></div>
        ) : !gate.open ? (
          <OpticLocked opensAt={gate.opensAt} />
        ) : (
          <div className="rhea-wrap">
            <UploadCard eventId={config.eventId} />
            <Feed
              photos={visiblePhotos}
              loading={loading}
              error={error}
              likes={likes}
              onOpen={(i) => setReel(i)}
              filter={teamFilter}
              onFilterChange={setTeamFilter}
              counts={teamCounts}
            />
          </div>
        )}
      </div>

      {gate.open && reel !== null && visiblePhotos[reel] && (
        <Reel
          photos={visiblePhotos}
          index={reel}
          likes={likes}
          onIndex={setReel}
          onClose={() => setReel(null)}
        />
      )}

      {showWalk && (
        <Walkthrough onClose={() => { markWalkthroughOptic(); setWalk(false); }} />
      )}

      <PwaUpdateBar show={updateReady} />
    </div>
  );
}

function BetaBanner() {
  return (
    <div className="rhea-beta" role="note">
      <span className="rhea-beta-tag">BETA</span>
      <span>
        OPTIC is a test run for the SDHS JROTC comp. We may ask you
        for quick feedback afterward.
      </span>
    </div>
  );
}

// Countdown hold shown until the gate opens (scheduled time or Luke's manual
// override). uses a local 1 Hz tick; useOpticGate flips `open` when it lands.
function OpticLocked({ opensAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ms = Math.max(0, opensAt.getTime() - now);
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor(ms / 3600000) % 24;
  const mins = Math.floor(ms / 60000) % 60;
  const secs = Math.floor(ms / 1000) % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const when = opensAt.toLocaleString([], {
    weekday: 'long', hour: 'numeric', minute: '2-digit',
  });

  // No time left on the clock but the feed is still locked -> Luke has it
  // force-closed (the tri-state kill switch). Show a hold message, not a
  // frozen 00:00:00 countdown.
  const paused = ms <= 0;

  return (
    <div className="rhea-lock">
      <span className="rhea-lock-badge">BETA · SDHS JROTC</span>
      <OpticGlyph className="rhea-lock-glyph" />
      {paused ? (
        <>
          <h1 className="rhea-lock-h">The feed is <span className="accent">paused</span>.</h1>
          <p className="rhea-lock-p">
            Photos are on hold for a moment. Keep this page open , it comes back
            on its own the second it reopens, no refresh needed.
          </p>
        </>
      ) : (
        <>
          <h1 className="rhea-lock-h">The feed opens <span className="accent">{when}</span>.</h1>
          <p className="rhea-lock-p">
            Uploads and the live feed are locked until go time. You&apos;re on the
            list, nothing to do but be there. This is a one-event beta, so expect a
            short feedback ask after the competition.
          </p>

          <div className="rhea-cd" role="timer" aria-label="Time until the feed opens">
            {days > 0 && (
              <span className="rhea-cd-unit"><b>{days}</b><i>{days === 1 ? 'day' : 'days'}</i></span>
            )}
            <span className="rhea-cd-unit"><b>{pad(hrs)}</b><i>hrs</i></span>
            <span className="rhea-cd-sep">:</span>
            <span className="rhea-cd-unit"><b>{pad(mins)}</b><i>min</i></span>
            <span className="rhea-cd-sep">:</span>
            <span className="rhea-cd-unit"><b>{pad(secs)}</b><i>sec</i></span>
          </div>
        </>
      )}

      {!paused && <WhatsNew />}

      {!paused && (
        isStandalone() ? (
          <div className="rhea-lock-reinstall">
            <div className="rhea-lock-reinstall-t">HAD OPTIC BEFORE?</div>
            <p className="rhea-lock-hint">
              This is a rebuilt app, not an update — the icon already on your
              home screen won&apos;t get the new version on its own.
              Delete the old <b style={{ color: 'var(--cream)' }}>OPTIC</b> icon,
              then {isIos() ? 'tap the share icon below and Add to Home Screen again' : 'use your browser menu to install this one again'}.
              Takes ten seconds, and you only have to do it once.
            </p>
          </div>
        ) : (
          <p className="rhea-lock-hint">
            Add OPTIC to your home screen now so it&apos;s one tap when the feed opens.
          </p>
        )
      )}
    </div>
  );
}

const NEW_FEATURES = [
  ['◈', 'Filter the feed by team — Male or Coed, the #1 thing you asked for'],
  ['⬆', 'The upload cap that ate people’s photos mid-batch is gone'],
  ['🕐', 'Photos sort by when they were actually taken, not when they finished uploading'],
];

// Reveal panel on the locked/countdown screen — this is the surface almost
// everyone actually sees between the SQL landing and Saturday, including
// everyone with the old app already on their home screen (isStandalone()
// skips onboarding entirely), so the "we heard you" moment lives here, not
// buried in onboarding.
function WhatsNew() {
  return (
    <div className="rhea-whatsnew">
      <div className="rhea-whatsnew-kick">OPTIC 2.0 · BUILT FROM YOUR FEEDBACK</div>
      <p className="rhea-whatsnew-p">
        We read every response from the OPTIC survey. Here&apos;s what changed:
      </p>
      <ul className="rhea-whatsnew-list">
        {NEW_FEATURES.map(([icon, text]) => (
          <li key={text}>
            <span className="rhea-whatsnew-ico" aria-hidden="true">{icon}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
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
          <div className="rhea-title">SPRING HILL RAIDER CHALLENGE</div>
        </div>
        <div className="rhea-hdr-right">
          <button className="rhea-help" onClick={onHelp} aria-label="Show walkthrough">?</button>
          <Link to="/" className="rhea-link">MAIN SITE ↗</Link>
        </div>
      </div>
    </header>
  );
}

function UploadCard({ eventId }) {
  const [items, setItems] = useState([]); // {id,file,previewUrl,takenAt,status,error}
  const [name, setName] = useState('');
  const [rejected, setRejected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { getDeviceId(); }, []);
  useEffect(() => () => { itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl)); }, []); // eslint-disable-line

  // HEIC/HEIF (default iPhone camera roll) is decoded to JPEG in the browser
  // one file at a time — heic2any runs on the main thread and takes roughly a
  // second per photo, so sequential keeps a multi-photo drop from locking the
  // UI. On success the item swaps to the JPEG and joins the normal pending
  // queue; on failure it drops out and its name goes to the reject notice so
  // the parent gets the "switch to Most Compatible / send a screenshot" steer.
  const processHeic = useCallback(async (batch) => {
    for (const { id, file } of batch) {
      try {
        const jpeg = await convertHeicToJpeg(file);
        const previewUrl = URL.createObjectURL(jpeg);
        setItems((q) => {
          if (!q.some((x) => x.id === id)) { URL.revokeObjectURL(previewUrl); return q; }
          return q.map((x) => (x.id === id
            ? { ...x, file: jpeg, previewUrl, status: 'pending', error: null }
            : x));
        });
        posthog.capture('optic_heic_converted');
      } catch {
        setItems((q) => q.filter((x) => x.id !== id));
        setRejected((r) => (r.includes(file.name) ? r : [...r, file.name || 'HEIC photo']));
        posthog.capture('optic_heic_convert_failed');
      }
    }
  }, []);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    const native = files.filter(isAllowedImage);
    const heic = files.filter((f) => !isAllowedImage(f) && isHeic(f));
    const bad = files.filter((f) => !isAllowedImage(f) && !isHeic(f));

    setRejected(bad.map((f) => f.name));

    const nativeItems = native.map((file) => ({
      id: nextId(), file, previewUrl: URL.createObjectURL(file), takenAt: null, status: 'pending', error: null,
    }));
    const heicItems = heic.map((file) => ({
      id: nextId(), file, previewUrl: null, takenAt: null, status: 'converting', error: null,
    }));

    if (nativeItems.length || heicItems.length) {
      setItems((q) => [...q, ...nativeItems, ...heicItems]);
    }
    if (heicItems.length) processHeic(heicItems);

    // EXIF must come off the ORIGINAL file — resize/HEIC-convert strip it.
    // Read for every picked file (native + heic) in parallel; a slow/missing
    // EXIF read never blocks the upload, it just leaves taken_at null.
    [...nativeItems, ...heicItems].forEach(({ id, file }) => {
      readTakenAt(file).then((takenAt) => {
        if (!takenAt) return;
        setItems((q) => q.map((x) => (x.id === id ? { ...x, takenAt } : x)));
      });
    });
  }, [processHeic]);

  async function send() {
    const targets = itemsRef.current.filter((it) => it.status === 'pending' || it.status === 'failed');
    if (!targets.length || busy) return;
    setBusy(true);
    const deviceFp = await getDeviceId();
    let ok = 0;
    for (const it of targets) {
      setItems((q) => q.map((x) => (x.id === it.id ? { ...x, status: 'uploading', error: null } : x)));
      try {
        await uploadOpticPhoto(it.file, {
          source: 'parent', uploaderName: name, deviceFp, eventId, takenAt: it.takenAt,
        });
        ok += 1;
        setItems((q) => q.map((x) => (x.id === it.id ? { ...x, status: 'done' } : x)));
      } catch (err) {
        setItems((q) => q.map((x) => (x.id === it.id ? { ...x, status: 'failed', error: err?.message || 'Upload failed' } : x)));
      }
    }
    setBusy(false);
    if (ok > 0) posthog.capture('optic_parent_upload', { photo_count: ok });
  }

  function reset() {
    itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]); setRejected([]);
  }

  const pending = items.filter((it) => it.status === 'pending' || it.status === 'failed');
  const done = items.filter((it) => it.status === 'done');
  const converting = items.filter((it) => it.status === 'converting');
  const allDone = items.length > 0 && pending.length === 0 && converting.length === 0 && !busy;

  if (!eventId) {
    return (
      <section className="rhea-card">
        <div className="rhea-card-head">
          <div className="rhea-eyebrow">ADD YOUR PHOTOS</div>
          <div className="rhea-card-sub">
            Uploads aren&apos;t open yet — check back shortly.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rhea-card">
      <div className="rhea-card-head">
        <div className="rhea-eyebrow">ADD YOUR PHOTOS</div>
        <div className="rhea-card-sub">
          Shots from the stands go straight to the live feed below. No account needed.
        </div>
      </div>

      <div className="rhea-card-body">
        <input ref={inputRef} type="file" accept={OPTIC_ACCEPT_ATTR} multiple style={{ display: 'none' }}
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
                  {it.previewUrl
                    ? <img src={it.previewUrl} alt="" style={{ opacity: it.status === 'done' ? 0.5 : 1 }} />
                    : <span className="rhea-thumb-ph" />}
                  {it.status === 'converting' && <span className="rhea-thumb-badge" data-kind="working">⟳</span>}
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

        {converting.length > 0 && (
          <div className="rhea-note">
            Converting {converting.length} iPhone photo{converting.length === 1 ? '' : 's'}… this takes a
            second. Keep the page open.
          </div>
        )}

        {rejected.length > 0 && <div className="rhea-reject">{REJECT_MESSAGE}</div>}

        <input
          className="rhea-name"
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
        />

        {allDone ? (
          <>
            <div className="rhea-ok">
              ✓ {done.length} PHOTO{done.length === 1 ? '' : 'S'} ADDED. SCROLL DOWN TO SEE {done.length === 1 ? 'IT' : 'THEM'} IN THE FEED
            </div>
            <button className="rhea-btn rhea-btn--ghost" onClick={reset}>ADD MORE</button>
          </>
        ) : (
          <button
            className="rhea-btn"
            onClick={send}
            disabled={busy || converting.length > 0 || pending.length === 0}
          >
            {busy
              ? `UPLOADING… ${done.length}/${items.length}`
              : converting.length > 0
                ? `CONVERTING ${converting.length} PHOTO${converting.length === 1 ? '' : 'S'}…`
                : `POST ${pending.length || ''} PHOTO${pending.length === 1 ? '' : 'S'}`.trim()}
          </button>
        )}
      </div>
    </section>
  );
}

function Feed({ photos, loading, error, likes, onOpen, filter, onFilterChange, counts }) {
  return (
    <section>
      <div className="rhea-live">
        <span className="rhea-live-dot" />
        <span className="rhea-live-label">LIVE FEED</span>
        <span className="rhea-live-count">
          {photos.length} PHOTO{photos.length === 1 ? '' : 'S'}
        </span>
      </div>

      <div className="rhea-fchips" role="group" aria-label="Filter by team">
        {TEAM_FILTERS.map((t) => (
          <button
            key={t.id}
            className="rhea-fchip"
            data-on={filter === t.id}
            aria-pressed={filter === t.id}
            onClick={() => onFilterChange(t.id)}
          >
            {t.label}<span className="rhea-fchip-n">{counts[t.id] ?? 0}</span>
          </button>
        ))}
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
        <div className="rhea-feed-msg" data-err="true">FEED ERROR: {error}</div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div className="rhea-empty">
          {filter === 'all' ? 'No photos yet. Be the first, add one above.' : 'No photos tagged to this team yet.'}
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div className="rhea-feed">
          {photos.map((p, i) => (
            <FeedItem
              key={p.id}
              photo={p}
              pos={i}
              liked={likes.isLiked(p.id)}
              likeCount={likes.countFor(p)}
              onLike={() => likes.toggle(p)}
              onOpen={() => onOpen(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedItem({ photo, pos, liked, likeCount, onLike, onOpen }) {
  const chip = feedChip(photo);
  const who = feedAttribution(photo);
  const isLuke = photo.source === 'luke';
  return (
    <figure className="rhea-item" style={{ '--d': `${Math.min(pos, 8) * 45}ms` }}>
      <div className="rhea-shot-wrap">
        <button className="rhea-shot" onClick={onOpen} aria-label="Open photo reel">
          <img src={photo.photo_url} alt="" loading="lazy" />
        </button>
        <button
          className="rhea-like"
          data-on={liked}
          onClick={(e) => { e.stopPropagation(); onLike(); }}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike photo' : 'Like photo'}
        >
          <span className="rhea-like-ico">{liked ? '♥' : '♡'}</span>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      </div>
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

// ── shorts-style vertical photo reel ─────────────────────────────────────
function Reel({ photos, index, likes, onIndex, onClose }) {
  const reelRef = useRef(null);
  const [cur, setCur] = useState(index);
  const curRef = useRef(index);
  const [burstKey, setBurstKey] = useState(0);
  const lastTap = useRef(0);

  // Jump to the tapped photo on open + lock the page behind.
  useEffect(() => {
    const el = reelRef.current;
    if (el) el.scrollTop = index * el.clientHeight;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = reelRef.current;
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose();
      if (!el) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') el.scrollBy({ top: el.clientHeight, behavior: 'smooth' });
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onScroll(e) {
    const el = e.currentTarget;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== curRef.current && i >= 0 && i < photos.length) {
      curRef.current = i;
      setCur(i);
      onIndex(i);
    }
  }

  function onPageTap(photo) {
    const now = Date.now();
    if (now - lastTap.current < 300) {   // double-tap = like (Instagram gesture)
      if (!likes.isLiked(photo.id)) likes.toggle(photo);
      setBurstKey((k) => k + 1);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  async function share(photo) {
    const url = photo.photo_url;
    const who = feedAttribution(photo);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'OPTIC', text: `Photo by ${who}`, url });
        posthog.capture('optic_photo_share', { photo_id: photo.id });
        return;
      }
    } catch { /* cancelled / unsupported */ }
    try { await navigator.clipboard?.writeText(url); } catch { /* no clipboard */ }
  }

  return (
    <div className="rhea-lb" role="dialog" aria-label="Photo reel">
      <div className="rhea-lb-top">
        <span className="rhea-lb-idx">{cur + 1} / {photos.length}</span>
        <button className="rhea-lb-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="rhea-reel" ref={reelRef} onScroll={onScroll}>
        {photos.map((p, i) => {
          const near = Math.abs(i - cur) <= 2;
          const who = feedAttribution(p);
          const chip = feedChip(p);
          const isLiked = likes.isLiked(p.id);
          return (
            <div className="rhea-page" key={p.id} onClick={() => onPageTap(p)}>
              {near && (
                <>
                  <div className="rhea-page-bg" style={{ backgroundImage: `url(${p.photo_url})` }} />
                  <img className="rhea-page-img" src={p.photo_url} alt="" draggable="false" />
                </>
              )}

              {i === cur && burstKey > 0 && (
                <span className="rhea-burst" key={burstKey}>♥</span>
              )}

              <div className="rhea-rail">
                <button
                  className="rhea-rail-btn"
                  data-on={isLiked}
                  onClick={(e) => { e.stopPropagation(); likes.toggle(p); }}
                  aria-pressed={isLiked}
                  aria-label={isLiked ? 'Unlike' : 'Like'}
                >
                  <span className="rhea-rail-ico">{isLiked ? '♥' : '♡'}</span>
                  <span>{likes.countFor(p) || 'LIKE'}</span>
                </button>
                <button className="rhea-rail-btn" onClick={(e) => { e.stopPropagation(); share(p); }} aria-label="Share">
                  <span className="rhea-rail-ico">⇪</span><span>SHARE</span>
                </button>
                <button
                  className="rhea-rail-btn"
                  onClick={(e) => { e.stopPropagation(); downloadPhoto(p.photo_url, `optic_${p.id}.jpg`); }}
                  aria-label="Save"
                >
                  <span className="rhea-rail-ico">⬇</span><span>SAVE</span>
                </button>
              </div>

              <div className="rhea-page-meta">
                <div className="rhea-page-who" data-luke={p.source === 'luke'}>{who}</div>
                <div className="rhea-page-line">
                  {chip && <span className="rhea-chip">{chip}</span>}
                  <span className="rhea-time">
                    {new Date(p.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cur === 0 && photos.length > 1 && (
        <div className="rhea-scroll-hint">SWIPE UP FOR MORE</div>
      )}
    </div>
  );
}

// ── first-launch walkthrough (installed app only) ─────────────────────────
const WALK_STEPS = [
  {
    glyph: '📡',
    step: 'STEP 1 / 3',
    h: <>One live feed for <span className="accent">the whole day.</span></>,
    p: 'Every family and cadet posts to the same feed. It updates on its own as photos come in. No refresh, no hunting for a link.',
  },
  {
    glyph: '↕',
    step: 'STEP 2 / 3',
    h: <>Tap a photo, then <span className="accent">scroll like Shorts.</span></>,
    p: 'It opens full screen. Swipe up and down to move through the day. Double-tap a photo to like it, or use the heart on the side.',
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
    if (last) { posthog.capture('optic_walkthrough_done'); onClose(); }
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
          {!last && <button className="rhea-wt-skip" onClick={() => { posthog.capture('optic_walkthrough_skip'); onClose(); }}>Skip</button>}
          <button className="rhea-wt-next" onClick={next}>{last ? 'GOT IT' : 'NEXT'}</button>
        </div>
      </div>
    </div>
  );
}
