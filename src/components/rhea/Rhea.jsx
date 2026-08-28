import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDeviceId } from '../../lib/fingerprint';
import { useRheaPhotos } from '../../hooks/useRheaPhotos';
import {
  uploadRheaPhoto, isAllowedImage, ACCEPT_ATTR, REJECT_MESSAGE,
  feedAttribution, feedChip, downloadPhoto,
} from '../../lib/rheaComp';
import { installRheaPwaHooks, isStandalone } from './pwa';
import RheaOnboarding from './RheaOnboarding';
import { hasOnboardedRhea } from '../../lib/rheaComp';
import posthog from '../../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', navyDeep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.62)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.5)',
  green: '#4FB477', red: '#C0392B',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
const inter = 'Inter, sans-serif';

let uid = 0;
const nextId = () => `u${Date.now()}_${uid++}`;

// ── /rhea — public parent upload + live feed. Hardcoded to one event. Zero
// navigation: landing on the link IS the flow. Mobile-first (parents in the
// stands on phones). Parent photos go live immediately (visibility='public',
// no staging), and the feed below streams every public photo (parent + Luke's
// published) in realtime.
export default function Rhea() {
  // Skip the first-run flow for anyone already running the installed app, or
  // who has been through it once on this device.
  const [onboarded, setOnboarded] = useState(() => isStandalone() || hasOnboardedRhea());

  // Register the installable-viewer identity as soon as /rhea mounts so the
  // browser's install prompt is available by the time the flow asks for it.
  useEffect(() => { installRheaPwaHooks(); }, []);

  if (!onboarded) return <RheaOnboarding onDone={() => setOnboarded(true)} />;

  return (
    <div style={{ minHeight: '100vh', background: P.ink, color: P.cream, fontFamily: inter }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 96px' }}>
        <UploadCard />
        <Feed />
      </div>
    </div>
  );
}

function Header() {
  return (
    <header style={{
      borderBottom: `1px solid ${P.hair}`, background: P.navyDeep,
      padding: '18px 16px', position: 'sticky', top: 0, zIndex: 20,
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '0.34em', color: P.gold }}>
            SDHS JROTC · OPTIC
          </div>
          <div style={{ fontFamily: oswald, fontSize: 20, letterSpacing: '0.04em', color: P.cream, lineHeight: 1.1, marginTop: 2 }}>
            RHEA COUNTY RAIDER COMP
          </div>
        </div>
        <Link to="/" style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.16em', color: P.faint, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          MAIN SITE ↗
        </Link>
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
    <section style={{ marginTop: 20, background: P.navy, border: `1px solid ${P.hair}` }}>
      <div style={{ padding: '16px 16px 4px' }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.22em', color: P.gold }}>
          ADD YOUR PHOTOS
        </div>
        <div style={{ fontFamily: inter, fontSize: 12.5, color: P.mute, marginTop: 4, lineHeight: 1.5 }}>
          Shots from the stands go straight to the live feed below. No account needed.
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) addFiles(e.dataTransfer.files); }}
          style={{
            border: `1px dashed ${dragOver ? P.gold : P.hairStrong}`,
            background: dragOver ? 'rgba(201,169,97,0.06)' : P.navyDeep,
            padding: items.length ? 14 : '36px 16px', textAlign: 'center',
            cursor: busy ? 'not-allowed' : 'pointer', transition: 'all .15s',
          }}>
          {items.length === 0 ? (
            <>
              <div style={{ fontSize: 26, color: P.gold, opacity: 0.7 }}>＋</div>
              <div style={{ fontFamily: oswald, fontSize: 15, letterSpacing: '0.05em', marginTop: 6 }}>
                TAP TO CHOOSE PHOTOS
              </div>
              <div style={{ fontFamily: mono, fontSize: 8.5, color: P.faint, letterSpacing: '0.14em', marginTop: 6 }}>
                JPG / PNG · PICK SEVERAL AT ONCE
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {items.map((it) => (
                <div key={it.id} style={{ position: 'relative', flexShrink: 0, width: 76, height: 76, border: `1px solid ${it.status === 'failed' ? P.red : P.hair}` }}>
                  <img src={it.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: it.status === 'done' ? 0.5 : 1 }} />
                  {it.status === 'uploading' && <span style={tileTag}>…</span>}
                  {it.status === 'done' && <span style={{ ...tileTag, background: 'rgba(79,180,119,0.9)', color: P.ink }}>✓</span>}
                  {it.status === 'failed' && <span style={{ ...tileTag, background: 'rgba(192,57,43,0.9)' }}>✕</span>}
                  {it.status === 'pending' && !busy && (
                    <button onClick={(e) => { e.stopPropagation(); setItems((q) => q.filter((x) => x.id !== it.id)); URL.revokeObjectURL(it.previewUrl); }}
                      style={{ position: 'absolute', top: 0, right: 0, border: 'none', background: 'rgba(6,16,31,0.8)', color: P.cream, fontSize: 12, lineHeight: 1, padding: '2px 5px', cursor: 'pointer' }}>×</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {rejected.length > 0 && (
          <div style={{ marginTop: 10, border: `1px solid ${P.red}`, background: 'rgba(192,57,43,0.08)', padding: '9px 11px', fontFamily: inter, fontSize: 11.5, color: '#EBB4AC', lineHeight: 1.5 }}>
            {REJECT_MESSAGE}
          </div>
        )}

        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, background: P.navyDeep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: inter, fontSize: 14, padding: '11px 12px', outline: 'none' }} />

        {allDone ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ border: `1px solid ${P.green}`, background: 'rgba(79,180,119,0.1)', padding: '11px 13px', fontFamily: mono, fontSize: 12, letterSpacing: '0.06em', color: '#9FE0BB' }}>
              ✓ {done.length} PHOTO{done.length === 1 ? '' : 'S'} ADDED — SCROLL DOWN TO SEE {done.length === 1 ? 'IT' : 'THEM'} IN THE FEED
            </div>
            <button onClick={reset} style={{ ...goldBtn, width: '100%', marginTop: 10 }}>ADD MORE</button>
          </div>
        ) : (
          <button onClick={send} disabled={busy || pending.length === 0}
            style={{ ...goldBtn, width: '100%', marginTop: 12, opacity: busy || pending.length === 0 ? 0.4 : 1, cursor: busy || pending.length === 0 ? 'not-allowed' : 'pointer' }}>
            {busy ? `UPLOADING… ${done.length}/${items.length}` : `POST ${pending.length || ''} PHOTO${pending.length === 1 ? '' : 'S'}`.trim()}
          </button>
        )}
      </div>
    </section>
  );
}

