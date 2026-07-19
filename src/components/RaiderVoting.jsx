import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#27AE60', red: '#C0392B',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
const inter = 'Inter, sans-serif';
const PAGE_SIZE = 24;

const CATS = [
  { key: 'funny', label: 'FUNNY',        field: 'votes_funny', blurb: 'Best laugh' },
  { key: 'aura',  label: 'AURA',         field: 'votes_aura',  blurb: 'Most presence' },
  { key: 'team',  label: 'TEAM LEADING', field: 'votes_team',  blurb: 'Best leadership' },
];

function fmtCountdown(ms) {
  if (ms <= 0) return 'CLOSED';
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Raiders 3-category photo voting. Reads photos where team='raiders'.
 * Embeddable on the Raiders page and the submit hub. Upload lives elsewhere.
 * @param {(id:string)=>void} [setActive] router; enables the "Submit a photo" link
 * @param {boolean} [compact] tighter padding when embedded in a page section
 */
export default function RaiderVoting({ setActive, compact = false }) {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cat, setCat] = useState('funny');
  const [myVotes, setMyVotes] = useState({});
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState('');

  useEffect(() => { getDeviceId().then(setDeviceId); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  const loadEvents = useCallback(async () => {
    const [{ data: evs }, { data: polls }] = await Promise.all([
      SB.from('events').select('*').order('date', { ascending: false }),
      SB.from('polls').select('*').eq('team', 'raiders'),
    ]);
    const byEvent = Object.fromEntries((polls || []).map((p) => [p.event_id, p]));
    const merged = (evs || []).map((e) => ({ ...e, poll: byEvent[e.id] || null }));
    setEvents(merged);
    setLoading(false);
    return merged;
  }, []);

  const loadPhotos = useCallback(async (event) => {
    setSelected(event);
    setPhotos([]);
    setVisibleCount(PAGE_SIZE);
    const { data } = await SB.from('photos')
      .select('*')
      .eq('team', 'raiders')
      .eq('event_id', event.id)
      .eq('status', 'live')
      .order('created_at', { ascending: false });
    setPhotos(data || []);
  }, []);

  const loadMyVotes = useCallback(async (poll, fp) => {
    if (!poll || !fp) { setMyVotes({}); return; }
    const { data } = await SB.from('votes').select('category, photo_id').eq('poll_id', poll.id).eq('device_fp', fp);
    setMyVotes(Object.fromEntries((data || []).map((v) => [v.category, v.photo_id])));
  }, []);

  useEffect(() => {
    (async () => {
      const merged = await loadEvents();
      if (!merged.length) return;
      const pick = merged.find((e) => e.poll) || merged[0];
      await loadPhotos(pick);
    })();
  }, [loadEvents, loadPhotos]);

  useEffect(() => { loadMyVotes(selected?.poll, deviceId); }, [selected, deviceId, loadMyVotes]);

  const poll = selected?.poll || null;
  const closesAt = poll?.closes_at ? new Date(poll.closes_at).getTime() : null;
  const isOpen = poll?.status === 'open' && (closesAt == null || now < closesAt);
  const isClosing = poll?.status === 'open' && closesAt != null && now >= closesAt;
  const isClosed = poll?.status === 'closed';
  const canVote = isOpen && !!deviceId;

  async function vote(photo) {
    if (!canVote || voting) return;
    setVoting(photo.id);
    const { error } = await SB.rpc('cast_vote', { p_poll: poll.id, p_photo: photo.id, p_category: cat, p_fp: deviceId });
    if (!error) {
      await loadPhotos(selected);
      setMyVotes((v) => ({ ...v, [cat]: photo.id }));
    } else {
      setErr(`Vote failed: ${error.message}`);
      setTimeout(() => setErr(''), 4000);
    }
    setVoting(null);
  }

  const activeCat = CATS.find((c) => c.key === cat);
  const sorted = (isClosed || isClosing) ? [...photos].sort((a, b) => b[activeCat.field] - a[activeCat.field]) : photos;
  const shown = sorted.slice(0, visibleCount);
  const myPick = myVotes[cat];
  const winners = isClosed ? CATS.map((c) => ({ cat: c, photo: photos.find((p) => p.id === poll[`winner_${c.key}`]) || null })) : [];

  const pad = compact ? 0 : 8;

  if (loading) return <div style={loadingStyle}>LOADING VOTING…</div>;

  return (
    <div style={{ fontFamily: inter }}>
      {/* Event selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {events.map((ev) => {
          const on = selected?.id === ev.id;
          const badge = ev.poll?.status === 'open' ? '● LIVE' : ev.poll?.status === 'closed' ? '✓ RESULTS' : '';
          return (
            <button key={ev.id} onClick={() => loadPhotos(ev)}
              style={{
                background: on ? P.gold : 'transparent', border: `1px solid ${on ? P.gold : P.hair}`,
                color: on ? P.ink : P.cream, fontFamily: mono, fontSize: 10, letterSpacing: '0.14em',
                padding: '8px 14px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center',
              }}>
              {ev.title.toUpperCase()}
              {badge && <span style={{ color: on ? P.ink : (ev.poll.status === 'open' ? P.green : P.gold), fontSize: 8 }}>{badge}</span>}
            </button>
          );
        })}
        {!events.length && <div style={{ fontFamily: mono, fontSize: 10, color: P.mute }}>NO EVENTS YET</div>}
      </div>

      {selected && (
        <>
          {/* Poll status */}
          <div style={{ padding: '16px 20px', background: P.deep, border: `1px solid ${isOpen ? P.hairStrong : P.hair}`, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={statLabel}>POLL STATUS</div>
              <div style={{ fontFamily: oswald, fontSize: 18, letterSpacing: '0.08em', color: isOpen ? P.green : isClosed ? P.bright : P.mute }}>
                {isOpen ? 'VOTING LIVE' : isClosing ? 'CLOSING…' : isClosed ? 'RESULTS FINAL' : 'VOTING NOT OPEN'}
              </div>
            </div>
            {isOpen && closesAt && (
              <div style={{ borderLeft: `1px solid ${P.hair}`, paddingLeft: 20 }}>
                <div style={statLabel}>CLOSES IN</div>
                <div style={{ fontFamily: oswald, fontSize: 18, color: P.cream }}>{fmtCountdown(closesAt - now)}</div>
              </div>
            )}
            {!poll && <div style={{ fontFamily: inter, fontSize: 12, color: P.mute }}>Voting opens when an admin starts the poll for this event.</div>}
            {isClosing && <div style={{ fontFamily: inter, fontSize: 12, color: P.mute }}>Deadline reached — winners are being finalized.</div>}
            {setActive && (
              <button onClick={() => setActive('submit')} style={{ ...ghostBtn, marginLeft: 'auto' }}>+ SUBMIT A PHOTO</button>
            )}
          </div>

          {/* Winners */}
          {isClosed && winners.some((w) => w.photo) && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.28em', marginBottom: 12 }}>🏆 WINNERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {winners.map(({ cat: c, photo }) => (
                  <div key={c.key} style={{ background: P.navy, border: `1px solid ${P.hairStrong}` }}>
                    <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: P.deep }}>
                      {photo ? <img src={photo.thumb_url || photo.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ ...centered, color: P.mute, fontFamily: mono, fontSize: 10 }}>NO VOTES</div>}
                      <div style={{ position: 'absolute', top: 8, left: 8, background: P.gold, color: P.ink, fontFamily: mono, fontSize: 9, padding: '3px 8px', letterSpacing: '0.1em' }}>{c.label}</div>
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontFamily: mono, fontSize: 10, color: P.cream }}>{photo ? `${photo[c.field]} VOTES` : '—'}</div>
                      {photo?.uploader_name && <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 2 }}>📷 {photo.uploader_name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category tabs */}
          {(isOpen || isClosed || isClosing) && (
            <div style={{ marginTop: 24, display: 'flex', gap: 6, borderBottom: `1px solid ${P.hair}`, paddingBottom: 2 }}>
              {CATS.map((c) => {
                const on = cat === c.key;
                return (
                  <button key={c.key} onClick={() => setCat(c.key)}
                    style={{ background: on ? P.deep : 'transparent', border: 'none', borderBottom: `2px solid ${on ? P.gold : 'transparent'}`, padding: '10px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: oswald, fontSize: 15, letterSpacing: '0.08em', color: on ? P.cream : P.mute }}>{c.label}</span>
                    <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.1em', color: on ? P.gold : P.mute }}>{c.blurb}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Grid */}
          <div style={{ paddingTop: 24 }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.2em', marginBottom: 16 }}>
              {photos.length} PHOTOS
              {isOpen && ` · TAP TO PICK YOUR ${activeCat.label} FAVORITE`}
              {isClosed && ` · RANKED BY ${activeCat.label} VOTES`}
            </div>
            {err && <div style={{ fontFamily: mono, fontSize: 10, color: P.red, marginBottom: 12 }}>{err}</div>}

            {!photos.length ? (
              <div style={{ ...loadingStyle, padding: 48 }}>NO PHOTOS FOR THIS EVENT YET</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {shown.map((photo) => {
                    const picked = myPick === photo.id;
                    const count = photo[activeCat.field];
                    return (
                      <div key={photo.id} style={{ position: 'relative', overflow: 'hidden', background: P.deep, border: `2px solid ${picked ? P.gold : 'transparent'}` }}>
                        <img src={photo.thumb_url || photo.photo_url} alt="" loading="lazy" onClick={() => setLightbox(photo)}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', cursor: 'pointer' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(6,16,31,0.92) 0%, transparent 100%)', padding: '22px 10px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <span style={{ fontFamily: mono, fontSize: 10, color: P.cream }}><span style={{ color: P.gold }}>{count}</span> {activeCat.label.slice(0, 4)}</span>
                          {isOpen && (
                            <button onClick={(e) => { e.stopPropagation(); vote(photo); }} disabled={!canVote || voting === photo.id}
                              style={{ background: picked ? P.gold : 'transparent', border: `1px solid ${picked ? P.gold : P.hairStrong}`, color: picked ? P.ink : P.cream, fontFamily: mono, fontSize: 9, padding: '4px 9px', cursor: canVote ? 'pointer' : 'default', letterSpacing: '0.1em' }}>
                              {picked ? '✓ PICK' : 'PICK'}
                            </button>
                          )}
                        </div>
                        {photo.uploader_name && <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(6,16,31,0.7)', color: P.mute, fontFamily: mono, fontSize: 8, padding: '2px 6px' }}>📷 {photo.uploader_name}</div>}
                      </div>
                    );
                  })}
                </div>
                {visibleCount < photos.length && (
                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} style={ghostBtn}>LOAD MORE ({photos.length - visibleCount})</button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }}>
            <img src={lightbox.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: '86vh', objectFit: 'contain', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(6,16,31,0.85)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: P.gold }}>{lightbox.uploader_name ? `📷 ${lightbox.uploader_name}` : 'RAIDER COMPETITION'}</span>
              {isOpen && (
                <button onClick={() => vote(lightbox)} disabled={!canVote}
                  style={{ background: myPick === lightbox.id ? P.gold : 'transparent', border: `1px solid ${myPick === lightbox.id ? P.gold : P.hairStrong}`, color: myPick === lightbox.id ? P.ink : P.cream, fontFamily: mono, fontSize: 10, padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.12em' }}>
                  {myPick === lightbox.id ? `✓ ${activeCat.label}` : `PICK ${activeCat.label}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const loadingStyle = { textAlign: 'center', padding: 60, fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.2em' };
const statLabel = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.24em', marginBottom: 4 };
const centered = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const ghostBtn = { background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.gold, fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', padding: '9px 18px', cursor: 'pointer' };
