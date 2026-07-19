import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { resizeForUpload } from '../../../../lib/imageResize';
import { TEAMS } from '../../../../lib/teams';
import { P, mono } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader } from '../../shared/ui';
import { RAIDER_BUCKET } from './pollHelpers';

export default function RaiderGallery() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ team: 'raiders', caption: '', year: '', sort_order: '0' });
  const [uploading, setUploading] = useState('');
  const fileRef = useRef();

  const load = useCallback(async () => {
    const { data } = await SB.from('gallery').select('*').order('sort_order', { ascending: true });
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setUploading('Optimizing…');
      const { full } = await resizeForUpload(file);
      const path = `${form.team}/gallery/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      setUploading('Uploading…');
      const { error } = await SB.storage.from(RAIDER_BUCKET).upload(path, full, { contentType: 'image/jpeg' });
      if (error) throw error;
      const url = SB.storage.from(RAIDER_BUCKET).getPublicUrl(path).data.publicUrl;
      await SB.from('gallery').insert({
        team: form.team, photo_url: url, storage_path: path,
        caption: form.caption || null, year: form.year || null,
        sort_order: parseInt(form.sort_order, 10) || 0,
      });
      setUploading('Added ✓');
      setForm((f) => ({ ...f, caption: '', year: '', sort_order: '0' }));
      load();
      setTimeout(() => setUploading(''), 2000);
    } catch (err) {
      setUploading(`Failed: ${err.message || err}`);
      setTimeout(() => setUploading(''), 4000);
    }
  }

  async function del(row) {
    if (!confirm('Delete gallery photo?')) return;
    if (row.storage_path) await SB.storage.from(RAIDER_BUCKET).remove([row.storage_path]);
    await SB.from('gallery').delete().eq('id', row.id);
    load();
  }

  return (
    <div>
      <PanelHeader title='CURATED "LAST YEAR" GALLERY (per team)' />
      <Card style={{ marginBottom: 12 }}>
        <Label>TEAM</Label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {TEAMS.map((t) => (
            <Btn key={t.id} variant={form.team === t.id ? 'gold' : 'ghost'} onClick={() => setForm((f) => ({ ...f, team: t.id }))} style={{ fontSize: 9 }}>{t.label.toUpperCase()}</Btn>
          ))}
        </div>
        <Label>ADD PHOTO</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 6, marginBottom: 8 }}>
          <div><Label>Caption</Label><Input value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} /></div>
          <div><Label>Year</Label><Input value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} /></div>
          <div><Label>Sort</Label><Input value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} /></div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={upload} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn onClick={() => fileRef.current.click()} variant="gold" style={{ fontSize: 9 }}>+ UPLOAD PHOTO</Btn>
          {uploading && <span style={{ fontFamily: mono, fontSize: 9, color: uploading.includes('Failed') ? P.red : P.green }}>{uploading}</span>}
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ position: 'relative' }}>
            <img src={r.photo_url} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(6,16,31,0.85)', padding: '3px 5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: mono, fontSize: 8, color: P.gold }}>{(r.team || '').toUpperCase()} · {r.year || ''} #{r.sort_order}</span>
              <button onClick={() => del(r)} style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: 11 }}>×</button>
            </div>
          </div>
        ))}
        {!rows.length && <div style={{ gridColumn: '1/-1', fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', padding: 20 }}>NO GALLERY PHOTOS YET</div>}
      </div>
    </div>
  );
}
