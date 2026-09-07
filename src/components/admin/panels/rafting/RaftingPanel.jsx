import { useState, useRef, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { resizeForUpload, isRawFile } from '../../../../lib/imageResize';
import { RAFTING_BUCKET, RAFTING_MAX_PHOTOS } from '../../../../lib/rafting';
import { P, mono, oswald, fs, sp, radius } from '../../theme';
import { PanelHeader, EmptyState } from '../../shared/ui';

// DISPATCH -> Rafting Trip. Bulk-upload the trip's photos; they land in the
// public /rafting gallery immediately (grid + lightbox) and, once there's at
// least one, on the homepage RaftingPhotoBand. Standalone from Beta Features
// and public.events on purpose - see supabase/rafting_photos.sql.
export default function RaftingPanel({ adminId }) {
  const [photos, setPhotos] = useState(null); // null while loading
  const [loadErr, setLoadErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [progress, setProgress] = useState(null); // { done, total }
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  async function load() {
    const { data, error } = await SB.from('rafting_photos')
      .select('id, path, url, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { setLoadErr(error.message || String(error)); setPhotos([]); return; }
    setLoadErr('');
    setPhotos(data || []);
  }

  useEffect(() => { load(); }, []);

  async function addFiles(fileList) {
    setUploadErr('');
    const current = photos || [];
    const files = Array.from(fileList || []);
    const room = RAFTING_MAX_PHOTOS - current.length;
    if (room <= 0) { setUploadErr(`At the ${RAFTING_MAX_PHOTOS}-photo limit - remove some first.`); return; }
    const images = files.filter((f) => f.type.startsWith('image/') && !isRawFile(f));
    const skippedRaw = files.filter((f) => isRawFile(f));
    const toUpload = images.slice(0, room);
    if (images.length > room) setUploadErr(`Only ${room} slot(s) left - taking the first ${room}, skipping the rest.`);
    if (skippedRaw.length) setUploadErr((e) => `${e ? e + ' ' : ''}Skipped ${skippedRaw.length} RAW file(s) - export as JPEG first.`);
    if (!toUpload.length) return;

    setUploading(true);
    setProgress({ done: 0, total: toUpload.length });
    // Continue past a single bad file rather than aborting the whole batch.
    let baseOrder = current.reduce((m, p) => Math.max(m, p.sort_order || 0), 0) + 1;
    const failed = [];
    try {
      for (let i = 0; i < toUpload.length; i += 1) {
        const file = toUpload[i];
        try {
          const { full } = await resizeForUpload(file);
          const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const path = `${stamp}.jpg`;
          const { error: upErr } = await SB.storage.from(RAFTING_BUCKET).upload(path, full, { contentType: 'image/jpeg' });
          if (upErr) throw upErr;
          const url = SB.storage.from(RAFTING_BUCKET).getPublicUrl(path).data.publicUrl;
          const { error: insErr } = await SB.from('rafting_photos').insert({
            path, url, sort_order: baseOrder, uploaded_by: adminId || null,
          });
          if (insErr) {
            await SB.storage.from(RAFTING_BUCKET).remove([path]); // don't orphan the object
            throw insErr;
          }
          baseOrder += 1;
        } catch (err) {
          failed.push(`${file.name}: ${err.message || err}`);
        }
        setProgress({ done: i + 1, total: toUpload.length });
      }
      if (failed.length) setUploadErr((e) => `${e ? e + ' ' : ''}${failed.length} failed - ${failed[0]}`);
      await load();
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function removePhoto(photo) {
    setUploadErr('');
    const { error: delErr } = await SB.from('rafting_photos').delete().eq('id', photo.id);
    if (delErr) { setUploadErr(delErr.message || String(delErr)); return; }
    await SB.storage.from(RAFTING_BUCKET).remove([photo.path]); // best-effort - row is already gone
    setPhotos((cur) => (cur || []).filter((p) => p.id !== photo.id));
  }

  if (photos === null) {
    return <PanelHeader title="RAFTING TRIP" sub="Loading…" />;
  }

  const atLimit = photos.length >= RAFTING_MAX_PHOTOS;

  return (
    <div style={{ maxWidth: 900 }}>
      <PanelHeader
        title="RAFTING TRIP"
        sub={`Drop the trip's photos here. They go straight to the public /rafting gallery and the homepage. ${photos.length}/${RAFTING_MAX_PHOTOS} uploaded.`}
      />

      {loadErr && (
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginBottom: sp[3] }}>{loadErr}</div>
      )}

      <input
        ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
      <div
        onClick={() => !uploading && !atLimit && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); if (!uploading && !atLimit) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading && !atLimit) addFiles(e.dataTransfer.files);
        }}
        style={{
          cursor: !atLimit && !uploading ? 'pointer' : 'not-allowed',
          opacity: !atLimit ? 1 : 0.5,
          border: `1px dashed ${dragOver ? P.gold : P.hairStrong}`,
          background: dragOver ? 'rgba(201,169,97,0.06)' : P.deep,
          padding: '40px 20px', textAlign: 'center', marginBottom: sp[4], borderRadius: radius.md,
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 26, color: P.gold, opacity: 0.7, marginBottom: 8 }}>⤢</div>
        <div style={{ fontFamily: oswald, fontSize: 16, letterSpacing: '0.06em', color: P.cream }}>
          {uploading
            ? (progress ? `UPLOADING ${progress.done}/${progress.total}…` : 'UPLOADING…')
            : atLimit ? `LIMIT REACHED - ${RAFTING_MAX_PHOTOS}/${RAFTING_MAX_PHOTOS}` : 'DROP PHOTOS OR CLICK TO BROWSE'}
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.14em', marginTop: 8 }}>
          {photos.length}/{RAFTING_MAX_PHOTOS} PHOTOS · IMAGES ONLY · RAW NOT SUPPORTED · UPLOAD ORDER = GALLERY ORDER
        </div>
      </div>

      {uploadErr && (
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginBottom: sp[3] }}>{uploadErr}</div>
      )}

      {photos.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: sp[2] }}>
          {photos.map((photo) => (
            <div key={photo.id} style={{ position: 'relative', border: `1px solid ${P.hair}`, borderRadius: radius.sm, overflow: 'hidden' }}>
              <img src={photo.url} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => removePhoto(photo)}
                aria-label="Remove photo"
                style={{
                  position: 'absolute', top: 2, right: 2, background: 'rgba(6,16,31,0.82)',
                  border: 'none', color: P.red, cursor: 'pointer', fontSize: 12, padding: '1px 5px', borderRadius: radius.sm,
                }}
              >×</button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="⛵" title="NO PHOTOS YET" hint="Drag the rafting trip photos into the drop zone above, or click it to browse." />
      )}
    </div>
  );
}
