import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';
import { resizeForUpload } from '../lib/imageResize';
import { TEAMS } from '../lib/teams';
import posthog from '../lib/posthog';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#27AE60', red: '#C0392B',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
const inter = 'Inter, sans-serif';
const BUCKET = 'team-photos';

// Upload targets = general Battalion (default, most photos) + the 4 specialty
// teams. Battalion is NOT in lib/teams.js on purpose — it must not appear in the
// public nav / team pages, only here as a submission bucket (team='battalion').
const BATTALION_OPT = { id: 'battalion', label: 'Battalion', accent: '#F4ECD8', voting: false };
const UPLOAD_OPTIONS = [BATTALION_OPT, ...TEAMS];
const getOption = (id) => UPLOAD_OPTIONS.find((t) => t.id === id) || null;

// Small numbered step badge — gives the two required decisions a clear order
// instead of every control reading with the same visual weight.
function StepBadge({ n }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: '50%', background: 'rgba(201,169,97,0.16)',
      color: P.gold, fontFamily: mono, fontSize: 10, fontWeight: 600, flexShrink: 0,
    }}>{n}</span>
  );
}

// Corner-bracket frame — reused site motif.
function Brackets({ color = P.gold }) {
  const c = [
    { top: 8, left: 8, borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` },
    { top: 8, right: 8, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` },
    { bottom: 8, left: 8, borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` },
    { bottom: 8, right: 8, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` },
  ];
  return c.map((s, i) => <div key={i} style={{ position: 'absolute', width: 14, height: 14, pointerEvents: 'none', ...s }} />);
}

/**
 * Premium public photo submission flow. Every team requires a posted event —
 * no event, no upload path (photos.photos_event_required_trg enforces this
 * server-side too; the UI just keeps staff/cadets from hitting that error).
 * Event drives team (each posted event already belongs to one team or none),
 * so the form asks a single required question first — which event — instead
 * of team-then-event picking the same thing twice. Photos stay locked out
 * until an event is chosen. Supports selecting several photos at once
 * (mobile camera-roll multi-select) and uploads them sequentially, mirroring
 * the admin bulk-upload flow.
 * @param {string} [presetTeam] lock the event list to this team's events
 * @param {(photo:object)=>void} [onUploaded] callback after each successful post
 */
