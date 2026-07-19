import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader } from '../../shared/ui';

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
    <div>
      <PanelHeader title={`SUBSCRIBERS · ${active} active / ${rows.length} total`} />
      <Card style={{ marginBottom: 10 }}>
        <Label>ADD ONE</Label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <Input value={single} onChange={(e) => setSingle(e.target.value)} style={{ flex: 1, fontSize: 11 }}
            onKeyDown={(e) => e.key === 'Enter' && addSingle()} />
          <Btn onClick={addSingle} variant="gold" style={{ fontSize: 9 }}>+ ADD</Btn>
        </div>
        <Label>PASTE / IMPORT (any separators)</Label>
        <Input value={bulk} onChange={(e) => setBulk(e.target.value)} multiline style={{ marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn onClick={importBulk} variant="ghost" style={{ fontSize: 9 }}>IMPORT LIST</Btn>
          {msg && <span style={{ fontFamily: mono, fontSize: 9, color: msg.includes('✓') ? P.green : P.red }}>{msg}</span>}
        </div>
      </Card>

      <div style={{ marginBottom: 8 }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} style={{ fontSize: 11 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {filtered.map((r) => (
          <Card key={r.id} style={{ padding: '6px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: 12, color: r.active ? P.cream : P.mute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                <div style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>{r.source}{r.company ? ` · ${r.company}` : ''}</div>
              </div>
              <Btn onClick={() => toggleActive(r)} variant={r.active ? 'ghost' : 'default'} style={{ fontSize: 8 }}>{r.active ? 'ACTIVE' : 'INACTIVE'}</Btn>
              <button onClick={() => del(r)} style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: 12 }}>×</button>
            </div>
          </Card>
        ))}
        {!filtered.length && <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', padding: 20 }}>NO SUBSCRIBERS YET</div>}
      </div>
    </div>
  );
}
