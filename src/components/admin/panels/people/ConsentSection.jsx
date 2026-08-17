import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald, inter, fs, sp, radius, shadow, ease } from '../../theme';
import { Btn, Card, Label, Input, Select, SuffixEmailInput, EmailAutocompleteInput, StatusPills, Toast, Modal, PanelHeader, EmptyState } from '../../shared/ui';
import { TEAMS } from '../../../../lib/teams';
import { openConsentStatusPdf } from '../../../../lib/consentPdfPrint';

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

// Every form tracked per cadet/staff row, each with its own
// {status,collected_at,collected_by} triplet on `cadet_consent`
// (see supabase/cadet_consent.sql + cadet_consent_dd_forms.sql).
const FORMS = [
  { key: 'consent',   statusCol: 'consent_status',   atCol: 'collected_at',           byCol: 'collected_by',           label: 'DISPATCH SEND PARENT CONSENT' },
  { key: 'dd3203',    statusCol: 'dd3203_status',    atCol: 'dd3203_collected_at',    byCol: 'dd3203_collected_by',    label: 'DD FORM 3203 (JAN 2024)', due: 'DUE AUG 31' },
  { key: 'datasheet', statusCol: 'datasheet_status', atCol: 'datasheet_collected_at', byCol: 'datasheet_collected_by', label: 'JROTC CADET PERSONAL DATASHEET', due: 'DUE AUG 31' },
];

// One-letter chip label per FORMS entry, for the roster row's at-a-glance indicator.
const FORM_INITIAL = { consent: 'C', dd3203: 'D', datasheet: 'S' };

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