function Feed() {
  const { photos, loading, error } = useRheaPhotos({ scope: 'public' });

  return (
    <section style={{ marginTop: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 7, height: 7, background: P.green, borderRadius: '50%', boxShadow: `0 0 0 3px rgba(79,180,119,0.25)` }} />
        <h2 style={{ fontFamily: oswald, fontSize: 18, letterSpacing: '0.06em', color: P.cream, margin: 0 }}>
          LIVE FEED
        </h2>
        <span style={{ fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.14em', marginLeft: 'auto' }}>
          {photos.length} PHOTO{photos.length === 1 ? '' : 'S'}
        </span>
      </div>

      {loading && <div style={{ fontFamily: mono, fontSize: 10, color: P.faint, letterSpacing: '0.2em', padding: '24px 0' }}>LOADING…</div>}
      {error && !loading && (
        <div style={{ fontFamily: mono, fontSize: 10, color: '#EBB4AC', letterSpacing: '0.08em', padding: '16px 0' }}>
          FEED ERROR — {error}
        </div>
      )}
      {!loading && !error && photos.length === 0 && (
        <div style={{ border: `1px dashed ${P.hair}`, padding: '32px 16px', textAlign: 'center', fontFamily: inter, fontSize: 13, color: P.mute }}>
          No photos yet. Be the first — add one above.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {photos.map((p) => <FeedItem key={p.id} photo={p} />)}
      </div>
    </section>
  );
}

function FeedItem({ photo }) {
  const chip = feedChip(photo);
  const who = feedAttribution(photo);
  const isLuke = photo.source === 'luke';
  return (
    <figure style={{ margin: 0, background: P.navy, border: `1px solid ${P.hair}` }}>
      <div style={{ position: 'relative', background: P.navyDeep }}>
        <img src={photo.photo_url} alt="" loading="lazy"
          style={{ display: 'block', width: '100%', height: 'auto' }} />
        <button
          onClick={() => downloadPhoto(photo.photo_url, `rhea_${photo.id}.jpg`)}
          aria-label="Download photo"
          style={{
            position: 'absolute', bottom: 8, right: 8, border: `1px solid ${P.hairStrong}`,
            background: 'rgba(6,16,31,0.72)', color: P.cream, fontFamily: mono, fontSize: 9,
            letterSpacing: '0.12em', padding: '6px 10px', cursor: 'pointer', backdropFilter: 'blur(4px)',
          }}>
          ⬇ SAVE
        </button>
      </div>
      <figcaption style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: inter, fontSize: 12.5,
          color: isLuke ? P.bright : P.cream, fontWeight: isLuke ? 600 : 400,
        }}>
          {who}
        </span>
        {chip && (
          <span style={{
            fontFamily: mono, fontSize: 8.5, letterSpacing: '0.1em', color: P.gold,
            border: `1px solid ${P.hair}`, padding: '3px 7px', textTransform: 'uppercase',
          }}>
            {chip}
          </span>
        )}
        <time style={{ fontFamily: mono, fontSize: 8.5, color: P.faint, letterSpacing: '0.08em', marginLeft: 'auto' }}>
          {new Date(photo.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </time>
      </figcaption>
    </figure>
  );
}

const goldBtn = {
  background: P.gold, color: P.ink, border: 'none',
  fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, padding: '13px 16px', cursor: 'pointer',
};
const tileTag = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(6,16,31,0.5)', fontFamily: mono, fontSize: 15, color: P.cream,
};
