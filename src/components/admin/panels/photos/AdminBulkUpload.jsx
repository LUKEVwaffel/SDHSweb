import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { resizeForUpload, isRawFile } from '../../../../lib/imageResize';
import { convertCr2ToPng, isCr2 } from '../../../../lib/cr2Convert';
import { P, mono, oswald, inter, fs, sp, radius, ease } from '../../theme';
import { Btn, Card, Label, Input, Select, PanelHeader, EmptyState } from '../../shared/ui';
import posthog from '../../../../lib/posthog';

const BUCKET = 'team-photos';

// Staff-side multi-file upload, tied to one posted event. Mirrors the public
// PhotoUploader's storage path scheme (team/event/stamp[.jpg|_t.jpg]) so
// PhotoSubmissions and RaiderPolls read these rows exactly like any cadet
// submission — nothing downstream needs to know they came from here.
export default function AdminBulkUpload({ adminId }) {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [credit, setCredit] = useState('');
  const [queue, setQueue] = useState([]); // { file, status: pending|converting|uploading|done|error, error }
  const [rejected, setRejected] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pngTask, setPngTask] = useState(null);
  const [pngError, setPngError] = useState('');
  const busy = uploading || pngTask !== null;
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    SB.from('events').select('id, title, date, team').eq('status', 'posted').order('date', { ascending: false })
      .then(({ data }) => setEvents(data || []));
  }, []);

  const selectedEvent = events.find((e) => e.id === eventId) || null;
  const eventTeam = selectedEvent ? (selectedEvent.team || 'battalion') : null;

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    const usable = [];
    const newRejected = [];
    for (const file of files) {
      if (isCr2(file) || (file.type.startsWith('image/') && !isRawFile(file))) {
        usable.push(file);
      } else {
        newRejected.push({ name: file.name, reason: isRawFile(file) ? 'Export this RAW format as JPEG or PNG first' : 'Not an image file' });
      }
    }
    if (newRejected.length) setRejected((r) => [...r, ...newRejected]);
    if (usable.length) setQueue((q) => [...q, ...usable.map((file) => ({ file, status: 'pending', error: null }))]);
  }, []);

  function changeEvent(id) {
    setEventId(id);
    setQueue([]);
    setRejected([]);
    setPngError('');
  }

  function removeFromQueue(idx) {
    setQueue((q) => q.filter((_, i) => i !== idx));
  }

  function clearFailed() {
    setQueue((q) => q.filter((it) => it.status !== 'error'));
  }

  async function savePng(file, idx) {
    if (busy) return;
    setPngTask(idx);
    setPngError('');
    try {
      const png = await convertCr2ToPng(file);
      const link = document.createElement('a');
      const url = URL.createObjectURL(png);
      link.href = url;
      link.download = png.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setPngError(`${file.name} · ${err.message || String(err)}`);
    } finally {
      setPngTask(null);
    }
  }

  async function uploadOne(item, idx) {
    const update = fields => setQueue(q => q.map((row, i) => i === idx ? { ...row, ...fields } : row));
    try {
      let input = item.file;
      if (isCr2(input)) {
        update({ status: 'converting', error: null });
        input = await convertCr2ToPng(input);
      }
      update({ status: 'uploading', error: null });
      const { full, thumb } = await resizeForUpload(input);
      const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${idx}`;
      const base = `${eventTeam}/${eventId}/${stamp}`;
      const up1 = await SB.storage.from(BUCKET).upload(`${base}.jpg`, full, { contentType: 'image/jpeg' });
      if (up1.error) throw up1.error;
      const up2 = await SB.storage.from(BUCKET).upload(`${base}_t.jpg`, thumb, { contentType: 'image/jpeg' });
      if (up2.error) throw up2.error;
      const photoUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}.jpg`).data.publicUrl;
      const thumbUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}_t.jpg`).data.publicUrl;
      const { error } = await SB.from('photos').insert({
        team: eventTeam,
        event_id: eventId,
        storage_path: `${base}.jpg`,
        photo_url: photoUrl,
        thumb_url: thumbUrl,
        uploader_name: credit.trim() || null,
        uploader_fp: null,
        uploaded_by: adminId || null,
      });
      if (error) throw error;
      update({ status: 'done' });
      return true;
    } catch (err) {
      update({ status: 'error', error: err.message || String(err) });
      return false;
    }
  }

  async function uploadAll() {
    if (!eventId || busy) return;
    setPngError('');
    setUploading(true);
    let ok = 0;
    // Sequential on purpose — a 40+ photo batch shouldn't slam storage with
    // that many parallel uploads at once.
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'done') { ok++; continue; }
      if (await uploadOne(queue[i], i)) ok++;
    }
    setUploading(false);
    if (ok > 0) {
      posthog.capture('admin_bulk_photo_upload_completed', {
        photo_count: ok,
        team: eventTeam,
      });
      await SB.from('change_log').insert({
        admin_id: adminId, page: 'photos', element: eventId,
        label: `BULK UPLOAD: ${ok} photo${ok === 1 ? '' : 's'} → ${selectedEvent?.title}`,
        value_before: {}, value_after: { event_id: eventId, count: ok },
      });
    }
  }

  const pendingCount = queue.filter((it) => it.status !== 'done').length;
  const doneCount = queue.filter((it) => it.status === 'done').length;
  const errorCount = queue.filter((it) => it.status === 'error').length;

  return (
    <div style={{ maxWidth: 760 }}>
      <PanelHeader title="BULK UPLOAD" sub="Drag in multiple photos, tie them to a posted event, upload on behalf of the team" />

      <Card style={{ marginBottom: sp[4] }}>
        <Label>EVENT <span style={{ color: P.red }}>*</span></Label>
        <Select
          value={eventId}
          onChange={(e) => changeEvent(e.target.value)}
          disabled={busy}
          options={[
            { value: '', label: events.length ? 'Select a posted event…' : 'No posted events yet' },
            ...events.map((ev) => ({ value: ev.id, label: `${ev.title} · ${ev.date} · ${(ev.team || 'battalion').toUpperCase()}` })),
          ]}
        />
        {!events.length && (
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: sp[2] }}>
            Post an event in the Events section first. Bulk upload needs one to attach to.
          </div>
        )}

        <div style={{ marginTop: sp[3] }}>
          <Label>CREDIT <span style={{ color: P.mute, textTransform: 'none', letterSpacing: 0 }}>(optional, applied to every photo in this batch)</span></Label>
          <Input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="e.g. Team parent, Coach Smith" disabled={busy} />
        </div>
      </Card>

      <input
        ref={inputRef} type="file" accept="image/*,.cr2" multiple style={{ display: 'none' }}
        onChange={(e) => { if (eventId && !busy) addFiles(e.target.files); e.target.value = ''; }}
      />
      <div
        onClick={() => eventId && !busy && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (eventId && !busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (eventId && !busy) addFiles(e.dataTransfer.files);
        }}
        style={{
          cursor: eventId && !busy ? 'pointer' : 'not-allowed', opacity: eventId ? 1 : 0.5,
          border: `1px dashed ${dragOver ? P.gold : P.hairStrong}`,
          background: dragOver ? 'rgba(201,169,97,0.06)' : P.deep,
          padding: '40px 20px', textAlign: 'center', marginBottom: sp[4], borderRadius: radius.md,
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 26, color: P.gold, opacity: 0.7, marginBottom: 8 }}>⤢</div>
        <div style={{ fontFamily: oswald, fontSize: 16, letterSpacing: '0.06em', color: P.cream }}>
          {eventId ? 'DROP PHOTOS OR CLICK TO BROWSE' : 'SELECT AN EVENT FIRST'}
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.14em', marginTop: 8 }}>
          IMAGES AND CANON .CR2 · CR2 CONVERTS TO PNG IN YOUR BROWSER
        </div>
      </div>

      {rejected.length > 0 && (
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginBottom: sp[3] }}>
          {rejected.map((r, i) => (
            <div key={i}>SKIPPED: {r.name} — {r.reason}</div>
          ))}
        </div>
      )}

      {pngError && <p role="alert" style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red }}>{pngError}</p>}

      {queue.length > 0 ? (
        <>
          <PanelHeader
            title={`QUEUE · ${queue.length}`}
            sub={uploading ? `Uploading… ${doneCount}/${queue.length}` : `${doneCount} done · ${errorCount} failed · ${pendingCount} remaining`}
            action={
              <div style={{ display: 'flex', gap: sp[2] }}>
                {!busy && errorCount > 0 && (
                  <Btn onClick={clearFailed} variant="ghost" size="sm">CLEAR {errorCount} FAILED</Btn>
                )}
                <Btn onClick={uploadAll} variant="gold" size="sm" disabled={busy || !eventId || pendingCount === 0}>
                  {uploading ? 'UPLOADING…' : `UPLOAD ${pendingCount}`}
                </Btn>
              </div>
            }
          />

          <div style={{ height: 6, borderRadius: radius.pill, background: P.deep, overflow: 'hidden', marginBottom: sp[3], display: 'flex' }}>
            <div style={{ width: `${(doneCount / queue.length) * 100}%`, background: P.green, transition: `width 0.2s ${ease}` }} />
            <div style={{ width: `${(errorCount / queue.length) * 100}%`, background: P.red, transition: `width 0.2s ${ease}` }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: sp[2] }}>
            {queue.map((item, idx) => (
              <div key={idx} style={{ position: 'relative', border: `1px solid ${P.hair}`, borderRadius: radius.sm, overflow: 'hidden', opacity: item.status === 'done' ? 0.6 : 1 }}>
                <div style={{ aspectRatio: '4/3', background: P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: inter, fontSize: 10, color: P.mute, padding: 6, textAlign: 'center', overflow: 'hidden' }}>
                  {item.file.name}
                </div>
                <div style={{ padding: '4px 6px', fontFamily: mono, fontSize: 8, color: item.status === 'error' ? P.red : item.status === 'done' ? P.green : ['converting', 'uploading'].includes(item.status) ? P.gold : P.mute }}>
                  {item.status.toUpperCase()}
                </div>
                {item.status === 'error' && item.error && (
                  <div style={{ padding: '0 6px 5px', fontFamily: inter, fontSize: 9, lineHeight: 1.3, color: P.red }} title={item.error}>
                    {item.error}
                  </div>
                )}
                {isCr2(item.file) && (
                  <Btn size="sm" variant="ghost" style={{ margin: '0 6px 6px' }} disabled={busy} aria-label={`Save PNG for ${item.file.name}`} onClick={() => savePng(item.file, idx)}>
                    {pngTask === idx ? 'Converting…' : 'Save PNG'}
                  </Btn>
                )}
                {(item.status === 'pending' || item.status === 'error') && !busy && (
                  <button onClick={() => removeFromQueue(idx)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(6,16,31,0.82)', border: 'none', color: P.red, cursor: 'pointer', fontSize: 12, padding: '1px 5px' }}>×</button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : eventId && (
        <EmptyState icon="⊞" title="NO PHOTOS QUEUED" hint="Drag photos into the drop zone above, or click it to browse." />
      )}
    </div>
  );
}
