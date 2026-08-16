import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius, shadow, ease } from '../../theme';
import { Btn, Card, Label, Input, Select, PanelHeader } from '../../shared/ui';
import ConsentSection from './ConsentSection';
import PersonAchievements from './PersonAchievements';

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

// Normalize a name for cross-table matching (personnel ↔ cadet_consent).
function normName(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
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
  const [autosaveStatus, setAutosaveStatus] = useState(null); // null | 'pending' | 'saved'
  const [view, setView] = useState('directory');

  // filters
  const [search, setSearch] = useState('');
  const [fSection, setFSection] = useState('');
  const [fLet, setFLet] = useState('');
  const [fConsent, setFConsent] = useState('');

  // Autosave: refs mirror the latest form/editing state so the debounce
  // timer (and unmount/switch-record flushes) always persist the newest
  // edits, not a stale value captured when the timer was scheduled.
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const editingRef = useRef(editing);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef(null);
  const AUTOSAVE_DELAY_MS = 1500;

  useEffect(() => { load(); }, []);

  // Flush any pending autosave on unmount (leaving the panel / logging out)
  // so a forgotten Save button never loses an in-progress edit.
  useEffect(() => () => { flushAutosave(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(record) {
    await SB.from('personnel').upsert({ ...record, updated_at: new Date().toISOString() });
    await SB.from('change_log').insert({ admin_id: adminId, page: 'personnel', element: record.id, label: record.name, value_before: {}, value_after: record });
  }

  async function flushAutosave() {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    if (!dirtyRef.current || !editingRef.current) return;
    dirtyRef.current = false;
    setAutosaveStatus('pending');
    await persist(formRef.current);
    setAutosaveStatus('saved');
    load();
  }

  function scheduleAutosave() {
    dirtyRef.current = true;
    setAutosaveStatus(null);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(flushAutosave, AUTOSAVE_DELAY_MS);
  }

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
    // Switching records mid-edit shouldn't drop whatever was already typed.
    if (editingRef.current && editingRef.current !== r.id) flushAutosave();
    setEditing(r.id);
    setForm({ ...r });
    dirtyRef.current = false;
    setAutosaveStatus(null);
  }

  async function save() {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    dirtyRef.current = false;
    setSaving(true);
    await persist(form);
    setEditing(null);
    setSaving(false);
    setAutosaveStatus(null);
    load();
  }

  // Text-input field helper (visibility toggle intentionally removed — every
  // staff/command record stays public; no add/delete here to protect the data).
  // Every edit also schedules a debounced autosave so a forgotten SAVE click
  // never loses what was typed.
  const f = (k, l, opts = {}) => (
    <div style={{ marginBottom: 8 }}>
      <Label>{l}</Label>
      <Input value={form[k] || ''} onChange={(e) => { setForm((f) => ({ ...f, [k]: e.target.value })); scheduleAutosave(); }} multiline={opts.multiline} />
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
            <button key={v.id} onClick={() => { flushAutosave(); setView(v.id); }} style={{
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
                    {r.section !== 'leadership' && (
                      <span title={cm.label} style={{ width: 8, height: 8, borderRadius: '50%', background: cm.color, flexShrink: 0 }} />
                    )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
                {autosaveStatus && (
                  <span style={{ fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.1em', color: autosaveStatus === 'saved' ? P.green : P.mute }}>
                    {autosaveStatus === 'saved' ? 'AUTOSAVED' : 'AUTOSAVING…'}
                  </span>
                )}
                <div style={{ display: 'flex', gap: sp[2] }}>
                  <Btn onClick={() => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); setEditing(null); setAutosaveStatus(null); }} variant="ghost" size="sm">CANCEL</Btn>
                  <Btn onClick={save} variant="gold" size="sm" disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</Btn>
                </div>
              </div>
            }/>

            {/* form status + school/parent email are edited in Cadet Database
                → STAFF tab now, same as any other cadet — this tab is bios only. */}
            {form.section !== 'leadership' && (
            <div style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '10px 12px', marginBottom: sp[3], display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[2], flexWrap: 'wrap' }}>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, lineHeight: 1.6 }}>Consent status + school/parent email now live in Cadet Database → STAFF tab.</div>
              <Btn onClick={() => setView('consent')} variant="ghost" size="sm">GO TO CADET DATABASE →</Btn>
            </div>
            )}

            <div style={{ marginBottom: sp[4] }}>
              <PersonAchievements personnelId={form.id} achievements={achievements} />
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
            <div style={{ fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.08em' }}>Edits save straight to the personnel table the public site reads. Changes go live on save, and also autosave a few seconds after you stop typing — a forgotten SAVE click won't lose them.</div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: sp[3], color: P.faint }}>
            <div style={{ fontFamily: mono, fontSize: fs.xxl, color: P.hairStrong }}>☰</div>
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, letterSpacing: '0.14em' }}>SELECT A RECORD TO VIEW / EDIT</div>
            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint }}>bio & directory info show here</div>
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
