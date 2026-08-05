import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald, inter, fs, sp, radius, shadow, ease } from '../../theme';
import { Btn, Card, Label, Input, Select, SuffixEmailInput, StatusPills, Toast, Modal, PanelHeader, EmptyState } from '../../shared/ui';
import { TEAMS } from '../../../../lib/teams';

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

const GRADE_OPTIONS = [
  { value: '', label: '—' },
  { value: '9',  label: '9TH' },
  { value: '10', label: '10TH' },
  { value: '11', label: '11TH' },
  { value: '12', label: '12TH' },
];

const LET_OPTIONS = [
  { value: '', label: '—' },
  { value: '1', label: 'LET 1' },
  { value: '2', label: 'LET 2' },
  { value: '3', label: 'LET 3' },
  { value: '4', label: 'LET 4' },
];

const BLANK_ADD_FORM = { name: '', grade: '', let_level: '', school_email: '', parent_email: '' };

// Cadet database, organized by company. Each row is both a photo-consent record
// AND the cadet's contact record — same `cadet_consent` table (run
// supabase/cadet_consent.sql + supabase/cadet_consent_contact.sql first).
// Click a cadet to open the detail view: edit contact fields, set consent
// status, and promote a parent email into the mailing list.
export default function ConsentSection({ adminId }) {
  const [company, setCompany] = useState('alpha');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [missing, setMissing] = useState(false);

  // add-cadet popup
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_ADD_FORM);
  const [addCompany, setAddCompany] = useState('alpha');
  const [addNameErr, setAddNameErr] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [addErr, setAddErr] = useState(false);

  // detail view state
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [detailMsg, setDetailMsg] = useState('');
  const [detailErr, setDetailErr] = useState(false);
  const [listMsg, setListMsg] = useState('');
  const [listErr, setListErr] = useState(false);

  // real team-membership — this is what OpticSend reads (via cadet_teams
  // joined to school_email/parent_email on this same row). See
  // supabase/opticsend.sql SECTION 3.
  const [cadetTeams, setCadetTeams] = useState([]);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('cadet_consent').select('*').eq('company', company).order('sort_order').order('name');
    if (error) { setMissing(true); setRows([]); return; }
    setMissing(false);
    setRows(data || []);
  }, [company]);

  // Per-company counts for the tab row — independent of the active filter so
  // every tab shows a real number, not just the one you're currently on.
  const loadCounts = useCallback(async () => {
    const { data } = await SB.from('cadet_consent').select('company');
    const c = {};
    for (const r of data || []) c[r.company] = (c[r.company] || 0) + 1;
    setCounts(c);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  // Reset detail when switching companies. Default the add-cadet popup's
  // company to the active tab, but it stays independently editable there.
  useEffect(() => { setSelectedId(null); setForm({}); setDetailMsg(''); setListMsg(''); setAddCompany(company); }, [company]);

  function openCadet(row) {
    setSelectedId(row.id);
    setForm({ ...row });
    setDetailMsg('');
    setListMsg('');
    loadCadetTeams(row.id);
  }

  async function loadCadetTeams(cadetConsentId) {
    const { data } = await SB.from('cadet_teams').select('team').eq('cadet_consent_id', cadetConsentId);
    setCadetTeams((data || []).map((r) => r.team));
  }

  async function toggleCadetTeam(cadetConsentId, team, on) {
    if (on) {
      await SB.from('cadet_teams').delete().eq('cadet_consent_id', cadetConsentId).eq('team', team);
    } else {
      await SB.from('cadet_teams').insert({ cadet_consent_id: cadetConsentId, team });
    }
    loadCadetTeams(cadetConsentId);
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
      grade: form.grade || null,
      let_level: form.let_level || null,
      school_email: (form.school_email || '').trim() || null,
      parent_email: (form.parent_email || '').trim() || null,
      note: form.note || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await SB.from('cadet_consent').update(patch).eq('id', selectedId);
    setSaving(false);
    setDetailErr(!!error);
    setDetailMsg(error ? error.message : 'Saved');
    setTimeout(() => setDetailMsg(''), 2500);
    if (!error && patch.school_email) enrollSchoolEmail(patch.school_email, company);
    load();
  }

  // school_email is always part of the battalion mailing list — unlike
  // parent_email (opt-in via the button below), no explicit action needed.
  // Same dedupe-by-email pattern as addParentToList, called silently on
  // create/update whenever a school email is on the row.
  async function enrollSchoolEmail(email, companyTag) {
    const clean = (email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return;
    const { data: existing } = await SB.from('email_subscribers').select('id').eq('email', clean).maybeSingle();
    if (existing) return;
    await SB.from('email_subscribers').insert({ email: clean, source: 'manual', company: companyTag });
  }

  // Promote the cadet's parent email into email_subscribers. Explicit action,
  // deduped by email — no DB trigger.
  async function addParentToList() {
    const email = (form.parent_email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setListErr(true); setListMsg('Enter a valid parent email first'); return; }
    const { data: existing } = await SB.from('email_subscribers').select('id').eq('email', email).maybeSingle();
    if (existing) { setListErr(true); setListMsg('Already on the mailing list'); return; }
    const { error } = await SB.from('email_subscribers').insert({ email, source: 'manual', company });
    setListErr(!!error);
    setListMsg(error ? (error.code === '23505' ? 'Already on the mailing list' : error.message) : 'Added to mailing list');
    setTimeout(() => setListMsg(''), 3000);
  }

  function openAddModal() {
    setAddForm(BLANK_ADD_FORM);
    setAddCompany(company);
    setAddNameErr(false);
    setAddOpen(true);
  }

  async function submitAddCadet() {
    const name = addForm.name.trim();
    if (!name) { setAddNameErr(true); return; }
    setAddNameErr(false);
    setAdding(true);
    const maxOrder = Math.max(0, ...rows.map((r) => r.sort_order || 0));
    const payload = {
      name,
      company: addCompany,
      grade: addForm.grade || null,
      let_level: addForm.let_level || null,
      school_email: addForm.school_email.trim() || null,
      parent_email: addForm.parent_email.trim() || null,
      sort_order: maxOrder + 1,
    };
    const { error } = await SB.from('cadet_consent').insert(payload);
    setAdding(false);
    setAddErr(!!error);
    setAddMsg(error ? error.message : `Added ${name} to ${addCompany.toUpperCase()}`);
    if (error) return; // leave the popup open + message visible so they can fix and retry
    if (payload.school_email) enrollSchoolEmail(payload.school_email, addCompany);
    setAddOpen(false);
    setTimeout(() => setAddMsg(''), 3000);
    loadCounts();
    if (addCompany === company) load();
  }

  async function del(row) {
    if (!confirm(`Remove ${row.name} from the cadet roster?`)) return;
    await SB.from('cadet_consent').delete().eq('id', row.id);
    if (selectedId === row.id) { setSelectedId(null); setForm({}); }
    load();
    loadCounts();
  }

  const collected = rows.filter((r) => r.consent_status === 'collected').length;
  const pct = rows.length ? Math.round((collected / rows.length) * 100) : 0;

  if (missing) {
    return (
      <div>
        <PanelHeader title="CADET DATABASE · BY COMPANY" />
        <Card>
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, lineHeight: 1.9 }}>
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
      <PanelHeader title="CADET DATABASE" />

      {/* company tabs — subordinate to the Staff/Command ↔ Cadet Database
          switch one level up (PeoplePanel), so this reads as "filter within
          this view" rather than another top-level nav. */}
      <div style={{ display: 'flex', gap: sp[5], borderBottom: `1px solid ${P.hair}`, marginBottom: sp[4], flexWrap: 'wrap' }}>
        {COMPANIES.map((c) => {
          const active = company === c.id;
          return (
            <button key={c.id} onClick={() => setCompany(c.id)} style={{
              fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.14em', fontWeight: 500,
              padding: `0 0 ${sp[2]}px`, marginBottom: -1, border: 'none', background: 'none', cursor: 'pointer',
              color: active ? P.gold : P.faint, borderBottom: `2px solid ${active ? P.gold : 'transparent'}`,
              transition: `color 0.15s ${ease}, border-color 0.15s ${ease}`,
            }}>
              {c.label} <span style={{ color: P.faint, fontSize: fs.micro }}>{counts[c.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* progress */}
      <Card style={{ marginBottom: sp[4] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: sp[2] }}>
          <Label style={{ marginBottom: 0 }}>CONSENT COLLECTED</Label>
          <div style={{ fontFamily: oswald, fontSize: fs.lg, color: P.cream }}>
            {collected} / {rows.length} <span style={{ fontSize: fs.sm, color: P.gold }}>· {pct}%</span>
          </div>
        </div>
        <div style={{ height: 7, background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${P.gold}, ${P.bright})`, transition: `width 0.3s ${ease}` }} />
        </div>
      </Card>

      {/* add */}
      <div style={{ marginBottom: sp[2] }}>
        <Btn onClick={openAddModal} variant="gold" size="sm">+ ADD CADET</Btn>
      </div>
      <div style={{ marginBottom: sp[4], minHeight: fs.tiny }}>
        <Toast tone={addErr ? 'error' : 'success'}>{addMsg}</Toast>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="ADD CADET" footer={<>
        <Btn onClick={() => setAddOpen(false)} variant="ghost" size="sm">CANCEL</Btn>
        <Btn onClick={submitAddCadet} variant="gold" size="sm" disabled={adding}>{adding ? 'ADDING…' : 'ADD CADET'}</Btn>
      </>}>
        <div style={{ marginBottom: sp[3] }}>
          <Label>NAME *</Label>
          <Input value={addForm.name} error={addNameErr} placeholder="Cadet full name" autoFocus
            onChange={(e) => { setAddForm((f) => ({ ...f, name: e.target.value })); if (addNameErr) setAddNameErr(false); }} />
          {addNameErr && <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.red, marginTop: sp[1] }}>Enter a name first</div>}
        </div>

        <div style={{ marginBottom: sp[3] }}>
          <Label>COMPANY *</Label>
          <Select value={addCompany} onChange={(e) => setAddCompany(e.target.value)}
            options={COMPANIES.map((c) => ({ value: c.id, label: c.label }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `0 ${sp[3]}px`, marginBottom: sp[3] }}>
          <div>
            <Label>GRADE</Label>
            <Select value={addForm.grade} onChange={(e) => setAddForm((f) => ({ ...f, grade: e.target.value }))} options={GRADE_OPTIONS} />
          </div>
          <div>
            <Label>LET LEVEL</Label>
            <Select value={addForm.let_level} onChange={(e) => setAddForm((f) => ({ ...f, let_level: e.target.value }))} options={LET_OPTIONS} />
          </div>
        </div>

        <div style={{ marginBottom: sp[3] }}>
          <Label>SCHOOL EMAIL</Label>
          <SuffixEmailInput value={addForm.school_email} onChange={(v) => setAddForm((f) => ({ ...f, school_email: v }))} />
        </div>

        <div style={{ marginBottom: sp[1] }}>
          <Label>PARENT EMAIL</Label>
          <Input value={addForm.parent_email} onChange={(e) => setAddForm((f) => ({ ...f, parent_email: e.target.value }))} placeholder="feeds the mailing list" />
        </div>

        {/* lives inside the modal (not just the page-level toast below) so an
            insert error is actually visible — the modal overlay would hide the
            outer toast completely while open. */}
        <Toast tone={addErr ? 'error' : 'success'} style={{ marginTop: sp[2] }}>{addMsg}</Toast>
      </Modal>

      {/* roster (left) + detail (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: sp[4], alignItems: 'start' }}>
        {/* roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1] }}>
          {rows.map((r) => {
            const on = selectedId === r.id;
            return (
              <div key={r.id} onClick={() => openCadet(r)} style={{
                display: 'flex', alignItems: 'center', gap: sp[3], cursor: 'pointer',
                background: on ? P.navyLift : P.navy,
                border: `1px solid ${on ? P.gold : P.hair}`,
                borderRadius: radius.md, padding: `${sp[2]}px ${sp[3]}px`,
                boxShadow: on ? shadow.sm : 'none',
                transition: `border-color 0.15s ${ease}, box-shadow 0.15s ${ease}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: radius.sm, background: P.deep, border: `1px solid ${P.hair}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontFamily: mono, fontSize: fs.sm, color: P.faint,
                }}>{(r.name || '?').charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, marginTop: 2 }}>
                    {r.grade ? `${r.grade}TH` : ''}{r.grade && r.let_level ? ' · ' : ''}{r.let_level ? `LET ${r.let_level}` : ''}{(r.grade || r.let_level) ? ' · ' : ''}
                    {r.parent_email ? '✉ parent on file' : 'no parent email'}
                    {r.consent_status === 'collected' && r.collected_at ? ` · signed ${new Date(r.collected_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }} onClick={(e) => e.stopPropagation()}>
                  <StatusPills items={STATUSES} value={r.consent_status} onChange={(id) => setStatus(r, id)} size="compact" />
                  <button onClick={() => del(r)} title="Remove cadet" style={{
                    width: 30, height: 30, borderRadius: radius.sm, border: '1px solid transparent',
                    background: 'transparent', color: P.faint, cursor: 'pointer', fontSize: fs.base,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: `all 0.15s ${ease}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = P.red; e.currentTarget.style.background = 'rgba(192,57,43,0.12)'; e.currentTarget.style.borderColor = 'rgba(192,57,43,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = P.faint; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >✕</button>
                </div>
              </div>
            );
          })}
          {!rows.length && (
            <EmptyState title={`NO CADETS FOR ${company.toUpperCase()} YET`} hint="Add one above, or import the roster." />
          )}
        </div>

        {/* detail */}
        <div style={{ position: 'sticky', top: 0 }}>
          {form.id ? (
            <Card>
              <PanelHeader title={`CADET · ${(form.name || '').toUpperCase() || 'UNNAMED'}`} action={
                <Btn onClick={saveDetail} variant="gold" size="sm" disabled={saving}>
                  {saving ? 'SAVING…' : 'SAVE'}
                </Btn>
              } />

              <div style={{ marginBottom: sp[3] }}>
                <Label>NAME</Label>
                <Input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ marginBottom: sp[3] }}>
                <Label>ROLE / RANK</Label>
                <Input value={form.role || ''} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="cadet, staff, rank…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `0 ${sp[3]}px`, marginBottom: sp[3] }}>
                <div>
                  <Label>GRADE</Label>
                  <Select value={form.grade || ''} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} options={GRADE_OPTIONS} />
                </div>
                <div>
                  <Label>LET LEVEL</Label>
                  <Select value={form.let_level || ''} onChange={(e) => setForm((f) => ({ ...f, let_level: e.target.value }))} options={LET_OPTIONS} />
                </div>
              </div>

              {/* consent status */}
              <div style={{ marginBottom: sp[4] }}>
                <Label>PHOTO CONSENT</Label>
                <StatusPills items={STATUSES} value={form.consent_status} onChange={(id) => setStatus(form, id)} size="regular" style={{ width: '100%' }} />
              </div>

              <div style={{ marginBottom: sp[3] }}>
                <Label>SCHOOL EMAIL</Label>
                <SuffixEmailInput value={form.school_email || ''} onChange={(v) => setForm((f) => ({ ...f, school_email: v }))} />
              </div>
              <div style={{ marginBottom: sp[3] }}>
                <Label>PARENT EMAIL</Label>
                <Input value={form.parent_email || ''} onChange={(e) => setForm((f) => ({ ...f, parent_email: e.target.value }))} placeholder="feeds the mailing list" />
                <div style={{ display: 'flex', gap: sp[3], alignItems: 'center', marginTop: sp[2], flexWrap: 'wrap' }}>
                  <Btn onClick={addParentToList} variant="green" size="sm">+ ADD PARENT TO MAILING LIST</Btn>
                  <Toast tone={listErr ? 'error' : 'success'}>{listMsg}</Toast>
                </div>
              </div>

              <div style={{ marginBottom: sp[3] }}>
                <Label>TEAM(S)</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[2] }}>
                  {TEAMS.map((t) => {
                    const on = cadetTeams.includes(t.id);
                    return (
                      <Btn key={t.id} variant={on ? 'gold' : 'ghost'} size="sm" onClick={() => toggleCadetTeam(selectedId, t.id, on)}>
                        {t.label}
                      </Btn>
                    );
                  })}
                </div>
                {cadetTeams.includes('raiders') && (!form.school_email && !form.parent_email) && (
                  <div style={{
                    fontFamily: mono, fontSize: fs.micro, color: P.bright, marginTop: sp[2], lineHeight: 1.6,
                    background: 'rgba(232,199,122,0.08)', border: '1px solid rgba(232,199,122,0.25)',
                    borderRadius: radius.sm, padding: `${sp[2]}px ${sp[2]}px`,
                  }}>
                    ⚠ No email on file. OpticSend won't be able to reach this cadet yet.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: sp[3] }}>
                <Label>NOTE</Label>
                <Input value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} multiline />
              </div>

              <Toast tone={detailErr ? 'error' : 'success'}>{detailMsg}</Toast>
            </Card>
          ) : (
            <div style={{
              fontFamily: mono, fontSize: fs.tiny, color: P.mute, textAlign: 'center', lineHeight: 1.8,
              padding: `${sp[10]}px ${sp[4]}px`, border: `1px dashed ${P.hair}`, borderRadius: radius.md,
            }}>
              SELECT A CADET →<br />to edit contact info &amp; consent
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
