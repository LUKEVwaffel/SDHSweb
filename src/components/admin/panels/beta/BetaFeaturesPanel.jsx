import { useState, useRef, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { resizeForUpload, isRawFile } from '../../../../lib/imageResize';
import { P, mono, oswald, fs, sp, radius } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';

const BUCKET = 'beta-event-photos';
const MAX_PHOTOS = 10;

// Singleton editor for the one-off "beta test" event spotlight — not tied to
// public.events (this is explicitly for events that don't go on the public
// calendar, see supabase/beta_event_spotlight.sql). Feeds two surfaces:
// EventSpotlightBand.jsx on the homepage and SlideEventSpotlight.jsx on the
// Range TV slideshow rotation — both just read this one row, so there's a
// single place to write the description and no risk of the two drifting.
export default function BetaFeaturesPanel({ adminId }) {
  const [row, setRow] = useState(null); // null while loading, {} shape once loaded (id may be undefined for a fresh row)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [people, setPeople] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    SB.from('beta_event_spotlight').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        setRow(data || {});
        setTitle(data?.title || '');
        setDescription(data?.description || '');
        setPeople(data?.people || '');
        setEventDate(data?.event_date || '');
        setActive(data?.active ?? true);
      });
  }, []);

  const photos = row?.photos || [];

  async function persist(patch) {
    const payload = { ...patch, updated_by: adminId || null, updated_at: new Date().toISOString() };
    if (row?.id) {
      const { data, error } = await SB.from('beta_event_spotlight').update(payload).eq('id', row.id).select().single();
      if (error) throw error;
      setRow(data);
      return data;
    }
    const { data, error } = await SB.from('beta_event_spotlight').insert(payload).select().single();
    if (error) throw error;
    setRow(data);
    return data;
  }

  async function saveText() {
    setSaving(true);
    setSaveMsg('');
    try {
      await persist({ title: title.trim(), description: description.trim(), people: people.trim(), event_date: eventDate || null, active });
      setSaveMsg('Saved.');
    } catch (err) {
      setSaveMsg(`Save failed: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(fileList) {
    setUploadErr('');
    const files = Array.from(fileList || []);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { setUploadErr(`Already at ${MAX_PHOTOS} photos — remove one first.`); return; }
    const images = files.filter((f) => f.type.startsWith('image/') && !isRawFile(f));
    const skippedRaw = files.filter((f) => isRawFile(f));
    const toUpload = images.slice(0, room);
    if (images.length > room) setUploadErr(`Only ${room} slot(s) left — uploaded the first ${room}, skipped the rest.`);
    if (skippedRaw.length) setUploadErr((e) => `${e ? e + ' ' : ''}Skipped ${skippedRaw.length} RAW file(s) — export as JPEG first.`);
    if (!toUpload.length) return;

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of toUpload) {
        const { full } = await resizeForUpload(file);
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const path = `${stamp}.jpg`;
        const { error: upErr } = await SB.storage.from(BUCKET).upload(path, full, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const url = SB.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        uploaded.push({ path, url });
      }
      await persist({ photos: [...photos, ...uploaded] });
    } catch (err) {
      setUploadErr(err.message || String(err));
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo) {
    try {
      await SB.storage.from(BUCKET).remove([photo.path]);
      await persist({ photos: photos.filter((p) => p.path !== photo.path) });
    } catch (err) {
      setUploadErr(err.message || String(err));
    }
  }

  if (row === null) {
    return <PanelHeader title="BETA FEATURES" sub="Loading…" />;
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <PanelHeader title="BETA FEATURES" sub="One-off event spotlight — not on the calendar. Shows on the homepage and as a Range TV slide while ACTIVE is on." />

      <Card style={{ marginBottom: sp[4] }}>
        <Label>TITLE</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. American Legion — Boys State Send-Off" style={{ marginBottom: sp[3] }} />

        <Label>DESCRIPTION</Label>
        <Input multiline value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, where, why it mattered." style={{ marginBottom: sp[3], minHeight: '5em' }} />

        <Label>PEOPLE INVOLVED</Label>
        <Input value={people} onChange={(e) => setPeople(e.target.value)} placeholder="e.g. S-5 Aaron Johnson, Deputy S-3 Brock Beeler" style={{ marginBottom: sp[3] }} />

        <Label>DATE</Label>
        <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ marginBottom: sp[3], maxWidth: 200 }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: sp[2], cursor: 'pointer', marginBottom: sp[4] }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span style={{ fontFamily: mono, fontSize: fs.xs, color: P.cream, letterSpacing: '0.06em' }}>ACTIVE — visible on homepage &amp; TV</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <Btn variant="gold" size="sm" onClick={saveText} disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</Btn>
          {saveMsg && <span style={{ fontFamily: mono, fontSize: fs.tiny, color: saveMsg.startsWith('Save failed') ? P.red : P.green }}>{saveMsg}</span>}
        </div>
      </Card>

      <input
        ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
      <div
        onClick={() => !uploading && photos.length < MAX_PHOTOS && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (!uploading && photos.length < MAX_PHOTOS) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading && photos.length < MAX_PHOTOS) addFiles(e.dataTransfer.files);
        }}
        style={{
          cursor: photos.length < MAX_PHOTOS && !uploading ? 'pointer' : 'not-allowed',
          opacity: photos.length < MAX_PHOTOS ? 1 : 0.5,
          border: `1px dashed ${dragOver ? P.gold : P.hairStrong}`,
          background: dragOver ? 'rgba(201,169,97,0.06)' : P.deep,
          padding: '40px 20px', textAlign: 'center', marginBottom: sp[4], borderRadius: radius.md,
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 26, color: P.gold, opacity: 0.7, marginBottom: 8 }}>⤢</div>
        <div style={{ fontFamily: oswald, fontSize: 16, letterSpacing: '0.06em', color: P.cream }}>
          {uploading ? 'UPLOADING…' : photos.length < MAX_PHOTOS ? 'DROP PHOTOS OR CLICK TO BROWSE' : `LIMIT REACHED — ${MAX_PHOTOS}/${MAX_PHOTOS}`}
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.14em', marginTop: 8 }}>
          {photos.length}/{MAX_PHOTOS} PHOTOS · IMAGES ONLY · RAW NOT SUPPORTED
        </div>
      </div>

      {uploadErr && (
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginBottom: sp[3] }}>{uploadErr}</div>
      )}

      {photos.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: sp[2] }}>
          {photos.map((photo) => (
            <div key={photo.path} style={{ position: 'relative', border: `1px solid ${P.hair}`, borderRadius: radius.sm, overflow: 'hidden' }}>
              <img src={photo.url} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => removePhoto(photo)}
                style={{
                  position: 'absolute', top: 2, right: 2, background: 'rgba(6,16,31,0.82)',
                  border: 'none', color: P.red, cursor: 'pointer', fontSize: 12, padding: '1px 5px', borderRadius: radius.sm,
                }}
              >×</button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="⊞" title="NO PHOTOS YET" hint="Drag photos into the drop zone above, or click it to browse. Up to 10." />
      )}
    </div>
  );
}
