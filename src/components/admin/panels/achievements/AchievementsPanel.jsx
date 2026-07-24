import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';

const ICON_BUCKET = 'achievement-icons';
const ICON_MIME = ['image/png', 'image/webp'];

function slugify(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function AchievementsPanel({ adminId }) {
  const [view, setView] = useState('catalog'); // catalog | assign
  const [achievements, setAchievements] = useState([]);
  const [holderCounts, setHolderCounts] = useState({}); // achievement_id -> count
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: ach }, { data: links }, { data: people }] = await Promise.all([
      SB.from('achievements').select('*').order('sort_order').order('name'),
      SB.from('cadet_achievements').select('achievement_id'),
      SB.from('personnel').select('id, name, role_short, photo_url').eq('visible', true).order('sort_order'),
    ]);
    setAchievements(ach || []);
    setPersonnel(people || []);
    const counts = {};
    for (const l of links || []) counts[l.achievement_id] = (counts[l.achievement_id] || 0) + 1;
    setHolderCounts(counts);
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{ display: 'flex', gap: sp[2] }}>
        <Btn variant={view === 'catalog' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('catalog')}>CATALOG</Btn>
        <Btn variant={view === 'assign' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('assign')}>ASSIGN TO CADETS</Btn>
      </div>
      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', padding: 24 }}>LOADING…</div>
      ) : view === 'catalog' ? (
        <CatalogView achievements={achievements} holderCounts={holderCounts} onChange={load} />
      ) : (
        <AssignView achievements={achievements} personnel={personnel} onChange={load} />
      )}
    </div>
  );
}

// ── Catalog: define achievement types (name, description, icon) ────────────
function CatalogView({ achievements, holderCounts, onChange }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  function onPickFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (f && !ICON_MIME.includes(f.type)) {
      alert('Icon must be a PNG or WEBP image (transparent background recommended).');
      return;
    }
    setFile(f);
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
    onChange();
  }

  async function remove(a) {
    if (!confirm(`Delete "${a.name}"? Removes it from every cadet who has it.`)) return;
    await SB.from('achievements').delete().eq('id', a.id);
    onChange();
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <PanelHeader
        title="ACHIEVEMENT CATALOG"
        sub={`${achievements.length} defined`}
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
          <Label>ICON — PNG OR WEBP, SQUARE, TRANSPARENT BACKGROUND</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[4] }}>
            <input ref={fileRef} type="file" accept="image/png,image/webp" style={{ display: 'none' }} onChange={onPickFile} />
            <Btn variant="ghost" size="sm" onClick={() => fileRef.current.click()}>{file ? file.name : 'CHOOSE FILE'}</Btn>
            {file && <img src={URL.createObjectURL(file)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
          </div>
          <Btn variant="gold" size="sm" onClick={create} disabled={saving || !name.trim() || !file}>{saving ? 'SAVING…' : 'CREATE ACHIEVEMENT'}</Btn>
        </Card>
      )}

      {achievements.length === 0 ? (
        <EmptyState icon="◈" title="NO ACHIEVEMENTS DEFINED" hint="Define your first achievement type — name, description, icon — then assign it to cadets." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {achievements.map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: sp[3],
              background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: '9px 12px',
            }}>
              <img src={a.icon_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream }}>{a.name}</div>
                {a.description && <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.faint, marginTop: 2 }}>{a.description}</div>}
              </div>
              <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, letterSpacing: '0.08em', flexShrink: 0 }}>
                {holderCounts[a.id] || 0} HOLDER{holderCounts[a.id] === 1 ? '' : 'S'}
              </span>
              <Btn variant="danger" size="sm" onClick={() => remove(a)}>DELETE</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assign: pick a cadet, add/remove their badges ───────────────────────────
