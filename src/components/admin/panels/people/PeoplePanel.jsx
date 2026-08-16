import { useState, useEffect, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius, shadow, ease } from '../../theme';
import { Btn, Card, Label, Input, Select, SuffixEmailInput, StatusPills, Toast, PanelHeader } from '../../shared/ui';
import { TEAMS } from '../../../../lib/teams';
import ConsentSection from './ConsentSection';
import PersonAchievements from './PersonAchievements';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const CONSENT_META = {
  collected: { label: 'CONSENT COLLECTED', color: P.green },
  pending:   { label: 'CONSENT PENDING',   color: P.bright },
  declined:  { label: 'CONSENT DECLINED',  color: P.red },
  none:      { label: 'NO CONSENT RECORD', color: P.mute },
};

// Same 3 states as the banner's status line, shaped for the shared StatusPills.
const BANNER_STATUSES = [
  { id: 'collected', label: 'COLLECTED', color: CONSENT_META.collected.color },
  { id: 'pending',   label: 'PENDING',   color: CONSENT_META.pending.color },
  { id: 'declined',  label: 'DECLINED',  color: CONSENT_META.declined.color },
];

// Normalize a name for cross-table matching (personnel ↔ cadet_consent).
function normName(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Personnel section → the cadet_consent company bucket their contact/consent
// record should live in. Company commanders (section = company-alpha etc)
// get filed under their real company so they show up in that company's
// Cadet Database tab too, not just lumped into the generic 'staff' bucket
// with battalion HQ (command/staff/s-1..s-6).
function companyForSection(section) {
  const m = /^company-(alpha|bravo|charlie|delta)$/.exec(section || '');
  return m ? m[1] : 'staff';
}

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
  const [consentByName, setConsentByName] = useState({});
  const [achievements, setAchievements] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('directory');

  // contact record (cadet_consent row, company = companyForSection(section)) for the person being edited
  const [cForm, setCForm] = useState({});
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [contactErr, setContactErr] = useState(false);
  const [listMsg, setListMsg] = useState('');
  const [listErr, setListErr] = useState(false);

  // directory-only team tag (personnel_teams) — cosmetic, does not feed
  // OpticSend (that reads cadet_teams on cadet_consent instead; see
  // supabase/opticsend.sql SECTION 2 vs 3).
  const [personTeams, setPersonTeams] = useState([]);

  // filters
  const [search, setSearch] = useState('');
  const [fSection, setFSection] = useState('');
  const [fLet, setFLet] = useState('');
  const [fConsent, setFConsent] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: people }, { data: consent }, { data: ach }] = await Promise.all([
      SB.from('personnel').select('*').order('sort_order'),
      SB.from('cadet_consent').select('id, name, company, consent_status, collected_at, school_email, parent_email, parent_email2'),
      SB.from('achievements').select('*').order('sort_order').order('name'),
    ]);
    setRecords(people || []);
    const map = {};
    for (const c of consent || []) map[normName(c.name)] = c;
    setConsentByName(map);
    setAchievements(ach || []);
  }

  function consentFor(r) {
    return consentByName[normName(r?.name)] || null;
  }

  function startEdit(r) {
    setEditing(r.id);
    setForm({ ...r });
    const c = consentFor(r);
    setCForm(c ? { ...c } : { name: r.name, company: companyForSection(r.section), school_email: '', parent_email: '', parent_email2: '' });
    setContactMsg(''); setContactErr(false); setListMsg('');
    loadPersonTeams(r.id);
  }

  async function loadPersonTeams(personnelId) {
    const { data } = await SB.from('personnel_teams').select('team').eq('personnel_id', personnelId);
    setPersonTeams((data || []).map((r) => r.team));
  }

  async function togglePersonTeam(personnelId, team, on) {
    if (on) {
      await SB.from('personnel_teams').delete().eq('personnel_id', personnelId).eq('team', team);
    } else {
      await SB.from('personnel_teams').insert({ personnel_id: personnelId, team });
    }
    loadPersonTeams(personnelId);
  }

  async function save() {
    setSaving(true);
    await SB.from('personnel').upsert({ ...form, updated_at: new Date().toISOString() });
    await SB.from('change_log').insert({ admin_id: adminId, page: 'personnel', element: form.id, label: form.name, value_before: {}, value_after: form });
    setEditing(null);
    setSaving(false);
    load();
  }

  // Mark the consent form collected/pending/declined straight from the banner.
  // Creates the cadet_consent row (filed under the person's real company —
  // see companyForSection) if this person has none yet.
  async function setConsentStatus(status) {
    const patch = {
      consent_status: status,
      collected_at: status === 'collected' ? new Date().toISOString() : null,
      collected_by: status === 'collected' ? adminId : null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (cForm.id) {
      ({ error } = await SB.from('cadet_consent').update(patch).eq('id', cForm.id));
    } else {
      const insertPatch = { name: form.name || cForm.name, company: companyForSection(form.section), school_email: cForm.school_email || null, parent_email: cForm.parent_email || null, parent_email2: cForm.parent_email2 || null, ...patch };
      const { data, error: insertError } = await SB.from('cadet_consent').insert(insertPatch).select().single();
      error = insertError;
      if (data) setCForm((f) => ({ ...f, id: data.id }));
    }
    setContactErr(!!error);
    setContactMsg(error ? error.message : '');
    if (error) { setTimeout(() => setContactMsg(''), 4000); return; }
    setCForm((f) => ({ ...f, ...patch }));
    load();
  }

  // Staff/command contact info lives in cadet_consent (company = the person's
  // real company via companyForSection, 'staff' for true HQ), same mechanism
  // as the cadet database — matched by name, not a duplicate column on
  // personnel. Creates the row on first save if this person has none yet.
  // `patch` is reused for both insert and update, so company gets recomputed
  // every save — an already-correct row never gets silently reset to 'staff'.
  async function saveContact() {
    setSavingContact(true);
    const patch = {
      name: form.name || cForm.name,
      company: companyForSection(form.section),
      school_email: (cForm.school_email || '').trim() || null,
      parent_email: (cForm.parent_email || '').trim() || null,
      parent_email2: (cForm.parent_email2 || '').trim() || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (cForm.id) {
      ({ error } = await SB.from('cadet_consent').update(patch).eq('id', cForm.id));
    } else {
      const { data, error: insertError } = await SB.from('cadet_consent').insert(patch).select().single();
      error = insertError;
      if (data) setCForm((f) => ({ ...f, id: data.id }));
    }
    setSavingContact(false);
    setContactErr(!!error);
    setContactMsg(error ? error.message : 'Saved');
    setTimeout(() => setContactMsg(''), error ? 4000 : 2500);
    load();
  }

  // Promote a parent email into email_subscribers. Explicit action, deduped
  // by email — mirrors ConsentSection's cadet-side "add to mailing list".
  // `field` picks parent_email or parent_email2.
  async function addParentToList(field = 'parent_email') {
    const email = (cForm[field] || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setListErr(true); setListMsg('Enter a valid parent email first'); return; }
    const { data: existing } = await SB.from('email_subscribers').select('id').eq('email', email).maybeSingle();
    if (existing) { setListErr(true); setListMsg('Already on the mailing list'); return; }
    const { error } = await SB.from('email_subscribers').insert({ email, source: 'manual', company: companyForSection(form.section) });
    setListErr(!!error);
    setListMsg(error ? (error.code === '23505' ? 'Already on the mailing list' : error.message) : 'Added to mailing list');
    setTimeout(() => setListMsg(''), 3000);
  }

  // Text-input field helper (visibility toggle intentionally removed — every
  // staff/command record stays public; no add/delete here to protect the data).
  const f = (k, l, opts = {}) => (
    <div style={{ marginBottom: 8 }}>
      <Label>{l}</Label>
      <Input value={form[k] || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} multiline={opts.multiline} />
    </div>
  );

  // Apply filters (search / section / LET / consent) before grouping.
  const filtered = useMemo(() => {
    const q = normName(search);
    return records.filter((r) => {
      if (fSection && (r.section || 'other') !== fSection) return false;
      if (fLet && String(r.let_level) !== fLet) return false;
      if (fConsent) {
        const status = consentFor(r)?.consent_status || 'none';
        if (status !== fConsent) return false;
      }
      if (q) {
        const hay = normName(`${r.name} ${r.role_short} ${r.role_long} ${r.rank}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, consentByName, search, fSection, fLet, fConsent]);

  const groups = groupBySection(filtered);
  const sectionsPresent = SECTION_ORDER.filter((s) => records.some((r) => (r.section || 'other') === s));
  const letLevels = [...new Set(records.map((r) => String(r.let_level)).filter((v) => v && v !== 'undefined'))].sort();

  const selMeta = CONSENT_META[cForm.consent_status || 'none'] || CONSENT_META.none;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* primary view switch — heavier weight (filled pill) than the company
          tabs one level down inside Cadet Database, so the two nav levels
          read as distinct rather than identical Btn rows. */}
      <div style={{ display: 'inline-flex', gap: 2, padding: 4, background: P.navy, border: `1px solid ${P.hair}`, borderRadius: radius.md, alignSelf: 'flex-start' }}>
        {[
          { id: 'directory', label: 'STAFF / COMMAND' },
          { id: 'consent',   label: 'CADET DATABASE' },
        ].map((v) => {
          const active = view === v.id;
          return (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.12em', fontWeight: 600,
              padding: '10px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: active ? P.gold : 'transparent', color: active ? P.ink : P.mute,
              boxShadow: active ? shadow.sm : 'none', transition: `all 0.15s ${ease}`,
            }}>{v.label}</button>
          );
        })}
      </div>
      {view === 'consent' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><ConsentSection adminId={adminId} /></div>
      ) : (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: sp[4], flex: 1, minHeight: 0 }}>
      <div style={{ overflowY: 'auto' }}>
        <PanelHeader title="STAFF / COMMAND" sub={`${filtered.length} of ${records.length} shown`} />

        {/* filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], marginBottom: sp[3] }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / role / rank…" />
          <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
            <Select value={fSection} onChange={(e) => setFSection(e.target.value)} style={{ width: 150 }}
              options={[{ value: '', label: 'All sections' }, ...sectionsPresent.map((s) => ({ value: s, label: SECTION_LABEL[s] || s.toUpperCase() }))]} />
            <Select value={fLet} onChange={(e) => setFLet(e.target.value)} style={{ width: 110 }}
              options={[{ value: '', label: 'All LET' }, ...letLevels.map((l) => ({ value: l, label: `LET ${l}` }))]} />
            <Select value={fConsent} onChange={(e) => setFConsent(e.target.value)} style={{ width: 140 }}
              options={[
                { value: '', label: 'All consent' },
                { value: 'collected', label: 'Collected' },
                { value: 'pending', label: 'Pending' },
                { value: 'declined', label: 'Declined' },
                { value: 'none', label: 'No record' },
              ]} />
            {(search || fSection || fLet || fConsent) && (
              <Btn variant="ghost" size="sm" onClick={() => { setSearch(''); setFSection(''); setFLet(''); setFConsent(''); }}>CLEAR</Btn>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[4] }}>
          {groups.map(([section, items]) => (
            <div key={section}>
              <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, letterSpacing: '0.18em', marginBottom: sp[2], display: 'flex', justifyContent: 'space-between', paddingBottom: 5, borderBottom: `1px solid ${P.hair}` }}>
                <span>{SECTION_LABEL[section] || section.toUpperCase()}</span>
                <span style={{ color: P.mute }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1] }}>
                {items.map((r) => {
                  const c = consentFor(r);
                  const cm = CONSENT_META[c?.consent_status || 'none'] || CONSENT_META.none;
                  return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: sp[3],
                    background: editing === r.id ? P.navy : P.deep,
                    border: `1px solid ${editing === r.id ? P.gold : P.hair}`,
                    borderRadius: 6, padding: '9px 11px', cursor: 'pointer',
                  }} onClick={() => startEdit(r)}>
                    {r.photo_url
                      ? <img src={r.photo_url} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 5 }} alt="" />
                      : <div style={{ width: 36, height: 36, borderRadius: 5, background: P.navy, border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: fs.sm, color: P.faint }}>{(r.name || '?').charAt(0)}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 2 }}>{r.role_short}</div>
                    </div>
                    <span title={cm.label} style={{ width: 8, height: 8, borderRadius: '50%', background: cm.color, flexShrink: 0 }} />
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!filtered.length && (
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', padding: 24 }}>NO MATCHING RECORDS</div>
          )}
        </div>
      </div>
      <div style={{ overflowY: 'auto' }}>
        {editing ? (
          <Card>
            <PanelHeader title={`EDITING · ${form.name || 'RECORD'}`} action={
              <div style={{ display: 'flex', gap: sp[2] }}>
                <Btn onClick={() => setEditing(null)} variant="ghost" size="sm">CANCEL</Btn>
                <Btn onClick={save} variant="gold" size="sm" disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</Btn>
              </div>
            }/>

            {/* admin-relevant summary: consent status + emails, always visible */}
            <div style={{ background: P.deep, border: `1px solid ${P.hair}`, borderLeft: `3px solid ${selMeta.color}`, padding: '10px 12px', marginBottom: sp[3] }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[2], flexWrap: 'wrap' }}>
                <div style={{ fontFamily: mono, fontSize: fs.tiny, color: selMeta.color, letterSpacing: '0.12em' }}>{selMeta.label}</div>
                <StatusPills items={BANNER_STATUSES} value={cForm.consent_status} onChange={setConsentStatus} size="compact" />
              </div>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginTop: sp[2], lineHeight: 1.8 }}>
                {cForm.collected_at && <div>Signed {new Date(cForm.collected_at).toLocaleDateString()}</div>}
                {cForm.school_email && <div>School: <span style={{ color: P.cream }}>{cForm.school_email}</span></div>}
                {cForm.parent_email && <div>Parent: <span style={{ color: P.cream }}>{cForm.parent_email}</span></div>}
                {cForm.parent_email2 && <div>Parent 2: <span style={{ color: P.cream }}>{cForm.parent_email2}</span></div>}
                {!cForm.id && <div style={{ color: P.faint }}>No matching cadet_consent row yet. Marking a status here creates one.</div>}
              </div>
            </div>

            <div style={{ marginBottom: sp[4] }}>
              <PanelHeader title="STAFF CONTACT" sub={`cadet_consent · company = ${companyForSection(form.section)}`} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 8 }}>
                <div>
                  <Label>SCHOOL EMAIL</Label>
                  <SuffixEmailInput value={cForm.school_email || ''} onChange={(v) => setCForm((f) => ({ ...f, school_email: v }))} />
                </div>
                <div>
                  <Label>PARENT EMAIL</Label>
                  <Input value={cForm.parent_email || ''} onChange={(e) => setCForm((f) => ({ ...f, parent_email: e.target.value }))} placeholder="feeds the mailing list" />
                </div>
                <div>
                  <Label>PARENT EMAIL 2</Label>
                  <Input value={cForm.parent_email2 || ''} onChange={(e) => setCForm((f) => ({ ...f, parent_email2: e.target.value }))} placeholder="second parent/guardian, optional" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn onClick={saveContact} variant="ghost" size="sm" disabled={savingContact}>{savingContact ? 'SAVING…' : 'SAVE CONTACT INFO'}</Btn>
                <Btn onClick={() => addParentToList('parent_email')} variant="green" size="sm">+ ADD PARENT TO MAILING LIST</Btn>
                <Btn onClick={() => addParentToList('parent_email2')} variant="green" size="sm">+ ADD PARENT 2 TO MAILING LIST</Btn>
                {contactMsg && <Toast tone={contactErr ? 'error' : 'success'}>{contactMsg}</Toast>}
                {listMsg && <Toast tone={listErr ? 'error' : 'success'}>{listMsg}</Toast>}
              </div>
            </div>

            <div style={{ marginBottom: sp[4] }}>
              <PersonAchievements personnelId={form.id} achievements={achievements} />
            </div>

            <div style={{ marginBottom: sp[4] }}>
              <Label>TEAM(S), directory tag only</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[2] }}>
                {TEAMS.map((t) => {
                  const on = personTeams.includes(t.id);
                  return (
                    <Btn key={t.id} variant={on ? 'gold' : 'ghost'} size="sm" onClick={() => togglePersonTeam(form.id, t.id, on)}>
                      {t.label}
                    </Btn>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {f('name', 'NAME')} {f('rank', 'RANK')}
              {f('role_short', 'ROLE SHORT')} {f('role_long', 'ROLE LONG')}
              {f('section', 'SECTION')} {f('let_level', 'LET LEVEL')}
              {f('graduating', 'GRADUATING')}
            </div>
            {f('bio', 'SHORT BIO', { multiline: true })}
            {f('bio_long', 'FULL BIO', { multiline: true })}
            {f('photo_url', 'PHOTO URL')}
            {form.photo_url && <img src={form.photo_url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6, marginBottom: sp[2] }} />}
            <div style={{ fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.08em' }}>Edits save straight to the personnel table the public site reads. Changes go live on save.</div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: sp[3], color: P.faint }}>
            <div style={{ fontFamily: mono, fontSize: fs.xxl, color: P.hairStrong }}>☰</div>
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, letterSpacing: '0.14em' }}>SELECT A RECORD TO VIEW / EDIT</div>
            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint }}>consent status, email & bio show here</div>
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
