import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getDeviceId } from '../lib/fingerprint';
import { resizeForUpload } from '../lib/imageResize';
import { TEAMS } from '../lib/teams';

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
 * Premium public photo submission flow.
 * @param {string} [presetTeam] lock the team selector to this id
 * @param {(photo:object)=>void} [onUploaded] callback after a successful post
 */
export default function PhotoUploader({ presetTeam = null, onUploaded }) {
  const [team, setTeam] = useState(presetTeam || 'battalion');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [credit, setCredit] = useState('');
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | optimizing | uploading | success | error
  const [errMsg, setErrMsg] = useState('');
  const [deviceId, setDeviceId] = useState(null);
  const inputRef = useRef();

  const teamCfg = getOption(team);
  const needsEvent = !!teamCfg?.voting; // raiders must attach to an event (feeds voting)

  useEffect(() => { getDeviceId().then(setDeviceId); }, []);

  useEffect(() => {
    if (!needsEvent) { setEvents([]); setEventId(''); return; }
    SB.from('events').select('id, title, date').order('date', { ascending: false })
      .then(({ data }) => setEvents(data || []));
  }, [needsEvent]);

  // Revoke object URLs to avoid leaks.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseFile = useCallback((f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErrMsg('Images only.'); setPhase('error'); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setPhase('idle');
    setErrMsg('');
  }, [previewUrl]);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    chooseFile(e.dataTransfer.files?.[0]);
  }

  function reset(keepTeam = true) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setCredit(''); setEventId('');
    setPhase('idle'); setErrMsg('');
    if (!keepTeam && !presetTeam) setTeam('battalion');
  }

  const canSubmit = file && team && (!needsEvent || eventId) && phase !== 'optimizing' && phase !== 'uploading';

  async function submit() {
    if (!canSubmit) return;
    try {
      setPhase('optimizing');
      const { full, thumb } = await resizeForUpload(file);
      const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const dir = needsEvent && eventId ? `${team}/${eventId}` : team;
      const base = `${dir}/${stamp}`;

      setPhase('uploading');
      const up1 = await SB.storage.from(BUCKET).upload(`${base}.jpg`, full, { contentType: 'image/jpeg' });
      if (up1.error) throw up1.error;
      const up2 = await SB.storage.from(BUCKET).upload(`${base}_t.jpg`, thumb, { contentType: 'image/jpeg' });
      if (up2.error) throw up2.error;

      const photoUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}.jpg`).data.publicUrl;
      const thumbUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}_t.jpg`).data.publicUrl;

      const { data, error } = await SB.from('photos').insert({
        team,
        event_id: needsEvent && eventId ? eventId : null,
        storage_path: `${base}.jpg`,
        photo_url: photoUrl,
        thumb_url: thumbUrl,
        uploader_name: credit.trim() || null,
        uploader_fp: deviceId,
      }).select().single();
      if (error) throw error;

      setPhase('success');
      onUploaded?.(data);
    } catch (err) {
      setErrMsg(err.message || String(err));
      setPhase('error');
    }
  }

  // ── Success state ─────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <div style={{ ...panel, textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>✓</div>
        <div style={{ fontFamily: oswald, fontSize: 26, letterSpacing: '0.06em', color: P.cream }}>PHOTO POSTED</div>
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginTop: 8, maxWidth: 360, marginInline: 'auto' }}>
          Added to the {teamCfg?.label} {needsEvent ? 'competition gallery — it can be voted on while the poll is open.' : 'gallery.'}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={() => reset(true)} style={btnGold}>+ ADD ANOTHER</button>
        </div>
      </div>
    );
  }

  const busy = phase === 'optimizing' || phase === 'uploading';

  return (
    <div style={panel}>
      {/* Team selector */}
      {!presetTeam && (
        <div style={{ marginBottom: 20 }}>
          <div style={label}>TEAM</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {UPLOAD_OPTIONS.map((t) => {
              const on = team === t.id;
              return (
                <button key={t.id} onClick={() => setTeam(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    background: on ? 'rgba(201,169,97,0.08)' : 'transparent',
                    border: `1px solid ${on ? P.hairStrong : P.hair}`,
                    color: on ? P.cream : P.mute, padding: '9px 14px',
                    fontFamily: mono, fontSize: 11, letterSpacing: '0.12em', transition: 'all 0.15s',
                  }}>
                  <span style={{ width: 8, height: 8, background: t.accent, flexShrink: 0 }} />
                  {t.label.toUpperCase()}
                  {t.voting && <span style={{ fontSize: 8, color: P.gold, letterSpacing: '0.1em' }}>· VOTING</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Drop zone / preview */}
      <div style={{ marginBottom: 20 }}>
        <div style={label}>PHOTO</div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
        {!previewUrl ? (
          <div
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              position: 'relative', cursor: 'pointer',
              border: `1px dashed ${dragOver ? P.gold : P.hairStrong}`,
              background: dragOver ? 'rgba(201,169,97,0.06)' : P.deep,
              padding: '48px 20px', textAlign: 'center', transition: 'all 0.15s',
            }}>
            <Brackets color={dragOver ? P.gold : P.hair} />
            <div style={{ fontSize: 30, color: P.gold, opacity: 0.7, marginBottom: 10 }}>⤢</div>
            <div style={{ fontFamily: oswald, fontSize: 16, letterSpacing: '0.06em', color: P.cream }}>
              DROP A PHOTO OR CLICK TO BROWSE
            </div>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.14em', marginTop: 8 }}>
              JPG / PNG / HEIC · AUTO-OPTIMIZED ON UPLOAD
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', gap: 16, alignItems: 'center', background: P.deep, border: `1px solid ${P.hair}`, padding: 12 }}>
            <img src={previewUrl} alt="preview" style={{ width: 96, height: 96, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: inter, fontSize: 13, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 2 }}>{(file?.size / 1024 / 1024).toFixed(2)} MB · ready</div>
              {!busy && (
                <button onClick={() => reset(true)} style={{ ...btnGhost, marginTop: 8, fontSize: 9, padding: '5px 10px' }}>CHANGE PHOTO</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Event selector (voting teams only) */}
      {needsEvent && (
        <div style={{ marginBottom: 20 }}>
          <div style={label}>EVENT <span style={{ color: P.red }}>*</span></div>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={selectStyle}>
            <option value="">Select the competition…</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title} — {ev.date}</option>)}
          </select>
          <div style={{ fontFamily: mono, fontSize: 8.5, color: P.mute, letterSpacing: '0.1em', marginTop: 6 }}>
            RAIDER PHOTOS ARE ENTERED INTO THAT EVENT'S FUNNY / AURA / TEAM-LEADING VOTE.
          </div>
        </div>
      )}

      {/* Credit */}
      <div style={{ marginBottom: 22 }}>
        <div style={label}>CREDIT ME AS <span style={{ color: P.mute }}>(optional)</span></div>
        <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="e.g. Jane Doe, team parent"
          style={{ ...inputStyle }} />
      </div>

      {/* Progress / error */}
      {busy && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.16em', marginBottom: 6 }}>
            <span>{phase === 'optimizing' ? 'OPTIMIZING IMAGE…' : 'UPLOADING…'}</span>
            <span>{phase === 'optimizing' ? '1 / 2' : '2 / 2'}</span>
          </div>
          <div style={{ height: 3, background: P.deep, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: phase === 'optimizing' ? '45%' : '90%', background: P.gold, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}
      {phase === 'error' && (
        <div style={{ marginBottom: 16, fontFamily: mono, fontSize: 10, color: P.red, letterSpacing: '0.08em' }}>
          ✕ {errMsg}
        </div>
      )}

      {/* Submit */}
      <button onClick={submit} disabled={!canSubmit}
        style={{ ...btnGold, width: '100%', padding: '14px', opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
        {busy ? 'WORKING…' : needsEvent ? 'SUBMIT TO COMPETITION' : 'SUBMIT PHOTO'}
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
const btnGhost = { background: 'transparent', color: P.gold, border: `1px solid ${P.hairStrong}`, cursor: 'pointer', fontFamily: mono, letterSpacing: '0.14em' };
