import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Subscribers() {
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [single, setSingle] = useState('');
  const [bulk, setBulk] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.from('email_subscribers').select('*').order('created_at', { ascending: false });
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addSingle() {
    const email = single.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setMsg('Invalid email'); return; }
    const { error } = await SB.from('email_subscribers').insert({ email, source: 'manual' });
    setMsg(error ? (error.code === '23505' ? 'Already on the list' : error.message) : 'Added ✓');
    setSingle('');
    load();
    setTimeout(() => setMsg(''), 2500);
  }

  async function importBulk() {
    const emails = [...new Set(bulk.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
    if (!emails.length) { setMsg('No valid emails found'); return; }
    const payload = emails.map((email) => ({ email, source: 'manual' }));
    const { error } = await SB.from('email_subscribers').upsert(payload, { onConflict: 'email', ignoreDuplicates: true });
    setMsg(error ? error.message : `Imported ${emails.length} email(s) ✓`);
    setBulk('');
    load();
    setTimeout(() => setMsg(''), 3000);
  }

  async function toggleActive(row) {
    await SB.from('email_subscribers').update({ active: !row.active }).eq('id', row.id);
    load();
  }

  async function del(row) {
    if (!confirm(`Remove ${row.email}?`)) return;
    await SB.from('email_subscribers').delete().eq('id', row.id);
    load();
  }

  if (missing) {
    return (
      <Card>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, lineHeight: 1.9 }}>
          <div style={{ color: P.gold }}>EMAIL TABLES NOT FOUND</div>
          <div>Run <span style={{ color: P.cream }}>supabase/email_system.sql</span> in the Supabase SQL editor first.</div>
        </div>
      </Card>
    );
  }

  const active = rows.filter((r) => r.active).length;
  const filtered = search ? rows.filter((r) => r.email.includes(search.toLowerCase())) : rows;

  return (
    <div style={{ maxWidth: 760 }}>
      <PanelHeader title="SUBSCRIBERS" sub={`${active} active · ${rows.length} total`} />
      <Card style={{ marginBottom: sp[3] }}>
        <Label>Add one</Label>
        <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
          <Input value={single} onChange={(e) => setSingle(e.target.value)} style={{ flex: 1 }} placeholder="parent@example.com"
            onKeyDown={(e) => e.key === 'Enter' && addSingle()} />
          <Btn onClick={addSingle} variant="gold" size="sm">+ ADD</Btn>
        </div>
        <Label>Paste / import (any separators)</Label>
        <Input value={bulk} onChange={(e) => setBulk(e.target.value)} multiline style={{ marginBottom: sp[2] }} placeholder="Paste emails separated by commas, spaces, or new lines…" />
        <div style={{ display: 'flex', gap: sp[3], alignItems: 'center' }}>
          <Btn onClick={importBulk} variant="ghost" size="sm">IMPORT LIST</Btn>
          {msg && <span style={{ fontFamily: mono, fontSize: fs.tiny, color: msg.includes('✓') ? P.green : P.red }}>{msg}</span>}
        </div>
      </Card>

      <div style={{ marginBottom: sp[2] }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subscribers…" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1] }}>
        {filtered.map((r) => (
          <Card key={r.id} style={{ padding: `${sp[2]}px ${sp[4]}px` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.active ? P.green : P.faint, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: fs.sm, color: r.active ? P.cream : P.mute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 2 }}>{r.source}{r.company ? ` · ${r.company}` : ''}</div>
              </div>
              <Btn onClick={() => toggleActive(r)} variant={r.active ? 'ghost' : 'default'} size="sm">{r.active ? 'ACTIVE' : 'INACTIVE'}</Btn>
              <button onClick={() => del(r)} style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: fs.md }}>×</button>
            </div>
          </Card>
        ))}
        {!filtered.length && (
          <EmptyState icon="✉" title={search ? 'NO MATCHING SUBSCRIBERS' : 'NO SUBSCRIBERS YET'} hint={search ? 'Try a different search.' : 'Parents subscribe from the home page, or add them here manually.'} />
        )}
      </div>
    </div>
  );
}
