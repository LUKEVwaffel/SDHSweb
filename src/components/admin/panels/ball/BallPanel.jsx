import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label, PanelHeader } from '../../shared/ui';
import BallDressStaffTab from './BallDressStaffTab';

const TABS = [{ id: 'settings', label: 'SETTINGS' }, { id: 'dress-staff', label: 'DRESS STAFF ACCOUNTS' }];
const BUCKET = 'ball-assets';

function emptyApprover() { return { name: '', phone: '', email: '' }; }

// S-6-only Ball admin panel. Settings tab covers everything in the spec's
// admin list (date/price/deadline, 3 dress approvers, PDF, dress code text,
// gallery). Dress Staff Accounts is an inferred addition beyond the literal
// spec — it's the only way to provision the 3 dress verifiers' PINs at all
// (see ball-dress-set-pin edge fn), so it has to live somewhere.
export default function BallPanel() {
  const [tab, setTab] = useState('settings');
  const [config, setConfig] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const pdfRef = useRef();
  const photoRef = useRef();

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: cfg }, { data: photos }] = await Promise.all([
      SB.from('ball_config').select('*').maybeSingle(),
      SB.from('ball_gallery').select('*').order('sort_order', { ascending: true }),
    ]);
    setConfig(cfg || { ball_date: '', ticket_price: '', signup_deadline: '', field_trip_form_pdf_url: '', dress_code_text: '', dress_approvers: [emptyApprover(), emptyApprover(), emptyApprover()] });
    setGallery(photos || []);
  }

  function setField(field, value) { setConfig((c) => ({ ...c, [field]: value })); }
  function setApprover(i, field, value) {
    setConfig((c) => {
      const next = [...(c.dress_approvers || [])];
      next[i] = { ...(next[i] || emptyApprover()), [field]: value };
      return { ...c, dress_approvers: next };
    });
  }

  async function save() {
    setSaving(true);
    const { error } = await SB.from('ball_config').update({
      ball_date: config.ball_date || null,
      ticket_price: config.ticket_price === '' ? null : Number(config.ticket_price),
      signup_deadline: config.signup_deadline || null,
      field_trip_form_pdf_url: config.field_trip_form_pdf_url || null,
      dress_code_text: config.dress_code_text || null,
      dress_approvers: config.dress_approvers || [],
    }).eq('id', true);
    setSaving(false);
    setFlash(error ? `Save failed: ${error.message}` : 'Saved ✓');
    setTimeout(() => setFlash(''), 2500);
  }

  async function uploadPdf(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const path = `field-trip-form-${Date.now()}.pdf`;
    const { error } = await SB.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { setFlash(`Upload failed: ${error.message}`); return; }
    const url = SB.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    setField('field_trip_form_pdf_url', url);
  }

  async function uploadGalleryPhoto(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const path = `gallery-${Date.now()}-${file.name}`;
    const { error } = await SB.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { setFlash(`Upload failed: ${error.message}`); return; }
    const url = SB.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await SB.from('ball_gallery').insert({ photo_url: url, storage_path: path, sort_order: gallery.length });
    load();
  }

  async function moveGalleryPhoto(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= gallery.length) return;
    const a = gallery[index], b = gallery[target];
    await Promise.all([
      SB.from('ball_gallery').update({ sort_order: b.sort_order }).eq('id', a.id),
      SB.from('ball_gallery').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    load();
  }

  async function deleteGalleryPhoto(photo) {
    if (!confirm('Delete this photo?')) return;
    await SB.storage.from(BUCKET).remove([photo.storage_path]);
    await SB.from('ball_gallery').delete().eq('id', photo.id);
    load();
  }

  if (!config) return <div style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>LOADING…</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <PanelHeader title="MILITARY BALL" sub="Not yet linked from the public site — routes live at /ball" />
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        {TABS.map((t) => <Btn key={t.id} variant={tab === t.id ? 'gold' : 'ghost'} size="sm" onClick={() => setTab(t.id)}>{t.label}</Btn>)}
      </div>

      {tab === 'dress-staff' ? <BallDressStaffTab /> : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: sp[3], marginBottom: sp[4] }}>
            <div><Label>BALL DATE</Label><Input type="date" value={config.ball_date || ''} onChange={(e) => setField('ball_date', e.target.value)} /></div>
            <div><Label>TICKET PRICE ($)</Label><Input type="number" step="0.01" value={config.ticket_price ?? ''} onChange={(e) => setField('ticket_price', e.target.value)} /></div>
            <div><Label>SIGNUP DEADLINE</Label><Input type="date" value={config.signup_deadline || ''} onChange={(e) => setField('signup_deadline', e.target.value)} /></div>
          </div>

          <Label>FIELD TRIP PERMISSION FORM (PDF)</Label>
          <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', marginBottom: sp[4] }}>
            {config.field_trip_form_pdf_url && <a href={config.field_trip_form_pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: 12, color: P.gold }}>CURRENT PDF ↗</a>}
            <input ref={pdfRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={uploadPdf} />
            <Btn size="sm" onClick={() => pdfRef.current.click()}>{config.field_trip_form_pdf_url ? 'REPLACE' : 'UPLOAD'} PDF</Btn>
          </div>

          <Label>DRESS CODE TEXT</Label>
          <textarea
            value={config.dress_code_text || ''} onChange={(e) => setField('dress_code_text', e.target.value)} rows={6}
            style={{ width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: 12, marginBottom: sp[4] }}
          />

          <Label>DRESS APPROVERS (3)</Label>
          <div style={{ marginBottom: sp[4] }}>
            {[0, 1, 2].map((i) => {
              const a = config.dress_approvers?.[i] || emptyApprover();
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: sp[2], marginBottom: sp[2] }}>
                  <Input placeholder="Name" value={a.name} onChange={(e) => setApprover(i, 'name', e.target.value)} />
                  <Input placeholder="Phone" value={a.phone} onChange={(e) => setApprover(i, 'phone', e.target.value)} />
                  <Input placeholder="Email" value={a.email} onChange={(e) => setApprover(i, 'email', e.target.value)} />
                </div>
              );
            })}
          </div>

          <Label>LAST YEAR'S PHOTOS</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[2], marginBottom: sp[3] }}>
            {gallery.map((g, i) => (
              <div key={g.id} style={{ width: 120, background: P.deep, border: `1px solid ${P.hair}` }}>
                <img src={g.photo_url} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                <div style={{ display: 'flex', gap: 2, padding: 4 }}>
                  <button onClick={() => moveGalleryPhoto(i, -1)} style={miniBtn}>↑</button>
                  <button onClick={() => moveGalleryPhoto(i, 1)} style={miniBtn}>↓</button>
                  <button onClick={() => deleteGalleryPhoto(g)} style={{ ...miniBtn, color: P.red }}>DEL</button>
                </div>
              </div>
            ))}
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadGalleryPhoto} />
          <Btn size="sm" onClick={() => photoRef.current.click()}>+ ADD PHOTO</Btn>

          <div style={{ marginTop: sp[6], display: 'flex', alignItems: 'center', gap: sp[3] }}>
            <Btn variant="gold" onClick={save} disabled={saving}>{saving ? 'SAVING…' : 'SAVE SETTINGS'}</Btn>
            {flash && <span style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>{flash}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const miniBtn = { flex: 1, background: 'transparent', border: `1px solid ${P.hair}`, color: P.mute, cursor: 'pointer', fontFamily: mono, fontSize: 10, padding: '3px 0' };
