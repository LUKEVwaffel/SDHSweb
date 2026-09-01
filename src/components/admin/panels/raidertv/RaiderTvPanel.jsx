import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, fs, sp, radius } from '../../theme';
import { Btn, Input, Label, PanelHeader, EmptyState } from '../../shared/ui';
import { VIDEO_BUCKET, fmtTime } from '../../../../lib/raiderTv';

// DISPATCH → Raider TV. The durable video library behind /raidertv +
// /raiderremote: upload + title + reorder + delete, plus a read-only view of
// any TVs currently paired. Files land in the public `raider-videos` bucket;
// rows live in public.raider_videos (is_admin() writes — see raider_tv.sql).

const safeName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

function readDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? v.duration : null); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}

export default function RaiderTvPanel({ adminId }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null); // { file, title, sizeMb, durationSec }
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id, title }
  const [sessions, setSessions] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from('raider_videos')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setVideos(data || []);
    setLoading(false);
  }, []);

  const loadSessions = useCallback(async () => {
    const { data } = await SB.from('raider_tv_sessions')
      .select('id, code, playing, video_id, tv_position_sec, last_seen_at')
      .order('last_seen_at', { ascending: false });
    setSessions(data || []);
  }, []);

  useEffect(() => { load(); loadSessions(); }, [load, loadSessions]);

  async function pickFile(file) {
    if (!file) return;
    const durationSec = await readDuration(file);
    setPending({
      file,
      title: file.name.replace(/\.[^.]+$/, ''),
      sizeMb: file.size / (1024 * 1024),
      durationSec,
    });
  }

  async function confirmUpload() {
    if (!pending || !pending.title.trim() || busy) return;
    setBusy(true);
    const path = `${Date.now()}-${safeName(pending.file.name)}`;
    const up = await SB.storage.from(VIDEO_BUCKET).upload(path, pending.file, {
      upsert: false,
      contentType: pending.file.type || 'video/mp4',
    });
    if (up.error) {
      setBusy(false);
      alert(`Upload failed: ${up.error.message}`);
      return;
    }
    const maxOrder = videos.reduce((m, v) => Math.max(m, v.sort_order ?? 0), 0);
    const ins = await SB.from('raider_videos').insert({
      title: pending.title.trim(),
      storage_path: path,
      duration_sec: pending.durationSec,
      sort_order: maxOrder + 1,
      created_by: adminId || null,
    });
    setBusy(false);
    if (ins.error) {
      // Row insert failed (RLS?) — don't leave an orphan file in the bucket.
      await SB.storage.from(VIDEO_BUCKET).remove([path]);
      alert(`Could not save video: ${ins.error.message}`);
      return;
    }
    setPending(null);
    load();
  }

  async function saveTitle() {
    if (!editing || !editing.title.trim()) return;
    await SB.from('raider_videos').update({ title: editing.title.trim() }).eq('id', editing.id);
    setEditing(null);
    load();
  }

  async function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= videos.length) return;
    const a = videos[idx];
    const b = videos[j];
    await Promise.all([
      SB.from('raider_videos').update({ sort_order: b.sort_order }).eq('id', a.id),
      SB.from('raider_videos').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    load();
  }

  async function remove(v) {
    if (!confirm(`Delete "${v.title}"? Removes the video file and its library entry.`)) return;
    await SB.storage.from(VIDEO_BUCKET).remove([v.storage_path]);
    await SB.from('raider_videos').delete().eq('id', v.id);
    load();
  }

  const titleFor = (id) => videos.find((v) => v.id === id)?.title;
  const liveSessions = sessions.filter((s) => Date.now() - new Date(s.last_seen_at).getTime() < 60000);

  return (
    <div style={{ maxWidth: 940 }}>
      <PanelHeader
        title="RAIDER TV"
        sub={`${videos.length} video(s) · open /raidertv on the screen, /raiderremote on your phone`}
        action={<Btn onClick={() => fileRef.current.click()} variant="gold" size="sm">+ UPLOAD VIDEO</Btn>}
      />
      <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; pickFile(f); }} />

      {/* Active pairings */}
      <div style={{ marginBottom: sp[5] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[2] }}>
          <Label style={{ margin: 0 }}>PAIRED TVs</Label>
          <button onClick={loadSessions} style={miniBtn(false)}>REFRESH</button>
        </div>
        {liveSessions.length === 0 ? (
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint }}>No TV paired right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
            {liveSessions.map((s) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: sp[3], fontFamily: mono, fontSize: fs.tiny, color: P.cream,
                background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: `${sp[2]}px ${sp[3]}px`,
              }}>
                <span style={{ color: P.gold, letterSpacing: '0.14em' }}>CODE {s.code}</span>
                <span style={{ color: s.playing ? P.green : P.mute }}>{s.playing ? '▶ playing' : '❚❚ paused'}</span>
                <span style={{ color: P.mute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.video_id ? (titleFor(s.video_id) || 'video') : 'idle'}
                </span>
                <span style={{ marginLeft: 'auto', color: P.faint }}>{fmtTime(s.tv_position_sec)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Library */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
        style={{
          border: dragOver ? `2px dashed ${P.gold}` : '2px dashed transparent',
          background: dragOver ? P.goldWash : 'transparent',
          borderRadius: radius.md, padding: dragOver ? sp[2] : 0, transition: 'background 0.15s',
        }}
      >
        {loading ? (
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[6] }}>LOADING…</div>
        ) : videos.length === 0 ? (
          <EmptyState icon="▶" title="NO VIDEOS YET" hint="Upload or drag a video file here. Give it a title, then it shows up on the /raiderremote list." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
            {videos.map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: sp[3],
                background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: `${sp[3]}px ${sp[4]}px`,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} style={arrowBtn(i === 0)}>▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === videos.length - 1} style={arrowBtn(i === videos.length - 1)}>▼</button>
                </div>

                {editing?.id === v.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: sp[2] }}>
                    <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }} autoFocus />
                    <Btn size="sm" variant="gold" onClick={saveTitle}>SAVE</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}>×</Btn>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, marginTop: 2 }}>
                        {v.duration_sec ? fmtTime(v.duration_sec) : 'unknown length'} · #{v.sort_order}
                      </div>
                    </div>
                    <button onClick={() => setEditing({ id: v.id, title: v.title })} style={miniBtn(false)}>RENAME</button>
                    <button onClick={() => remove(v)} style={{ ...miniBtn(false), color: P.red, borderColor: 'rgba(192,57,43,0.4)' }}>DELETE</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload prompt */}
      {pending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.9)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}>
          <div style={{ background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: radius.md, padding: sp[5], width: 400, maxWidth: '90vw' }}>
            <Label>NEW VIDEO</Label>
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginBottom: sp[3] }}>
              {pending.file.name} · {pending.sizeMb.toFixed(1)} MB{pending.durationSec ? ` · ${fmtTime(pending.durationSec)}` : ''}
            </div>
            <Label>TITLE</Label>
            <div style={{ marginBottom: sp[4] }}>
              <Input value={pending.title} onChange={(e) => setPending({ ...pending, title: e.target.value })}
                placeholder="e.g. Rope Bridge — Run 3" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') confirmUpload(); }} />
            </div>
            <div style={{ display: 'flex', gap: sp[2], justifyContent: 'flex-end' }}>
              <Btn variant="ghost" size="sm" onClick={() => setPending(null)} disabled={busy}>CANCEL</Btn>
              <Btn variant="gold" size="sm" onClick={confirmUpload} disabled={busy || !pending.title.trim()}>
                {busy ? 'UPLOADING…' : 'UPLOAD'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function arrowBtn(disabled) {
  return {
    background: 'transparent', border: `1px solid ${P.hair}`, color: disabled ? P.faint : P.mute,
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 8, lineHeight: 1, padding: '3px 5px', borderRadius: 3,
  };
}

function miniBtn(active) {
  return {
    background: active ? P.gold : 'transparent', border: `1px solid ${active ? P.gold : P.hair}`,
    color: active ? P.ink : P.mute, cursor: 'pointer', fontFamily: mono, fontSize: 8,
    letterSpacing: '0.08em', padding: '4px 8px', borderRadius: 3,
  };
}
