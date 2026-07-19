import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald, inter } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader } from '../../shared/ui';

const COMPANIES = [
  { id: 'alpha',   label: 'ALPHA' },
  { id: 'bravo',   label: 'BRAVO' },
  { id: 'charlie', label: 'CHARLIE' },
  { id: 'delta',   label: 'DELTA' },
  { id: 'staff',   label: 'STAFF' },
];

const STATUSES = [
  { id: 'collected', label: 'COLLECTED', color: P.green },
  { id: 'pending',   label: 'PENDING',   color: P.mute },
  { id: 'declined',  label: 'DECLINED',  color: P.red },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cadet database, organized by company. Each row is both a photo-consent record
// AND the cadet's contact record — same `cadet_consent` table (run
// supabase/cadet_consent.sql + supabase/cadet_consent_contact.sql first).
// Click a cadet to open the detail view: edit contact fields, set consent
// status, and promote a parent email into the mailing list.
export default function ConsentSection({ adminId }) {
  const [company, setCompany] = useState('alpha');
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [newName, setNewName] = useState('');

  // detail view state
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [detailMsg, setDetailMsg] = useState('');
  const [listMsg, setListMsg] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.from('cadet_consent').select('*').eq('company', company).order('sort_order').order('name');
    if (error) { setMissing(true); setRows([]); return; }
    setMissing(false);
    setRows(data || []);
  }, [company]);

  useEffect(() => { load(); }, [load]);

  // Reset detail when switching companies.
  useEffect(() => { setSelectedId(null); setForm({}); setDetailMsg(''); setListMsg(''); }, [company]);

  function openCadet(row) {
    setSelectedId(row.id);
    setForm({ ...row });
    setDetailMsg('');
    setListMsg('');
  }

  async function setStatus(row, status) {
    const patch = {
      consent_status: status,
      collected_at: status === 'collected' ? new Date().toISOString() : null,
      collected_by: status === 'collected' ? adminId : null,
      updated_at: new Date().toISOString(),
    };
    await SB.from('cadet_consent').update(patch).eq('id', row.id);
    if (selectedId === row.id) setForm((f) => ({ ...f, ...patch }));
    load();
  }

  async function saveDetail() {
    if (!selectedId) return;
    setSaving(true);
    const patch = {
      name: (form.name || '').trim(),
      role: form.role || null,
      school_email: (form.school_email || '').trim() || null,
      parent_email: (form.parent_email || '').trim() || null,
      note: form.note || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await SB.from('cadet_consent').update(patch).eq('id', selectedId);
    setSaving(false);
    setDetailMsg(error ? error.message : 'Saved ✓');
    setTimeout(() => setDetailMsg(''), 2500);
    load();
  }

  // Promote the cadet's parent email into email_subscribers. Explicit action,
  // deduped by email — no DB trigger.
  async function addParentToList() {
    const email = (form.parent_email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setListMsg('Enter a valid parent email first'); return; }
    const { data: existing } = await SB.from('email_subscribers').select('id').eq('email', email).maybeSingle();
    if (existing) { setListMsg('Already on the mailing list'); return; }
    const { error } = await SB.from('email_subscribers').insert({ email, source: 'manual', company });
    setListMsg(error ? (error.code === '23505' ? 'Already on the mailing list' : error.message) : 'Added to mailing list ✓');
    setTimeout(() => setListMsg(''), 3000);
  }

  async function addCadet() {
    if (!newName.trim()) return;
    const maxOrder = Math.max(0, ...rows.map((r) => r.sort_order || 0));
    await SB.from('cadet_consent').insert({ name: newName.trim(), company, sort_order: maxOrder + 1 });
    setNewName('');
    load();
  }

  async function del(row) {
    if (!confirm(`Remove ${row.name} from the cadet roster?`)) return;
    await SB.from('cadet_consent').delete().eq('id', row.id);
    if (selectedId === row.id) { setSelectedId(null); setForm({}); }
    load();
  }

  const collected = rows.filter((r) => r.consent_status === 'collected').length;
  const pct = rows.length ? Math.round((collected / rows.length) * 100) : 0;

  if (missing) {
    return (
      <div>
        <PanelHeader title="CADET DATABASE · BY COMPANY" />
        <Card>
          <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, lineHeight: 1.9 }}>
            <div style={{ color: P.gold }}>CADET TABLE NOT FOUND</div>
            <div>Run <span style={{ color: P.cream }}>supabase/cadet_consent.sql</span> then <span style={{ color: P.cream }}>supabase/cadet_consent_contact.sql</span> in the Supabase SQL editor.</div>
            <div>Then import the roster (sectioned by company) and it appears here.</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PanelHeader title="CADET DATABASE · BY COMPANY" />
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {COMPANIES.map((c) => (
          <Btn key={c.id} variant={company === c.id ? 'gold' : 'ghost'} onClick={() => setCompany(c.id)} style={{ fontSize: 9 }}>{c.label}</Btn>
        ))}
      </div>

      {/* progress */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Label>CONSENT COLLECTED</Label>
          <div style={{ fontFamily: oswald, fontSize: 20, color: P.cream }}>
            {collected} / {rows.length} <span style={{ fontSize: 13, color: P.gold }}>· {pct}%</span>
          </div>
        </div>
        <div style={{ height: 8, background: P.deep, border: `1px solid ${P.hair}` }}>
          <div style={{ height: '100%', width: `${pct}%`, background: P.gold, transition: 'width 0.2s' }} />
        </div>
      </Card>

      {/* add */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1, fontSize: 11 }}
          placeholder="Add cadet name…" onKeyDown={(e) => e.key === 'Enter' && addCadet()} />
        <Btn onClick={addCadet} variant="ghost" style={{ fontSize: 9 }}>+ ADD CADET</Btn>
      </div>

      {/* roster (left) + detail (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, alignItems: 'start' }}>
        {/* roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r) => {
            const on = selectedId === r.id;
            return (
              <Card key={r.id} onClick={() => openCadet(r)} style={{
                padding: '7px 10px', cursor: 'pointer',
                background: on ? P.navy : P.deep,
                border: `1px solid ${on ? P.gold : P.hair}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: inter, fontSize: 12, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>
                      {r.parent_email ? '✉ parent on file' : 'no parent email'}
                      {r.consent_status === 'collected' && r.collected_at ? ` · signed ${new Date(r.collected_at).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }} onClick={(e) => e.stopPropagation()}>
                    {STATUSES.map((s) => {
                      const active = r.consent_status === s.id;
                      return (
                        <button key={s.id} onClick={() => setStatus(r, s.id)} title={s.label} style={{
                          background: active ? s.color : 'transparent',
                          border: `1px solid ${active ? s.color : P.hair}`,
                          color: active ? (s.id === 'pending' ? P.ink : '#fff') : P.mute,
                          cursor: 'pointer', fontFamily: mono, fontSize: 8, letterSpacing: '0.1em', padding: '4px 7px',
                        }}>{s.label}</button>
                      );
                    })}
                    <button onClick={() => del(r)} style={{ background: 'none', border: 'none', color: P.red, cursor: 'pointer', fontSize: 12 }}>×</button>
                  </div>
                </div>
              </Card>
            );
          })}
          {!rows.length && (
            <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', padding: 24 }}>
              NO CADETS FOR {company.toUpperCase()} YET · add above or import the roster
            </div>
          )}
        </div>

        {/* detail */}
        <div style={{ position: 'sticky', top: 0 }}>
          {form.id ? (
            <Card>
              <PanelHeader title={`CADET · ${(form.name || '').toUpperCase() || 'UNNAMED'}`} action={
                <Btn onClick={saveDetail} variant="gold" disabled={saving} style={{ fontSize: 9 }}>
                  {saving ? 'SAVING…' : 'SAVE'}
                </Btn>
              } />

              <div style={{ marginBottom: 8 }}>
                <Label>NAME</Label>
                <Input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <Label>ROLE / RANK</Label>
                <Input value={form.role || ''} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="cadet, staff, rank…" />
              </div>

              {/* consent status */}
              <div style={{ marginBottom: 10 }}>
                <Label>PHOTO CONSENT</Label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {STATUSES.map((s) => {
                    const active = form.consent_status === s.id;
                    return (
                      <button key={s.id} onClick={() => setStatus(form, s.id)} style={{
                        flex: 1, background: active ? s.color : 'transparent',
                        border: `1px solid ${active ? s.color : P.hair}`,
                        color: active ? (s.id === 'pending' ? P.ink : '#fff') : P.mute,
                        cursor: 'pointer', fontFamily: mono, fontSize: 8, letterSpacing: '0.1em', padding: '6px 4px',
                      }}>{s.label}</button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <Label>SCHOOL EMAIL</Label>
                <Input value={form.school_email || ''} onChange={(e) => setForm((f) => ({ ...f, school_email: e.target.value }))} placeholder="filled in by S-6" />
              </div>
              <div style={{ marginBottom: 8 }}>
                <Label>PARENT EMAIL</Label>
                <Input value={form.parent_email || ''} onChange={(e) => setForm((f) => ({ ...f, parent_email: e.target.value }))} placeholder="feeds the mailing list" />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <Btn onClick={addParentToList} variant="green" style={{ fontSize: 8 }}>+ ADD PARENT TO MAILING LIST</Btn>
                  {listMsg && <span style={{ fontFamily: mono, fontSize: 8, color: listMsg.includes('✓') ? P.green : P.mute }}>{listMsg}</span>}
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <Label>NOTE</Label>
                <Input value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} multiline />
              </div>

              {detailMsg && <div style={{ fontFamily: mono, fontSize: 9, color: detailMsg.includes('✓') ? P.green : P.red }}>{detailMsg}</div>}
            </Card>
          ) : (
            <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', padding: '40px 16px', border: `1px dashed ${P.hair}` }}>
              SELECT A CADET →<br />to edit contact info & consent
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
