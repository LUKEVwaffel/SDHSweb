import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';

const ICON_BUCKET = 'achievement-icons';
const ICON_MIME = ['image/png', 'image/webp'];

function slugify(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Define achievement types (name, description, icon). Assigning a defined
// achievement to a specific cadet happens on their People-panel detail view
// (see people/PersonAchievements.jsx), not here.
export default function AchievementCatalog() {
  const [achievements, setAchievements] = useState([]);
  const [holderCounts, setHolderCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [replacingId, setReplacingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [renaming, setRenaming] = useState(false);
  const fileRef = useRef();
  const replaceFileRef = useRef();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: ach }, { data: links }] = await Promise.all([
      SB.from('achievements').select('*').order('sort_order').order('name'),
      SB.from('cadet_achievements').select('achievement_id'),
    ]);
    setAchievements(ach || []);
    const counts = {};
    for (const l of links || []) counts[l.achievement_id] = (counts[l.achievement_id] || 0) + 1;
    setHolderCounts(counts);
    setLoading(false);
  }

  function onPickFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (f && !ICON_MIME.includes(f.type)) {
      alert('Icon must be a PNG or WEBP image (transparent background recommended).');
      return;
    }
    setFile(f);
  }

  function startReplaceIcon(a) {
    setReplacingId(a.id);
    // ref isn't attached yet on this render pass — flush to next tick.
    setTimeout(() => replaceFileRef.current?.click(), 0);
  }

  async function onReplaceIconPick(e) {
    const f = e.target.files[0];
    e.target.value = '';
    const a = achievements.find((x) => x.id === replacingId);
    setReplacingId(null);
    if (!f || !a) return;
    if (!ICON_MIME.includes(f.type)) {
      alert('Icon must be a PNG or WEBP image (transparent background recommended).');
      return;
    }
    const ext = f.name.split('.').pop();
    const path = `${a.slug}.${ext}`;
    await SB.storage.from(ICON_BUCKET).upload(path, f, { upsert: true, contentType: f.type });
    const { data: pub } = SB.storage.from(ICON_BUCKET).getPublicUrl(path);
    await SB.from('achievements').update({ icon_url: pub.publicUrl }).eq('id', a.id);
    load();
  }

  function startEditName(a) {
    setEditingId(a.id);
    setEditName(a.name);
    setEditDescription(a.description || '');
  }

  function cancelEditName() {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  }

  async function saveEditName(a) {
    const trimmedName = editName.trim();
    const trimmedDesc = editDescription.trim();
    if (!trimmedName) { cancelEditName(); return; }
    const nameChanged = trimmedName !== a.name;
    const descChanged = trimmedDesc !== (a.description || '');
    if (!nameChanged && !descChanged) { cancelEditName(); return; }
    setRenaming(true);
    await SB.from('achievements').update({ name: trimmedName, description: trimmedDesc || null }).eq('id', a.id);
    setRenaming(false);
    cancelEditName();
    load();
  }

  async function create() {
    if (!name.trim() || !file) return;
    setSaving(true);
    const slug = slugify(name);
    const ext = file.name.split('.').pop();
    const path = `${slug}.${ext}`;
    await SB.storage.from(ICON_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    const { data: pub } = SB.storage.from(ICON_BUCKET).getPublicUrl(path);
    await SB.from('achievements').insert({
      slug, name: name.trim(), description: description.trim() || null, icon_url: pub.publicUrl,
    });
    setName(''); setDescription(''); setFile(null); setCreating(false); setSaving(false);
    load();
  }

  async function remove(a) {
    const count = holderCounts[a.id] || 0;
    const holderMsg = count > 0 ? `Removes it from ${count} cadet${count === 1 ? '' : 's'} who ${count === 1 ? 'has' : 'have'} it.` : 'No cadets currently hold it.';
    if (!confirm(`Delete "${a.name}"? ${holderMsg}`)) return;
    await SB.from('achievements').delete().eq('id', a.id);
    load();
  }

  if (loading) {
    return <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', padding: 24 }}>LOADING…</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <PanelHeader
        title="ACHIEVEMENT CATALOG"
        sub={`${achievements.length} defined, assign to cadets from People`}
        action={<Btn variant="gold" size="sm" onClick={() => setCreating((c) => !c)}>{creating ? 'CANCEL' : '+ DEFINE NEW'}</Btn>}
      />

      {creating && (
        <Card style={{ marginBottom: sp[4] }}>
          <Label>NAME</Label>
          <div style={{ marginBottom: sp[3] }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Superior Cadet" />
          </div>
          <Label>DESCRIPTION (OPTIONAL)</Label>
          <div style={{ marginBottom: sp[3] }}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} multiline placeholder="Shown as a tooltip on the badge…" />
          </div>
          <Label>ICON: PNG OR WEBP, SQUARE, TRANSPARENT BACKGROUND</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[4] }}>
            <input ref={fileRef} type="file" accept="image/png,image/webp" style={{ display: 'none' }} onChange={onPickFile} />
            <Btn variant="ghost" size="sm" onClick={() => fileRef.current.click()}>{file ? file.name : 'CHOOSE FILE'}</Btn>
            {file && <img src={URL.createObjectURL(file)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
          </div>
          <Btn variant="gold" size="sm" onClick={create} disabled={saving || !name.trim() || !file}>{saving ? 'SAVING…' : 'CREATE ACHIEVEMENT'}</Btn>
        </Card>
      )}

      <input ref={replaceFileRef} type="file" accept="image/png,image/webp" style={{ display: 'none' }} onChange={onReplaceIconPick} />

      {achievements.length === 0 ? (
        <EmptyState icon="◈" title="NO ACHIEVEMENTS DEFINED" hint="Define your first achievement type (name, description, icon), then assign it to cadets from People." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {achievements.map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: sp[3],
              background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: '9px 12px',
            }}>
              <img src={a.icon_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === a.id ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }}>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditName(a);
                          if (e.key === 'Escape') cancelEditName();
                        }}
                        autoFocus
                        style={{ padding: '5px 8px', fontSize: fs.sm }}
                      />
                      <Btn variant="gold" size="sm" onClick={() => saveEditName(a)} disabled={renaming}>{renaming ? '…' : '✓'}</Btn>
                      <Btn variant="ghost" size="sm" onClick={cancelEditName} disabled={renaming}>✕</Btn>
                    </div>
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditName(a);
                        if (e.key === 'Escape') cancelEditName();
                      }}
                      placeholder="Description (optional)"
                      style={{ padding: '5px 8px', fontSize: fs.xs, marginTop: sp[2] }}
                    />
                  </div>
                ) : (
                  <div onClick={() => startEditName(a)} title="Click to edit" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, borderBottom: `1px dashed ${P.hair}`, display: 'inline-block' }}>
                      {a.name}
                    </div>
                    {a.description && <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.faint, marginTop: 2 }}>{a.description}</div>}
                  </div>
                )}
              </div>
              <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, letterSpacing: '0.08em', flexShrink: 0 }}>
                {holderCounts[a.id] || 0} HOLDER{holderCounts[a.id] === 1 ? '' : 'S'}
              </span>
              <Btn variant="ghost" size="sm" onClick={() => startReplaceIcon(a)}>REPLACE ICON</Btn>
              <Btn variant="danger" size="sm" onClick={() => remove(a)}>DELETE</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
