import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label, PanelHeader } from '../../shared/ui';
import BallDressStaffTab from './BallDressStaffTab';
import BallOverviewTab from './BallOverviewTab';
import BallReviewerAccountsTab from './BallReviewerAccountsTab';

const TABS = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'settings', label: 'SETTINGS' },
  { id: 'dress-staff', label: 'ATTIRE STAFF ACCOUNTS' },
  { id: 'reviewers', label: 'REVIEW PORTAL ACCOUNTS' },
];
const BUCKET = 'ball-assets';

function emptyApprover() { return { name: '', phone: '', email: '' }; }

// S-6-only Ball admin panel. Settings tab covers the full public-landing +
// wizard config surface (dates, venue, dinner + flat menu, split pricing,
// dress approvers + code + PDF, Weston contact, gallery). Attire Staff
// Accounts provisions the female-dress approvers' PINs AND Weston's
// male-guest-attire PIN (see ball-dress-set-pin's role param).
export default function BallPanel() {
  const [tab, setTab] = useState('overview');
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
    setConfig(cfg || {
      ball_date: '', signup_deadline: '', event_time_text: '', venue_address: '', venue_phone: '',
      dinner_caterer: '', dinner_menu: [], price_cadet: '', price_couple: '',
      field_trip_form_pdf_url: '', dress_code_text: '', dress_approvers: [emptyApprover(), emptyApprover(), emptyApprover()],
      weston_name: 'Weston', weston_phone: '',
    });
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

  const menu = Array.isArray(config?.dinner_menu) ? config.dinner_menu : [];
  function setMenuItem(i, field, value) {
    setConfig((c) => {
      const next = [...(c.dinner_menu || [])];
      next[i] = { ...(next[i] || { item: '', note: '' }), [field]: value };
      return { ...c, dinner_menu: next };
    });
  }
  function addMenuItem() { setConfig((c) => ({ ...c, dinner_menu: [...(c.dinner_menu || []), { item: '', note: '' }] })); }
  function removeMenuItem(i) { setConfig((c) => ({ ...c, dinner_menu: (c.dinner_menu || []).filter((_, idx) => idx !== i) })); }

  async function save() {
    setSaving(true);
    const cleanMenu = (config.dinner_menu || [])
      .map((m) => ({ item: (m.item || '').trim(), note: (m.note || '').trim() }))
      .filter((m) => m.item);
    const { error } = await SB.from('ball_config').update({
      ball_date: config.ball_date || null,
      signup_deadline: config.signup_deadline || null,
      event_time_text: config.event_time_text || null,
      venue_address: config.venue_address || null,
      venue_phone: config.venue_phone || null,
      dinner_caterer: config.dinner_caterer || null,
      dinner_menu: cleanMenu,
      price_cadet: config.price_cadet === '' || config.price_cadet == null ? null : Number(config.price_cadet),
      price_couple: config.price_couple === '' || config.price_couple == null ? null : Number(config.price_couple),
      field_trip_form_pdf_url: config.field_trip_form_pdf_url || null,
      dress_code_text: config.dress_code_text || null,
      dress_approvers: config.dress_approvers || [],
      weston_name: config.weston_name || null,
      weston_phone: config.weston_phone || null,
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
      <PanelHeader title="MILITARY BALL" sub="Public signup lives at /ball, linked from the main site nav" />
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        {TABS.map((t) => <Btn key={t.id} variant={tab === t.id ? 'gold' : 'ghost'} size="sm" onClick={() => setTab(t.id)}>{t.label}</Btn>)}
      </div>

      {tab === 'overview' && <BallOverviewTab />}
      {tab === 'dress-staff' && <BallDressStaffTab />}
      {tab === 'reviewers' && <BallReviewerAccountsTab />}

      {tab === 'settings' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: sp[3], marginBottom: sp[4] }}>
            <div><Label>BALL DATE</Label><Input type="date" value={config.ball_date || ''} onChange={(e) => setField('ball_date', e.target.value)} /></div>
            <div><Label>SIGNUP DEADLINE</Label><Input type="date" value={config.signup_deadline || ''} onChange={(e) => setField('signup_deadline', e.target.value)} /></div>
            <div><Label>EVENT TIME (text)</Label><Input value={config.event_time_text || ''} onChange={(e) => setField('event_time_text', e.target.value)} placeholder="5:00-9:00 PM" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: sp[3], marginBottom: sp[4] }}>
            <div><Label>VENUE ADDRESS</Label><Input value={config.venue_address || ''} onChange={(e) => setField('venue_address', e.target.value)} placeholder="1000 Alhambra Dr, Chattanooga, TN 37421" /></div>
            <div><Label>VENUE PHONE</Label><Input value={config.venue_phone || ''} onChange={(e) => setField('venue_phone', e.target.value)} placeholder="(423) 892-0223" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[4] }}>
            <div><Label>PRICE · CADET ($)</Label><Input type="number" step="0.01" value={config.price_cadet ?? ''} onChange={(e) => setField('price_cadet', e.target.value)} placeholder="35" /></div>
            <div><Label>PRICE · COUPLE ($, cadet + 1 guest)</Label><Input type="number" step="0.01" value={config.price_couple ?? ''} onChange={(e) => setField('price_couple', e.target.value)} placeholder="50" /></div>
          </div>

          <Label>DINNER CATERER</Label>
          <div style={{ marginBottom: sp[3] }}>
            <Input value={config.dinner_caterer || ''} onChange={(e) => setField('dinner_caterer', e.target.value)} placeholder="P.F. Chang's" />
          </div>
          <Label>DINNER MENU (flat list, leave empty to show "Menu announced soon")</Label>
          <div style={{ marginBottom: sp[4] }}>
            {menu.map((m, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: sp[2], marginBottom: sp[2] }}>
                <Input placeholder="Dish" value={m.item || ''} onChange={(e) => setMenuItem(i, 'item', e.target.value)} />
                <Input placeholder="Note (optional)" value={m.note || ''} onChange={(e) => setMenuItem(i, 'note', e.target.value)} />
                <button onClick={() => removeMenuItem(i)} style={{ ...miniBtn, color: P.red, padding: '0 12px' }}>DEL</button>
              </div>
            ))}
            <Btn size="sm" variant="ghost" onClick={addMenuItem}>+ ADD DISH</Btn>
          </div>

          <Label>FIELD TRIP PERMISSION FORM (PDF)</Label>
          <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', marginBottom: sp[2] }}>
            {config.field_trip_form_pdf_url && <a href={config.field_trip_form_pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: 12, color: P.gold }}>CURRENT PDF ↗</a>}
            <input ref={pdfRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={uploadPdf} />
            <Btn size="sm" onClick={() => pdfRef.current.click()}>{config.field_trip_form_pdf_url ? 'REPLACE' : 'UPLOAD'} PDF</Btn>
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginBottom: sp[4] }}>
            ⚠ The real field trip form document is still pending from Luke. Until it's uploaded, the wizard shows "pick one up from Chief's desk".
          </div>

          <Label>DRESS CODE TEXT (female cadets + female guests)</Label>
          <textarea
            value={config.dress_code_text || ''} onChange={(e) => setField('dress_code_text', e.target.value)} rows={5}
            style={{ width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: 12, marginBottom: sp[4] }}
          />

          <Label>DRESS APPROVERS (3, female attire)</Label>
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

          <Label>WESTON · MALE-GUEST ATTIRE CONTACT</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[2], marginBottom: sp[2] }}>
            <Input placeholder="Name" value={config.weston_name || ''} onChange={(e) => setField('weston_name', e.target.value)} />
            <Input placeholder="Phone" value={config.weston_phone || ''} onChange={(e) => setField('weston_phone', e.target.value)} />
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginBottom: sp[4] }}>
            Shown to male cadets (Class A questions) and male guests (attire photo approval). Provision his login PIN under "Attire Staff Accounts".
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