function AssignView({ achievements, personnel, onChange }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [links, setLinks] = useState([]); // this cadet's cadet_achievements rows, joined
  const [addId, setAddId] = useState('');
  const [addDate, setAddDate] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return personnel;
    return personnel.filter((p) => `${p.name} ${p.role_short}`.toLowerCase().includes(q));
  }, [personnel, search]);

  useEffect(() => {
    if (!selected) { setLinks([]); return; }
    loadLinks(selected.id);
  }, [selected]);

  async function loadLinks(personnelId) {
    const { data } = await SB.from('cadet_achievements').select('id, date_earned, achievements(id, name, icon_url)').eq('personnel_id', personnelId);
    setLinks(data || []);
  }

  const available = achievements.filter((a) => !links.some((l) => l.achievements?.id === a.id));

  async function addAchievement() {
    if (!selected || !addId) return;
    await SB.from('cadet_achievements').insert({ personnel_id: selected.id, achievement_id: addId, date_earned: addDate || null });
    setAddId(''); setAddDate('');
    loadLinks(selected.id);
    onChange();
  }

  async function removeLink(linkId) {
    await SB.from('cadet_achievements').delete().eq('id', linkId);
    loadLinks(selected.id);
    onChange();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: sp[4], flex: 1, minHeight: 0 }}>
      <div style={{ overflowY: 'auto' }}>
        <PanelHeader title="CADETS" sub={`${filtered.length} of ${personnel.length}`} />
        <div style={{ marginBottom: sp[3] }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / role…" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1] }}>
          {filtered.map((p) => (
            <div key={p.id} onClick={() => setSelected(p)} style={{
              display: 'flex', alignItems: 'center', gap: sp[3], cursor: 'pointer',
              background: selected?.id === p.id ? P.navy : P.deep,
              border: `1px solid ${selected?.id === p.id ? P.gold : P.hair}`,
              borderRadius: 6, padding: '9px 11px',
            }}>
              {p.photo_url
                ? <img src={p.photo_url} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 5 }} alt="" />
                : <div style={{ width: 32, height: 32, borderRadius: 5, background: P.navy, border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: fs.sm, color: P.faint }}>{(p.name || '?').charAt(0)}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 2 }}>{p.role_short}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: sp[3], color: P.faint }}>
            <div style={{ fontFamily: mono, fontSize: fs.xxl, color: P.hairStrong }}>◈</div>
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, letterSpacing: '0.14em' }}>SELECT A CADET TO ASSIGN ACHIEVEMENTS</div>
          </div>
        ) : (
          <Card>
            <PanelHeader title={`ASSIGN · ${selected.name}`} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: sp[4] }}>
              {links.length === 0 && <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint }}>No achievements assigned yet.</div>}
              {links.map((l) => (
                <span key={l.id} style={{
                  fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.06em', padding: '5px 8px 5px 6px',
                  borderRadius: 4, border: `1px solid ${P.hairStrong}`, color: P.gold, background: P.goldWash,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <img src={l.achievements?.icon_url} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                  {l.achievements?.name?.toUpperCase()}
                  <button onClick={() => removeLink(l.id)} aria-label="Remove" style={{
                    all: 'unset', cursor: 'pointer', color: P.faint, fontSize: 11, lineHeight: 1,
                  }}>×</button>
                </span>
              ))}
            </div>

            {available.length > 0 ? (
              <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Label>ADD ACHIEVEMENT</Label>
                  <select value={addId} onChange={(e) => setAddId(e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {available.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>DATE EARNED (OPTIONAL)</Label>
                  <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} style={selectStyle} />
                </div>
                <Btn variant="gold" size="sm" onClick={addAchievement} disabled={!addId}>ADD</Btn>
              </div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, letterSpacing: '0.08em' }}>ALL DEFINED ACHIEVEMENTS ALREADY ASSIGNED</div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  width: '100%', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: mono, fontSize: 11, padding: '9px 10px', outline: 'none', cursor: 'pointer',
  borderRadius: radius.sm, boxSizing: 'border-box',
};
