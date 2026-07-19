import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader } from '../../shared/ui';
import ConsentSection from './ConsentSection';

// Section display order + friendly names. Personnel `section` values seen in the
// app: staff / command / s-1..s-6 / company-alpha..delta. Unknown sections fall
// through to an "OTHER" bucket so nothing is ever hidden.
const SECTION_ORDER = [
  'command', 'staff',
  's-1', 's-2', 's-3', 's-4', 's-5', 's-6',
  'company-alpha', 'company-bravo', 'company-charlie', 'company-delta',
];
const SECTION_LABEL = {
  command: 'COMMAND', staff: 'STAFF',
  's-1': 'S-1', 's-2': 'S-2', 's-3': 'S-3', 's-4': 'S-4', 's-5': 'S-5', 's-6': 'S-6',
  'company-alpha': 'ALPHA CO', 'company-bravo': 'BRAVO CO',
  'company-charlie': 'CHARLIE CO', 'company-delta': 'DELTA CO',
};

function groupBySection(records) {
  const map = {};
  for (const r of records) {
    const key = r.section || 'other';
    (map[key] ||= []).push(r);
  }
  const known = SECTION_ORDER.filter((s) => map[s]);
  const unknown = Object.keys(map).filter((s) => !SECTION_ORDER.includes(s)).sort();
  return [...known, ...unknown].map((s) => [s, map[s]]);
}

export default function PeoplePanel({ adminId }) {
  const [records, setRecords] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('directory');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await SB.from('personnel').select('*').order('sort_order');
    setRecords(data || []);
  }

  function startEdit(r) {
    setEditing(r.id);
    setForm({ ...r });
  }

  async function save() {
    setSaving(true);
    await SB.from('personnel').upsert({ ...form, updated_at: new Date().toISOString() });
    await SB.from('change_log').insert({ admin_id: adminId, page: 'personnel', element: form.id, label: form.name, value_before: {}, value_after: form });
    setEditing(null);
    setSaving(false);
    load();
  }

  async function addNew() {
    const maxOrder = Math.max(0, ...records.map(r => r.sort_order));
    const newId = `person_${Date.now()}`;
    await SB.from('personnel').insert({
      id: newId, section: 'staff', role_short: 'NEW', role_long: 'New Member', name: 'New Member',
      bio: '', bio_long: '', let_level: '1', rank: '', graduating: '', sort_order: maxOrder + 1, visible: true,
    });
    load();
  }

  async function deleteRecord(id, name) {
    if (!confirm(`Delete ${name}?`)) return;
    await SB.from('change_log').insert({ admin_id: adminId, page: 'personnel', element: id, label: `DELETE: ${name}`, value_before: records.find(r=>r.id===id), value_after: null });
    await SB.from('personnel').delete().eq('id', id);
    if (editing === id) setEditing(null);
    load();
  }

  const f = (k, l, opts = {}) => (
    <div style={{ marginBottom: 8 }}>
      <Label>{l}</Label>
      {opts.type === 'toggle' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          {[true,false].map(v => (
            <Btn key={String(v)} variant={form[k]===v?'gold':'ghost'} onClick={() => setForm(f=>({...f,[k]:v}))} style={{ fontSize: 9 }}>
              {v?'VISIBLE':'HIDDEN'}
            </Btn>
          ))}
        </div>
      ) : (
        <Input value={form[k]||''} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} multiline={opts.multiline} />
      )}
    </div>
  );

  const groups = groupBySection(records);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn variant={view === 'directory' ? 'gold' : 'ghost'} onClick={() => setView('directory')} style={{ fontSize: 9 }}>DIRECTORY</Btn>
        <Btn variant={view === 'consent' ? 'gold' : 'ghost'} onClick={() => setView('consent')} style={{ fontSize: 9 }}>CADET DATABASE</Btn>
      </div>
      {view === 'consent' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><ConsentSection adminId={adminId} /></div>
      ) : (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ overflowY: 'auto' }}>
        <PanelHeader title="PEOPLE" action={<Btn onClick={addNew} variant="gold" style={{ fontSize: 9 }}>+ ADD</Btn>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(([section, items]) => (
            <div key={section}>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                <span>{SECTION_LABEL[section] || section.toUpperCase()}</span>
                <span style={{ color: P.mute }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: editing===r.id ? P.navy : P.deep,
                    border: `1px solid ${editing===r.id ? P.gold : P.hair}`,
                    padding: '6px 8px', cursor: 'pointer',
                  }} onClick={() => startEdit(r)}>
                    {r.photo_url && <img src={r.photo_url} style={{ width: 28, height: 28, objectFit: 'cover' }} alt="" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: inter, fontSize: 11, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{r.role_short}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteRecord(r.id, r.name); }}
                      style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ overflowY: 'auto' }}>
        {editing ? (
          <Card>
            <PanelHeader title={`EDITING: ${form.name || 'NEW'}`} action={
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn onClick={() => setEditing(null)} variant="ghost" style={{ fontSize: 9 }}>CANCEL</Btn>
                <Btn onClick={save} variant="gold" disabled={saving} style={{ fontSize: 9 }}>{saving?'SAVING…':'SAVE'}</Btn>
              </div>
            }/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {f('name','NAME')} {f('rank','RANK')}
              {f('role_short','ROLE SHORT')} {f('role_long','ROLE LONG')}
              {f('section','SECTION')} {f('let_level','LET LEVEL')}
              {f('graduating','GRADUATING')} {f('sort_order','SORT ORDER')}
            </div>
            {f('bio','SHORT BIO', { multiline: true })}
            {f('bio_long','FULL BIO', { multiline: true })}
            {f('photo_url','PHOTO URL')}
            {form.photo_url && <img src={form.photo_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', marginBottom: 8 }} />}
            {f('visible','VISIBILITY', { type: 'toggle' })}
          </Card>
        ) : (
          <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 60 }}>← SELECT A RECORD</div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