export default function PhotoUploader({ presetTeam = null, onUploaded }) {
  const [searchParams] = useSearchParams();
  const urlEventId = searchParams.get('event') || '';
  const [items, setItems] = useState([]); // { id, file, previewUrl, status: pending|uploading|done|error, error }
  const [credit, setCredit] = useState('');
  const [allEvents, setAllEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | uploading | success
  const [postedCount, setPostedCount] = useState(0);
  const [rejected, setRejected] = useState([]);
  const inputRef = useRef();

  // presetTeam callers (e.g. a team's own page) only ever see that team's
  // events; the general /submit form sees every posted event across teams.
  const events = presetTeam
    ? allEvents.filter((e) => (presetTeam === 'battalion' ? !e.team : e.team === presetTeam))
    : allEvents;
  const selectedEvent = events.find((e) => e.id === eventId) || null;
  const team = selectedEvent ? (selectedEvent.team || 'battalion') : presetTeam;
  const teamCfg = getOption(team);

  // Warm the fingerprint cache early so the first per-photo upload isn't
  // stalled waiting on it.
  useEffect(() => { getDeviceId(); }, []);

  useEffect(() => {
    SB.from('events').select('id, title, date, team').eq('status', 'posted').order('date', { ascending: false })
      .then(({ data }) => setAllEvents(data || []));
  }, []);

  // ?event=<id> deep link (e.g. from OpticSend reminder emails).
  useEffect(() => {
    if (!urlEventId || !allEvents.length) return;
    if (allEvents.some((e) => e.id === urlEventId)) setEventId(urlEventId);
  }, [urlEventId, allEvents]);

  // Revoke every preview object URL on unmount to avoid leaks.
  useEffect(() => () => { items.forEach((it) => URL.revokeObjectURL(it.previewUrl)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    const images = files.filter((f) => f.type.startsWith('image/'));
    const skipped = files.filter((f) => !f.type.startsWith('image/'));
    if (skipped.length) setRejected((r) => [...r, ...skipped.map((f) => f.name)]);
    if (images.length) {
      setItems((q) => [
        ...q,
        ...images.map((file) => ({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file, previewUrl: URL.createObjectURL(file), status: 'pending', error: null,
        })),
      ]);
    }
  }, []);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (eventId) addFiles(e.dataTransfer.files);
  }

  function removeItem(id) {
    setItems((q) => {
      const it = q.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return q.filter((x) => x.id !== id);
    });
  }

  function changeEvent(id) {
    setEventId(id);
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    setRejected([]);
  }

  function reset() {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]); setCredit(''); setEventId('');
    setPhase('idle'); setPostedCount(0); setRejected([]);
  }

  const pendingCount = items.filter((it) => it.status !== 'done').length;
  const canSubmit = items.length > 0 && eventId && phase !== 'uploading' && pendingCount > 0;

  async function uploadOne(item) {
    setItems((q) => q.map((it) => (it.id === item.id ? { ...it, status: 'uploading' } : it)));
    try {
      const deviceId = await getDeviceId();
      const { full, thumb } = await resizeForUpload(item.file);
      const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const base = `${team}/${eventId}/${stamp}`;

      const up1 = await SB.storage.from(BUCKET).upload(`${base}.jpg`, full, { contentType: 'image/jpeg' });
      if (up1.error) throw up1.error;
      const up2 = await SB.storage.from(BUCKET).upload(`${base}_t.jpg`, thumb, { contentType: 'image/jpeg' });
      if (up2.error) throw up2.error;

      const photoUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}.jpg`).data.publicUrl;
      const thumbUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}_t.jpg`).data.publicUrl;

      const { data, error } = await SB.from('photos').insert({
        team,
        event_id: eventId,
        storage_path: `${base}.jpg`,
        photo_url: photoUrl,
        thumb_url: thumbUrl,
        uploader_name: credit.trim() || null,
        uploader_fp: deviceId,
      }).select().single();
      if (error) throw error;

      setItems((q) => q.map((it) => (it.id === item.id ? { ...it, status: 'done' } : it)));
      URL.revokeObjectURL(item.previewUrl);
      onUploaded?.(data);
      return true;
    } catch (err) {
      setItems((q) => q.map((it) => (it.id === item.id ? { ...it, status: 'error', error: err.message || String(err) } : it)));
      return false;
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setPhase('uploading');
    let ok = 0;
    // Sequential on purpose — mirrors admin bulk upload, avoids slamming
    // storage with N parallel uploads from a single phone on event wifi.
    const toRun = items.filter((it) => it.status !== 'done');
    for (const item of toRun) {
      if (await uploadOne(item)) ok++;
    }
    setPhase('idle');
    if (ok > 0) {
      posthog.capture('photo_submission_completed', {
        photo_count: ok,
        team: team || 'battalion',
        is_competition_submission: Boolean(teamCfg?.voting),
      });
    }
    setPostedCount((c) => c + ok);
    // Drop everything that finished; anything still errored stays queued for retry.
    setItems((q) => q.filter((it) => it.status !== 'done'));
  }

  const allDone = phase === 'idle' && items.length === 0 && postedCount > 0;

  // ── Success state ─────────────────────────────────────────────
  if (allDone) {
    return (
      <div style={{ ...panel, textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>✓</div>
        <div style={{ fontFamily: oswald, fontSize: 26, letterSpacing: '0.06em', color: P.cream }}>
          {postedCount === 1 ? 'PHOTO POSTED' : `${postedCount} PHOTOS POSTED`}
        </div>
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginTop: 8, maxWidth: 360, marginInline: 'auto' }}>
          Added to the {teamCfg?.label} gallery{teamCfg?.voting ? '. They can be voted on while the poll is open.' : '.'}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={reset} style={btnGold}>+ ADD MORE PHOTOS</button>
        </div>
      </div>
    );
  }

  const busy = phase === 'uploading';
  const errorItems = items.filter((it) => it.status === 'error');
  const photosEnabled = !!eventId;

  return (
    <div style={panel}>
      {/* Step 1 — event (this alone determines the team the photos post to) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 7 }}>
          <StepBadge n={1} /> WHICH EVENT <span style={{ color: P.red }}>*</span>
        </div>
        <select value={eventId} onChange={(e) => changeEvent(e.target.value)} style={selectStyle} disabled={busy || !events.length}>
          <option value="">{events.length ? 'Select the event…' : 'No posted events yet'}</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} · {ev.date}{!presetTeam ? ` · ${(ev.team || 'battalion').toUpperCase()}` : ''}
            </option>
          ))}
        </select>
        {teamCfg?.voting && (
          <div style={{ fontFamily: mono, fontSize: 8.5, color: P.mute, letterSpacing: '0.1em', marginTop: 6 }}>
            RAIDER PHOTOS ARE ENTERED INTO THAT EVENT'S FUNNY / AURA / TEAM-LEADING VOTE.
          </div>
        )}
      </div>

      {/* Step 2 — photos, locked until an event is picked */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 7 }}>
          <StepBadge n={2} /> ADD PHOTOS
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <div
          onClick={() => photosEnabled && !busy && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); if (photosEnabled && !busy) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            position: 'relative', cursor: photosEnabled && !busy ? 'pointer' : 'not-allowed',
            opacity: photosEnabled ? (busy ? 0.6 : 1) : 0.45,
            border: `1px dashed ${dragOver ? P.gold : P.hairStrong}`,
            background: dragOver ? 'rgba(201,169,97,0.06)' : P.deep,
            padding: items.length ? '16px' : '40px 20px', textAlign: 'center', transition: 'all 0.15s',
          }}>
          {items.length === 0 ? (
            <>
              <Brackets color={dragOver ? P.gold : P.hair} />
              <div style={{ fontSize: 26, color: P.gold, opacity: 0.7, marginBottom: 10 }}>⤢</div>
              <div style={{ fontFamily: oswald, fontSize: 16, letterSpacing: '0.06em', color: P.cream }}>
                {photosEnabled ? 'DROP PHOTOS OR TAP TO CHOOSE' : 'PICK AN EVENT FIRST'}
              </div>
              {photosEnabled && (
                <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.14em', marginTop: 8 }}>
                  SELECT SEVERAL AT ONCE · JPG / PNG / HEIC · AUTO-OPTIMIZED
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {items.map((it) => (
                <div key={it.id} style={{
                  position: 'relative', flexShrink: 0, width: 84, height: 84,
                  border: `1px solid ${it.status === 'error' ? P.red : P.hair}`,
                }}>
                  <img src={it.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: it.status === 'error' ? 0.5 : 1 }} />
                  {it.status === 'uploading' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,16,31,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.1em' }}>
                      UP…
                    </div>
                  )}
                  {it.status === 'error' && (
                    <div title={it.error || ''} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(192,57,43,0.85)', color: P.cream, fontFamily: mono, fontSize: 7, letterSpacing: '0.08em', textAlign: 'center', padding: '2px 0' }}>
                      FAILED
                    </div>
                  )}
                  {it.status === 'pending' && !busy && (
                    <button onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(6,16,31,0.82)', border: 'none', color: P.red, cursor: 'pointer', fontSize: 12, padding: '1px 5px', lineHeight: 1 }}>×</button>
                  )}
                </div>
              ))}
              {!busy && (
                <div onClick={(e) => { e.stopPropagation(); inputRef.current.click(); }}
                  style={{ flexShrink: 0, width: 84, height: 84, border: `1px dashed ${P.hairStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: P.gold, cursor: 'pointer' }}>
                  +
                </div>
              )}
            </div>
          )}
        </div>
        {rejected.length > 0 && (
          <div style={{ fontFamily: mono, fontSize: 9, color: P.red, letterSpacing: '0.06em', marginTop: 8 }}>
            SKIPPED (NOT IMAGES): {rejected.join(', ')}
          </div>
        )}
      </div>

      {/* Credit — tucked away by default, most submissions skip it */}
      <details style={{ marginBottom: 20 }}>
        <summary style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.16em', cursor: 'pointer' }}>
          + ADD CREDIT (OPTIONAL)
        </summary>
        <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="e.g. Jane Doe, team parent"
          style={{ ...inputStyle, marginTop: 10 }} />
      </details>

      {/* Progress */}
      {busy && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.16em', marginBottom: 6 }}>
            <span>UPLOADING…</span>
            <span>{items.filter((it) => it.status === 'done').length} / {items.length}</span>
          </div>
          <div style={{ height: 3, background: P.deep, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(items.filter((it) => it.status === 'done').length / Math.max(1, items.length)) * 100}%`, background: P.gold, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}
      {!busy && errorItems.length > 0 && (
        <div style={{ marginBottom: 16, fontFamily: mono, fontSize: 10, color: P.red, letterSpacing: '0.06em' }}>
          ✕ {errorItems.length} photo{errorItems.length === 1 ? '' : 's'} failed to upload. Fix and tap submit to retry.
        </div>
      )}

      {/* Submit */}
      <button onClick={submit} disabled={!canSubmit}
        style={{ ...btnGold, width: '100%', padding: '14px', opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
        {busy ? 'WORKING…' : errorItems.length > 0 ? `RETRY ${pendingCount}` : teamCfg?.voting ? `SUBMIT ${pendingCount > 1 ? `${pendingCount} PHOTOS` : 'PHOTO'} TO COMPETITION` : `SUBMIT ${pendingCount > 1 ? `${pendingCount} PHOTOS` : 'PHOTO'}`}
      </button>
    </div>
  );
}

const panel = { background: P.navy, border: `1px solid ${P.hair}`, padding: 24, fontFamily: inter };
const label = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.22em', marginBottom: 8 };
const inputStyle = {
  width: '100%', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: inter, fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box',
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const btnGold = { background: P.gold, color: P.ink, border: 'none', cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, padding: '10px 18px' };
