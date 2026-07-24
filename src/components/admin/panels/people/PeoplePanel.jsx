import { useState, useEffect, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
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
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('directory');

  // filters
  const [search, setSearch] = useState('');
  const [fSection, setFSection] = useState('');
  const [fLet, setFLet] = useState('');
  const [fConsent, setFConsent] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: people }, { data: consent }] = await Promise.all([
      SB.from('personnel').select('*').order('sort_order'),
      SB.from('cadet_consent').select('name, consent_status, collected_at, school_email, parent_email'),
    ]);
    setRecords(people || []);
    const map = {};
    for (const c of consent || []) map[normName(c.name)] = c;
    setConsentByName(map);
  }

  function consentFor(r) {
    return consentByName[normName(r?.name)] || null;
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

  const selConsent = editing ? consentFor(form) : null;
  const selMeta = CONSENT_META[selConsent?.consent_status || 'none'] || CONSENT_META.none;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{ display: 'flex', gap: sp[2] }}>
        <Btn variant={view === 'directory' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('directory')}>STAFF / COMMAND</Btn>
        <Btn variant={view === 'consent' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('consent')}>CADET DATABASE</Btn>
      </div>
      {view === 'consent' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><ConsentSection adminId={adminId} /></div>
      ) : (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: sp[4], flex: 1, minHeight: 0 }}>
      <div style={{ overflowY: 'auto' }}>
        <PanelHeader title="STAFF / COMMAND" sub={`${filtered.length} of ${records.length} shown`} />

        {/* filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], marginBottom: sp[3] }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / role / rank…" style={{ fontSize: 11 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select value={fSection} onChange={(e) => setFSection(e.target.value)} style={selectStyle}>
              <option value="">All sections</option>
              {sectionsPresent.map((s) => <option key={s} value={s}>{SECTION_LABEL[s] || s.toUpperCase()}</option>)}
            </select>
            <select value={fLet} onChange={(e) => setFLet(e.target.value)} style={selectStyle}>
              <option value="">All LET</option>
              {letLevels.map((l) => <option key={l} value={l}>LET {l}</option>)}
            </select>
            <select value={fConsent} onChange={(e) => setFConsent(e.target.value)} style={selectStyle}>
              <option value="">All consent</option>
              <option value="collected">Collected</option>
              <option value="pending">Pending</option>
              <option value="declined">Declined</option>
              <option value="none">No record</option>
            </select>
            {(search || fSection || fLet || fConsent) && (
              <Btn variant="ghost" size="sm" onClick={() => { setSearch(''); setFSection(''); setFLet(''); setFConsent(''); }} style={{ fontSize: 9 }}>CLEAR</Btn>
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
              <div style={{ fontFamily: mono, fontSize: fs.tiny, color: selMeta.color, letterSpacing: '0.12em' }}>{selMeta.label}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 4, lineHeight: 1.8 }}>
                {selConsent?.collected_at && <div>Signed {new Date(selConsent.collected_at).toLocaleDateString()}</div>}
                <div>Email: <span style={{ color: P.cream }}>{form.email || '—'}</span></div>
                {selConsent?.school_email && <div>School: <span style={{ color: P.cream }}>{selConsent.school_email}</span></div>}
                {selConsent?.parent_email && <div>Parent: <span style={{ color: P.cream }}>{selConsent.parent_email}</span></div>}
                {!selConsent && <div style={{ color: P.faint }}>No matching cadet_consent row (matched by name).</div>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {f('name', 'NAME')} {f('rank', 'RANK')}
              {f('role_short', 'ROLE SHORT')} {f('role_long', 'ROLE LONG')}
              {f('section', 'SECTION')} {f('let_level', 'LET LEVEL')}
              {f('graduating', 'GRADUATING')} {f('sort_order', 'SORT ORDER')}
            </div>
            {f('email', 'EMAIL')}
            {f('bio', 'SHORT BIO', { multiline: true })}
            {f('bio_long', 'FULL BIO', { multiline: true })}
            {f('photo_url', 'PHOTO URL')}
            {form.photo_url && <img src={form.photo_url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6, marginBottom: sp[2] }} />}
            <div style={{ fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.08em' }}>Edits save straight to the personnel table the public site reads — changes go live on save.</div>
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

const selectStyle = {
  background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: mono, fontSize: 10, padding: '7px 9px', outline: 'none', cursor: 'pointer',
};