const BLANK_ADD_FORM = { name: '', let_level: '' };

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

  // cross-company search — separate from the company-scoped `rows`/tabs above.
  // Reuses loadCounts' fetch (already pulls every cadet) instead of a second query.
  const [search, setSearch] = useState('');
  const [allRows, setAllRows] = useState([]);

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
    const { data } = await SB.from('cadet_consent').select('*').order('name');
    setAllRows(data || []);
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

  function closeCadet() {
    setSelectedId(null);
    setForm({});
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

  async function setStatus(row, status, formKey = 'consent') {
    const f = FORMS.find((x) => x.key === formKey);
    const patch = {
      [f.statusCol]: status,
      [f.atCol]: status === 'collected' ? new Date().toISOString() : null,
      [f.byCol]: status === 'collected' ? adminId : null,
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
      birthdate: form.birthdate || null,
      school_email: (form.school_email || '').trim() || null,
      parent_email: (form.parent_email || '').trim() || null,
      parent_email2: (form.parent_email2 || '').trim() || null,
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

  // Promote a parent email into email_subscribers. Explicit action, deduped
  // by email — no DB trigger. `field` picks parent_email or parent_email2.
  async function addParentToList(field = 'parent_email') {
    const email = (form[field] || '').trim().toLowerCase();
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

    // Pre-check for an existing cadet with this exact name in this company —
    // catches accidental double-entry during bulk roster typing with a clear
    // message, instead of letting it hit the DB unique constraint (name,
    // company) and surface a raw Postgres error.
    const { data: existing } = await SB.from('cadet_consent')
      .select('id')
      .eq('company', addCompany)
      .ilike('name', name)
      .maybeSingle();
    if (existing) {
      setAdding(false);
      setAddErr(true);
      setAddMsg(`${name} is already in ${addCompany.toUpperCase()} — search instead of re-adding.`);
      return;
    }

    const maxOrder = Math.max(0, ...rows.map((r) => r.sort_order || 0));
    const payload = {
      name,
      company: addCompany,
      let_level: addForm.let_level || null,
      sort_order: maxOrder + 1,
    };
    const { error } = await SB.from('cadet_consent').insert(payload);
    setAdding(false);
    setAddErr(!!error);
    // 23505 = unique_violation — the pre-check above should already catch this,
    // but a race (two admins adding the same cadet at once) can still hit the
    // DB constraint directly, so give it the same friendly message as a backstop.
    setAddMsg(error
      ? (error.code === '23505' ? `${name} is already in ${addCompany.toUpperCase()}.` : error.message)
      : `Added ${name} to ${addCompany.toUpperCase()}`);
    if (error) return; // leave the popup open + message visible so they can fix and retry
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

  const formProgress = FORMS.map((f) => {
    const collected = rows.filter((r) => r[f.statusCol] === 'collected').length;
    return { ...f, collected, pct: rows.length ? Math.round((collected / rows.length) * 100) : 0 };
  });

  const searchTerm = search.trim().toLowerCase();
  const searchResults = searchTerm
    ? allRows.filter((r) => (r.name || '').toLowerCase().includes(searchTerm))
    : null;

  if (missing) {
    return (
      <div>
        <PanelHeader title="CADET DATABASE · BY COMPANY" />
        <Card>
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, lineHeight: 1.9 }}>
            <div style={{ color: P.gold }}>CADET TABLE NOT FOUND</div>
            <div>Run <span style={{ color: P.cream }}>supabase/cadet_consent.sql</span>, <span style={{ color: P.cream }}>supabase/cadet_consent_contact.sql</span>, then <span style={{ color: P.cream }}>supabase/cadet_consent_dd_forms.sql</span> in the Supabase SQL editor.</div>
            <div>Then import the roster (sectioned by company) and it appears here.</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PanelHeader title="CADET DATABASE" />

      {/* cross-company name search — searches every company at once, bypassing
          the tabs below. Clearing it returns to the tab-scoped view. */}
      <div style={{ marginBottom: sp[3] }}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all cadets by name…"
        />
      </div>

      {/* company tabs — subordinate to the Staff/Command ↔ Cadet Database
          switch one level up (PeoplePanel), so this reads as "filter within
          this view" rather than another top-level nav. Dimmed while a search
          is active since they don't apply to search results. */}
      <div style={{ display: 'flex', gap: sp[5], borderBottom: `1px solid ${P.hair}`, marginBottom: sp[4], flexWrap: 'wrap', opacity: searchResults ? 0.4 : 1, pointerEvents: searchResults ? 'none' : 'auto' }}>
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

      {/* progress — one bar per tracked form, all scoped to the active company tab */}
      <Card style={{ marginBottom: sp[4] }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: sp[3] }}>
          <Btn
            onClick={() => openConsentStatusPdf(rows, FORMS, COMPANIES.find((c) => c.id === company)?.label || company.toUpperCase())}
            variant="ghost"
            size="sm"
          >
            PRINT FORM STATUS
          </Btn>
        </div>
        {formProgress.map((f, i) => (
          <div key={f.key} style={{ marginBottom: i < formProgress.length - 1 ? sp[3] : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: sp[2] }}>
              <Label style={{ marginBottom: 0 }}>{f.label} COLLECTED{f.due ? ` · ${f.due}` : ''}</Label>
              <div style={{ fontFamily: oswald, fontSize: fs.lg, color: P.cream }}>
                {f.collected} / {rows.length} <span style={{ fontSize: fs.sm, color: P.gold }}>· {f.pct}%</span>
              </div>
            </div>
            <div style={{ height: 7, background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${f.pct}%`, background: `linear-gradient(90deg, ${P.gold}, ${P.bright})`, transition: `width 0.3s ${ease}` }} />
            </div>
          </div>
        ))}
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

        <div style={{ marginBottom: sp[1] }}>
          <Label>LET LEVEL</Label>
          <Select value={addForm.let_level} onChange={(e) => setAddForm((f) => ({ ...f, let_level: e.target.value }))} options={LET_OPTIONS} />
        </div>

        {/* Everything else (grade, emails, birthdate, teams, note) is filled in
            from the cadet detail view after adding — keeping this modal to the
            3 fields needed to get a row on the roster fast during bulk entry. */}

        {/* lives inside the modal (not just the page-level toast below) so an
            insert error is actually visible — the modal overlay would hide the
            outer toast completely while open. */}
        <Toast tone={addErr ? 'error' : 'success'} style={{ marginTop: sp[2] }}>{addMsg}</Toast>
      </Modal>

      {/* roster — full width; click a cadet to open the detail popup below */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1] }}>
          {(searchResults ?? rows).map((r) => {
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
                  <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                    {searchResults && (
                      <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, marginLeft: sp[2], letterSpacing: '0.1em' }}>
                        {(r.company || '').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, marginTop: 2 }}>
                    {r.grade ? `${r.grade}TH` : ''}{r.grade && r.let_level ? ' · ' : ''}{r.let_level ? `LET ${r.let_level}` : ''}{(r.grade || r.let_level) ? ' · ' : ''}
                    {r.parent_email || r.parent_email2 ? '✉ parent on file' : 'no parent email'}
                    {r.consent_status === 'collected' && r.collected_at ? ` · signed ${new Date(r.collected_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                {/* per-form status at a glance — one chip per tracked form (FORMS),
                    read-only here so it can never be mistaken for a single overall
                    toggle; open the cadet to actually change a status. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {FORMS.map((f) => {
                      const st = r[f.statusCol] || 'pending';
                      const meta = STATUSES.find((s) => s.id === st) || STATUSES[1];
                      const filled = st !== 'pending';
                      return (
                        <span key={f.key} title={`${f.label}: ${st.toUpperCase()}`} style={{
                          width: 20, height: 20, borderRadius: radius.sm,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: mono, fontSize: 9, fontWeight: 700,
                          background: filled ? meta.color : 'transparent',
                          border: `1px solid ${filled ? meta.color : P.hair}`,
                          color: filled ? (st === 'declined' ? '#fff' : P.ink) : P.faint,
                        }}>{FORM_INITIAL[f.key]}</span>
                      );
                    })}
                  </div>
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
          {searchResults && !searchResults.length && (
            <EmptyState title="NO MATCHES" hint={`No cadet name contains "${search.trim()}".`} />
          )}
          {!searchResults && !rows.length && (
            <EmptyState title={`NO CADETS FOR ${company.toUpperCase()} YET`} hint="Add one above, or import the roster." />
          )}
        </div>
      </div>

      {/* detail — full-record popup, opened by clicking a cadet in the roster */}
      <Modal open={!!form.id} onClose={closeCadet} title={`CADET · ${(form.name || '').toUpperCase() || 'UNNAMED'}`} width={820} footer={<>
        <Btn onClick={closeCadet} variant="ghost" size="sm">CLOSE</Btn>
        <Btn onClick={saveDetail} variant="gold" size="sm" disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</Btn>
      </>}>
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

        {/* PII — only reachable by a signed-in s6 admin (cadet_consent is
            authenticated-only, see admin_roles.sql); only used server-side
            to derive the /tv birthday shoutout, never read by the kiosk
            itself (see supabase/tv_shoutouts.sql). */}
        <div style={{ marginBottom: sp[3] }}>
          <Label>BIRTHDATE</Label>
          <Input type="date" value={form.birthdate || ''} onChange={(e) => setForm((f) => ({ ...f, birthdate: e.target.value }))} />
        </div>

        {/* consent status + the two required-back-by-8/31 forms — all
            three are independent {status,collected_at,collected_by}
            triplets on this same row (FORMS above). */}
        <div style={{ marginBottom: sp[4] }}>
          <Label>DISPATCH SEND PARENT CONSENT</Label>
          <StatusPills items={STATUSES} value={form.consent_status} onChange={(id) => setStatus(form, id)} size="regular" style={{ width: '100%' }} />

          {/* only relevant once consent is actually collected — nested here
              instead of a standalone block so it can't be filled in ahead of
              (or independent of) the consent status itself. */}
          {form.consent_status === 'collected' && (
            <div style={{ marginTop: sp[3], paddingTop: sp[3], borderTop: `1px solid ${P.hair}` }}>
              <div style={{ marginBottom: sp[3] }}>
                <Label>PARENT EMAIL</Label>
                <EmailAutocompleteInput value={form.parent_email || ''} onChange={(v) => setForm((f) => ({ ...f, parent_email: v }))} placeholder="feeds the mailing list" />
                <div style={{ display: 'flex', gap: sp[3], alignItems: 'center', marginTop: sp[2], flexWrap: 'wrap' }}>
                  <Btn onClick={() => addParentToList('parent_email')} variant="green" size="sm">+ ADD PARENT TO MAILING LIST</Btn>
                </div>
              </div>
              <div>
                <Label>PARENT EMAIL 2</Label>
                <EmailAutocompleteInput value={form.parent_email2 || ''} onChange={(v) => setForm((f) => ({ ...f, parent_email2: v }))} placeholder="second parent/guardian, optional" />
                <div style={{ display: 'flex', gap: sp[3], alignItems: 'center', marginTop: sp[2], flexWrap: 'wrap' }}>
                  <Btn onClick={() => addParentToList('parent_email2')} variant="green" size="sm">+ ADD PARENT 2 TO MAILING LIST</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ marginBottom: sp[4] }}>
          <Label>DD FORM 3203 (JAN 2024) · DUE AUG 31</Label>
          <StatusPills items={STATUSES} value={form.dd3203_status} onChange={(id) => setStatus(form, id, 'dd3203')} size="regular" style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: sp[4] }}>
          <Label>JROTC CADET PERSONAL DATASHEET · DUE AUG 31</Label>
          <StatusPills items={STATUSES} value={form.datasheet_status} onChange={(id) => setStatus(form, id, 'datasheet')} size="regular" style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: sp[3] }}>
          <Label>SCHOOL EMAIL</Label>
          <SuffixEmailInput value={form.school_email || ''} onChange={(v) => setForm((f) => ({ ...f, school_email: v }))} />
        </div>

        <div style={{ marginBottom: sp[3], minHeight: fs.tiny }}>
          <Toast tone={listErr ? 'error' : 'success'}>{listMsg}</Toast>
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

        <div style={{ marginBottom: sp[1] }}>
          <Label>NOTE</Label>
          <Input value={form.note || ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} multiline />
        </div>

        <Toast tone={detailErr ? 'error' : 'success'}>{detailMsg}</Toast>
      </Modal>
    </div>
  );
}
