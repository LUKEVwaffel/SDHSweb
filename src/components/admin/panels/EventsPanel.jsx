import { useState, useEffect, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, Card, Label, Input, Select, Modal, PanelHeader, EmptyState } from '../shared/ui';
import { EVENT_CATEGORIES, EVENT_TEAMS, UNIFORM_TYPES, DEFAULT_POC, WEEKDAY_SHORT, categoryColor, teamLabel, MONTHS, MON3, toCalendarItem, groupByMonth } from '../../../lib/calendar';
import { openEventsCalendarPdf } from '../../../lib/eventsPdfPrint';

// S-6 manages the whole calendar here: the main battalion calendar (team NULL)
// and all 4 specialty-team calendars, one row per event in `events`. Mirrors the
// public calendar (Bulletin) structure — month-grouped, category color pills —
// but this is backend-only: NO photos are shown here. `will_have_pictures` just
// flags an event that a gallery will attach to later.
const CATEGORY_OPTIONS = EVENT_CATEGORIES.filter((c) => c.id !== 'EVENT');
const PERMISSION_SLIP_BUCKET = 'permission-slips';

const emptyForm = () => ({
  title: '', date: '', end_date: '', team: '', category: 'BATTALION',
  event_time: '', end_time: '', location: '', poc: DEFAULT_POC.name, description: '', will_have_pictures: false, status: 'draft',
  uniform_required: false, uniform: '',
  transportation_required: false, transportation: '',
  permission_slip_required: false, permission_slip_url: '',
  color_guard_required: false,
  honor_guard_required: false,
  recurrence_days: [],
});

// Default 5-position roster in spec'd order: first 4 required, Alternate
// optional. Positions added via the modal's "+" button start optional too —
// only these 4 are ever hard-required.
const DEFAULT_COLOR_GUARD_POSITIONS = () => [
  { position_label: 'US Flag', required: true, cadet_consent_id: null, cadet_name: '', ascot_color: null, glove_color: null },
  { position_label: 'TN Flag', required: true, cadet_consent_id: null, cadet_name: '', ascot_color: null, glove_color: null },
  { position_label: 'US Rifle', required: true, cadet_consent_id: null, cadet_name: '', ascot_color: null, glove_color: null },
  { position_label: 'TN Rifle', required: true, cadet_consent_id: null, cadet_name: '', ascot_color: null, glove_color: null },
  { position_label: 'Alternate', required: false, cadet_consent_id: null, cadet_name: '', ascot_color: null, glove_color: null },
];
const ASCOT_COLORS = ['Red', 'White', 'Black'];
const GLOVE_COLORS = ['Black', 'White'];

// Fixed 11-position roster — Commander + 10 sabre-bearers. Every slot is
// required (no optional/alternate, no add/remove — unlike Color Guard this
// count never changes).
const DEFAULT_HONOR_GUARD_POSITIONS = () => [
  { position_label: 'Commander', cadet_consent_id: null, cadet_name: '' },
  ...Array.from({ length: 10 }, (_, i) => ({ position_label: `Sabre ${i + 1}`, cadet_consent_id: null, cadet_name: '' })),
];

// Core fields required before an event can be POSTED to the public calendar —
// mirrors the DB backstop in events_ironclad.sql (events_posted_requires_fields_check).
// Uniform Day events don't need a set start time, and Raiders events never
// require a uniform answer (uniform isn't applicable to that team) — both
// exemptions mirrored in the DB constraint.
function missingCore(f, positions = [], honorPositions = []) {
  const gaps = [];
  if (!f.title?.trim()) gaps.push('title');
  if (!f.date) gaps.push('date');
  if (!f.category) gaps.push('category');
  if (f.category !== 'UNIFORM_DAY' && !f.event_time) gaps.push('time');
  if (f.team !== 'raiders' && f.uniform_required && !f.uniform) gaps.push('uniform type');
  if (f.transportation_required && !f.transportation?.trim()) gaps.push('transportation detail');
  if (f.permission_slip_required && !f.permission_slip_url) gaps.push('permission slip PDF');
  if (f.recurrence_days?.length && !f.end_date) gaps.push('recurring end date');
  if (f.color_guard_required) {
    const incomplete = positions.filter((p) => p.required && (!p.cadet_consent_id || !p.ascot_color || !p.glove_color));
    if (incomplete.length) gaps.push(`color guard (${incomplete.length} position${incomplete.length > 1 ? 's' : ''})`);
  }
  if (f.honor_guard_required) {
    const incomplete = honorPositions.filter((p) => !p.cadet_consent_id);
    if (incomplete.length) gaps.push(`honor guard (${incomplete.length} position${incomplete.length > 1 ? 's' : ''})`);
  }
  return gaps;
}

// allowedTeams undefined = s6 (every team). An array (e.g. ['', 'raiders'])
// scopes the team select, filter buttons, and visible rows to just those team
// values — mirrors the RLS grant in opticsend.sql SECTION 9. '' = battalion.
export default function EventsPanel({ adminId, allowedTeams }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // 'new' | id | null
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [msg, setMsg] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [topics, setTopics] = useState([]);
  const [topicIds, setTopicIds] = useState([]);
  const [secondaryTeams, setSecondaryTeams] = useState([]);
  const [pdfTeam, setPdfTeam] = useState('all');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [positions, setPositions] = useState([]);
  const [guardOpen, setGuardOpen] = useState(false);
  const [honorPositions, setHonorPositions] = useState([]);
  const [honorGuardOpen, setHonorGuardOpen] = useState(false);
  const [roster, setRoster] = useState([]);

  const scopedTeams = allowedTeams
    ? EVENT_TEAMS.filter((t) => allowedTeams.includes(t.id))
    : EVENT_TEAMS;

  useEffect(() => { load(); loadTopics(); loadRoster(); }, []);

  async function load() {
    const { data } = await SB.from('events').select('*').order('date', { ascending: true });
    setRows(data || []);
  }

  async function loadTopics() {
    const { data } = await SB.from('voting_topics').select('*').eq('active', true).order('sort_order');
    setTopics(data || []);
  }

  async function loadEventTopics(eventId) {
    const { data } = await SB.from('event_voting_topics').select('topic_id').eq('event_id', eventId);
    setTopicIds((data || []).map((r) => r.topic_id));
  }

  async function loadEventSecondaryTeams(eventId) {
    const { data } = await SB.from('event_secondary_teams').select('team').eq('event_id', eventId);
    setSecondaryTeams((data || []).map((r) => r.team));
  }

  // Narrow id/name/company lookup (list_cadet_roster RPC) — bypasses
  // cadet_consent's S-6-only RLS but only exposes those 3 columns, to any
  // logged-in admin (s5 or s6). See supabase/events_color_guard.sql.
  async function loadRoster() {
    const { data } = await SB.rpc('list_cadet_roster');
    setRoster(data || []);
  }

  async function loadColorGuard(eventId) {
    const { data } = await SB.from('event_color_guard').select('*').eq('event_id', eventId).order('sort_order');
    setPositions((data || []).map((r) => ({
      position_label: r.position_label, required: r.required,
      cadet_consent_id: r.cadet_consent_id,
      cadet_name: roster.find((c) => c.id === r.cadet_consent_id)?.name || '',
      ascot_color: r.ascot_color, glove_color: r.glove_color,
    })));
  }

  async function loadHonorGuard(eventId) {
    const { data } = await SB.from('event_honor_guard').select('*').eq('event_id', eventId).order('sort_order');
    setHonorPositions((data || []).map((r) => ({
      position_label: r.position_label,
      cadet_consent_id: r.cadet_consent_id,
      cadet_name: roster.find((c) => c.id === r.cadet_consent_id)?.name || '',
    })));
  }

  function startNew() {
    setEditing('new');
    setForm(emptyForm());
    setTopicIds([]);
    setSecondaryTeams([]);
    setPositions([]);
    setHonorPositions([]);
    setMsg('');
  }
  function startEdit(r) {
    setEditing(r.id);
    setForm({
      title: r.title || '', date: r.date || '', end_date: r.end_date || '',
      team: r.team || '', category: r.category || 'BATTALION', event_time: r.event_time || '', end_time: r.end_time || '',
      location: r.location || '', poc: r.poc || '', description: r.description || '',
      will_have_pictures: !!r.will_have_pictures, status: r.status || 'draft',
      uniform_required: !!r.uniform_required, uniform: r.uniform || '',
      transportation_required: !!r.transportation_required, transportation: r.transportation || '',
      permission_slip_required: !!r.permission_slip_required, permission_slip_url: r.permission_slip_url || '',
      color_guard_required: !!r.color_guard_required,
      honor_guard_required: !!r.honor_guard_required,
      recurrence_days: r.recurrence_days || [],
    });
    loadEventTopics(r.id);
    loadEventSecondaryTeams(r.id);
    loadColorGuard(r.id);
    loadHonorGuard(r.id);
    setMsg('');
  }
  function cancel() { setEditing(null); setMsg(''); }

  // Build the row payload; team '' → NULL (battalion), empty strings → NULL.
  function payload(overrides = {}) {
    const f = { ...form, ...overrides };
    const nz = (v) => (v && String(v).trim() ? v : null);
    const recurring = f.recurrence_days?.length > 0;
    return {
      title: f.title.trim(), date: f.date, end_date: (f.category === 'BREAK' || recurring) ? nz(f.end_date) : null,
      team: f.team || null, category: f.category, event_time: nz(f.event_time), end_time: nz(f.end_time),
      location: nz(f.location), poc: nz(f.poc), description: nz(f.description),
      will_have_pictures: !!f.will_have_pictures, status: f.status,
      uniform_required: !!f.uniform_required, uniform: f.uniform_required ? nz(f.uniform) : null,
      transportation_required: !!f.transportation_required,
      transportation: f.transportation_required ? nz(f.transportation) : null,
      permission_slip_required: !!f.permission_slip_required,
      permission_slip_url: f.permission_slip_required ? nz(f.permission_slip_url) : null,
      color_guard_required: !!f.color_guard_required,
      honor_guard_required: !!f.honor_guard_required,
      recurrence_days: recurring ? f.recurrence_days : null,
    };
  }

  async function uploadPermissionSlip(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') { setMsg('Permission slip must be a PDF'); return; }
    setUploadingSlip(true);
    const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const { error } = await SB.storage.from(PERMISSION_SLIP_BUCKET).upload(path, file, { contentType: 'application/pdf' });
    setUploadingSlip(false);
    if (error) { setMsg(error.message); return; }
    const url = SB.storage.from(PERMISSION_SLIP_BUCKET).getPublicUrl(path).data.publicUrl;
    setForm((f) => ({ ...f, permission_slip_url: url }));
  }

  async function persist(body) {
    setSaving(true);
    let error, row;
    const isNew = editing === 'new';
    // A brand-new event posted directly (no separate draft step) has no
    // event_color_guard / event_honor_guard rows yet at INSERT time — the
    // events_color_guard_check / events_honor_guard_check triggers would
    // always reject it. Insert as draft first, sync the rosters below, then
    // promote to posted once the triggers have rows to check against.
    const twoPhase = isNew && (body.color_guard_required || body.honor_guard_required) && body.status === 'posted';
    const insertBody = twoPhase ? { ...body, status: 'draft' } : body;
    if (!isNew) {
      ({ error } = await SB.from('events').update(insertBody).eq('id', editing));
      row = { id: editing };
    } else {
      ({ data: row, error } = await SB.from('events').insert(insertBody).select().single());
    }
    if (error) { setSaving(false); setMsg(error.message); return null; }
    await SB.from('change_log').insert({
      admin_id: adminId, page: 'events', element: editing === 'new' ? 'new' : editing,
      label: `${body.status === 'posted' ? 'POST' : 'SAVE'} EVENT: ${body.title}`,
      value_before: {}, value_after: body,
    });
    await syncEventTopics(row.id);
    await syncEventSecondaryTeams(row.id);
    await syncColorGuard(row.id);
    await syncHonorGuard(row.id);
    if (twoPhase) {
      ({ error } = await SB.from('events').update({ status: 'posted' }).eq('id', row.id));
      if (error) { setSaving(false); setMsg(error.message); return null; }
    }
    setSaving(false);
    load();
    return row;
  }

  // Voting topics only apply to photo events — replace the full selection set
  // on every save rather than diffing (small lists, simplest correct approach).
  async function syncEventTopics(eventId) {
    await SB.from('event_voting_topics').delete().eq('event_id', eventId);
    if (form.will_have_pictures && topicIds.length) {
      await SB.from('event_voting_topics').insert(topicIds.map((topic_id) => ({ event_id: eventId, topic_id })));
    }
  }

  // "Also show on" calendars — additional team tags beyond the owning `team`
  // (see events_multi_calendar.sql). Replace the full set on every save, same
  // approach as syncEventTopics. Guard against tagging the owning team again.
  async function syncEventSecondaryTeams(eventId) {
    await SB.from('event_secondary_teams').delete().eq('event_id', eventId);
    const extra = secondaryTeams.filter((t) => t && t !== form.team);
    if (extra.length) {
      await SB.from('event_secondary_teams').insert(extra.map((team) => ({ event_id: eventId, team })));
    }
  }

  // Color Guard roster — same delete-all-then-reinsert approach as the two
  // syncs above (small lists, simplest correct approach). Ascot/glove only
  // persist alongside an actual assignment; clearing a position drops them.
  async function syncColorGuard(eventId) {
    await SB.from('event_color_guard').delete().eq('event_id', eventId);
    if (form.color_guard_required && positions.length) {
      await SB.from('event_color_guard').insert(positions.map((p, i) => ({
        event_id: eventId, position_label: p.position_label, sort_order: i, required: p.required,
        cadet_consent_id: p.cadet_consent_id || null,
        ascot_color: p.cadet_consent_id ? p.ascot_color : null,
        glove_color: p.cadet_consent_id ? p.glove_color : null,
      })));
    }
  }

  // Honor Guard roster — same delete-all-then-reinsert approach. Always the
  // fixed 11 positions (Commander + Sabre 1-10) when the toggle is on.
  async function syncHonorGuard(eventId) {
    await SB.from('event_honor_guard').delete().eq('event_id', eventId);
    if (form.honor_guard_required && honorPositions.length) {
      await SB.from('event_honor_guard').insert(honorPositions.map((p, i) => ({
        event_id: eventId, position_label: p.position_label, sort_order: i,
        cadet_consent_id: p.cadet_consent_id || null,
      })));
    }
  }

  async function saveDraft() {
    if (!form.title.trim()) { setMsg('Title required to save'); return; }
    const row = await persist(payload({ status: form.status === 'posted' ? 'posted' : 'draft' }));
    if (row) { setMsg('Saved ✓'); setEditing(null); }
  }
  async function post() {
    const gaps = missingCore(form, positions, honorPositions);
    if (gaps.length) { setMsg(`Cannot post, missing: ${gaps.join(', ')}`); return; }
    const row = await persist(payload({ status: 'posted' }));
    if (row) { setMsg('Posted to public calendar ✓'); setEditing(null); }
  }
  async function unpost(r) {
    await SB.from('events').update({ status: 'draft' }).eq('id', r.id);
    load();
  }
  // Parent-facing printable calendar — always pulled fresh + posted-only, so
  // drafts never leak and the PDF matches whatever's currently live.
  async function exportPdf() {
    setGeneratingPdf(true);
    const { data } = await SB.from('events').select('*').eq('status', 'posted').order('date', { ascending: true });
    await openEventsCalendarPdf(data || [], { team: pdfTeam });
    setGeneratingPdf(false);
  }

  async function del(r) {
    if (!confirm(`Delete "${r.title}"? This removes it from the calendar permanently.`)) return;
    await SB.from('change_log').insert({ admin_id: adminId, page: 'events', element: r.id, label: `DELETE EVENT: ${r.title}`, value_before: r, value_after: null });
    await SB.from('events').delete().eq('id', r.id);
    if (editing === r.id) setEditing(null);
    load();
  }

  const filtered = useMemo(() => {
    const base = allowedTeams ? rows.filter((r) => allowedTeams.includes(r.team || '')) : rows;
    if (teamFilter === 'all') return base;
    if (teamFilter === 'battalion') return base.filter((r) => !r.team);
    return base.filter((r) => r.team === teamFilter);
  }, [rows, teamFilter, allowedTeams]);

  const groups = groupByMonth(filtered.map(toCalendarItem));
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);

  const postedCount = rows.filter((r) => r.status === 'posted').length;
  const coreGaps = missingCore(form, positions, honorPositions);
  // S-5's delete grant stays battalion-only even though their edit grant now
  // covers Raiders too (opticsend.sql SECTION 9 leaves events_del_admin
  // unchanged) — hide the button rather than let it fail silently against RLS.
  const canDelete = !allowedTeams || !rowById[editing]?.team;
  // Secondary calendars can only ever be a specialty team (battalion visibility
  // is unconditional — see events_multi_calendar.sql) and never the team already
  // set as the owning `team` above.
  const secondaryTeamOptions = scopedTeams.filter((t) => t.id && t.id !== form.team);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 1fr' : '1fr', gap: sp[4], maxWidth: editing ? 'none' : 900 }}>
      <div>
        <PanelHeader
          title={allowedTeams ? 'CALENDAR · BATTALION + RAIDERS' : 'CALENDAR'}
          sub={allowedTeams ? `${filtered.length} events · battalion + Raiders (S-5)` : `${rows.length} events · ${postedCount} posted · battalion + team calendars`}
          action={
            <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={pdfTeam} onChange={(e) => setPdfTeam(e.target.value)} style={{ ...selectStyle, width: 'auto', padding: '8px 10px', fontSize: fs.tiny }}>
                <option value="all">All teams</option>
                <option value="battalion">Battalion only</option>
                {scopedTeams.filter((t) => t.id).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <Btn onClick={exportPdf} variant="ghost" size="sm" disabled={generatingPdf}>{generatingPdf ? 'BUILDING…' : 'EXPORT PDF'}</Btn>
              <Btn onClick={startNew} variant="gold" size="sm">+ NEW EVENT</Btn>
            </div>
          }
        />

        {/* team calendar filter — scoped to allowedTeams for S-5 */}
        <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'ALL' }, { id: 'battalion', label: 'BATTALION' }, ...scopedTeams.filter((t) => t.id).map((t) => ({ id: t.id, label: t.label.toUpperCase() }))].map((t) => (
            <Btn key={t.id} variant={teamFilter === t.id ? 'gold' : 'ghost'} size="sm" onClick={() => setTeamFilter(t.id)}>{t.label}</Btn>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="◷" title="NO EVENTS" hint="Add battalion and team events here. Fill title, date, and category, then POST to publish to the public calendar." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[4] }}>
            {groups.map((g) => (
              <div key={g.key}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: sp[2], paddingBottom: 5, borderBottom: `1px solid ${P.hair}` }}>
                  <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, letterSpacing: '0.18em' }}>{MONTHS[g.m]} {g.y}</span>
                  <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute }}>{g.items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: sp[1] }}>
                  {g.items.map((it) => {
                    const r = rowById[it.id];
                    if (!r) return null;
                    const posted = r.status === 'posted';
                    return (
                      <Card key={r.id} style={{ padding: `${sp[2]}px ${sp[3]}px`, border: `1px solid ${editing === r.id ? P.gold : P.hair}`, cursor: 'pointer' }} onClick={() => startEdit(r)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
                          <div style={{ minWidth: 34, textAlign: 'center' }}>
                            <div style={{ fontFamily: mono, fontSize: fs.md, color: P.cream, lineHeight: 1 }}>{it.d2 ? `${it.d}–${it.d2}` : String(it.d).padStart(2, '0')}</div>
                            <div style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>{MON3[it.m]}</div>
                          </div>
                          <span style={{ width: 7, height: 7, background: categoryColor(it.cat), flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, marginTop: 2 }}>
                              {teamLabel(r.team).toUpperCase()} · {(r.category || 'EVENT').replace('_', ' ')}{r.will_have_pictures ? ' · 📷' : ''}{r.location ? ` · ${r.location}` : ''}
                            </div>
                          </div>
                          <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.1em', color: posted ? P.green : P.bright, whiteSpace: 'nowrap' }}>{posted ? 'POSTED' : 'DRAFT'}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div>
          <PanelHeader title={editing === 'new' ? 'NEW EVENT' : 'EDIT EVENT'} action={
            <div style={{ display: 'flex', gap: sp[2] }}>
              <Btn onClick={cancel} variant="ghost" size="sm">CANCEL</Btn>
              {editing !== 'new' && canDelete && <Btn onClick={() => del(rowById[editing])} variant="danger" size="sm">DELETE</Btn>}
            </div>
          } />
          <Card>
            <div style={{ marginBottom: sp[3] }}>
              <Label>Title <span style={{ color: P.red }}>*</span></Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: (form.category === 'BREAK' || form.recurrence_days.length > 0) ? '1fr 1fr' : '1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Date {form.recurrence_days.length > 0 ? '(series start)' : ''}<span style={{ color: P.red }}> *</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              {(form.category === 'BREAK' || form.recurrence_days.length > 0) && (
                <div>
                  <Label>End date {form.recurrence_days.length > 0 ? '(series end)' : '(multi-day / range)'}<span style={{ color: P.red }}> *</span></Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Recurring (weekly)</Label>
              <div style={{ display: 'flex', gap: sp[2], marginBottom: form.recurrence_days.length ? sp[2] : 0 }}>
                {[false, true].map((v) => (
                  <Btn
                    key={String(v)}
                    variant={(form.recurrence_days.length > 0) === v ? 'gold' : 'ghost'}
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, recurrence_days: v ? (f.recurrence_days.length ? f.recurrence_days : [1, 2, 3, 4]) : [] }))}
                  >
                    {v ? 'YES' : 'NO'}
                  </Btn>
                ))}
              </div>
              {form.recurrence_days.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: sp[1], flexWrap: 'wrap' }}>
                    {WEEKDAY_SHORT.map((label, idx) => {
                      const on = form.recurrence_days.includes(idx);
                      return (
                        <Btn
                          key={idx}
                          size="sm"
                          variant={on ? 'gold' : 'ghost'}
                          onClick={() => setForm((f) => ({
                            ...f,
                            recurrence_days: on ? f.recurrence_days.filter((d) => d !== idx) : [...f.recurrence_days, idx].sort((a, b) => a - b),
                          }))}
                        >
                          {label}
                        </Btn>
                      );
                    })}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.04em', marginTop: sp[1] }}>
                    Repeats weekly on the selected days from Date through End Date. Renders as repeating occurrences on the Raiders team calendar only — other calendars show it once, on Date.
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Calendar (team)</Label>
                <select
                  value={form.team}
                  onChange={(e) => {
                    const team = e.target.value;
                    // Raiders default to true (Luke wants every Raiders event
                    // treated as a photo event) — always overridable below,
                    // and never forced false just for switching teams away.
                    // Uniform isn't applicable to Raiders events at all, so
                    // switching to Raiders clears/un-requires it — this wins
                    // over the Uniform Day auto-force-yes below.
                    setForm((f) => ({
                      ...f, team,
                      will_have_pictures: team === 'raiders' ? true : f.will_have_pictures,
                      uniform_required: team === 'raiders' ? false : f.uniform_required,
                      uniform: team === 'raiders' ? '' : f.uniform,
                    }));
                    // A calendar can't be both the owning team and an "also show
                    // on" tag — drop it from the secondary set if it's now primary.
                    setSecondaryTeams((s) => s.filter((t) => t !== team));
                  }}
                  style={selectStyle}
                >
                  {scopedTeams.map((t) => <option key={t.id || 'battalion'} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Category <span style={{ color: P.red }}>*</span></Label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    setForm((f) => ({
                      ...f, category,
                      end_date: category === 'BREAK' ? f.end_date : '',
                      uniform_required: (category === 'UNIFORM_DAY' && f.team !== 'raiders') ? true : f.uniform_required,
                    }));
                  }}
                  style={selectStyle}
                >
                  {CATEGORY_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.id === 'UNIFORM_DAY' ? 'UNIFORM DAY' : c.id}</option>)}
                </select>
              </div>
            </div>

            {secondaryTeamOptions.length > 0 && (
              <div style={{ marginBottom: sp[3] }}>
                <Label>Also show on</Label>
                <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
                  {secondaryTeamOptions.map((t) => {
                    const on = secondaryTeams.includes(t.id);
                    return (
                      <Btn
                        key={t.id}
                        variant={on ? 'gold' : 'ghost'}
                        size="sm"
                        onClick={() => setSecondaryTeams((s) => on ? s.filter((id) => id !== t.id) : [...s, t.id])}
                      >
                        {t.label}
                      </Btn>
                    );
                  })}
                </div>
                <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.04em', marginTop: sp[1] }}>
                  Event stays owned by its Calendar (team) above for editing/posting rules — this just also renders it on the picked team calendar(s).
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Time{form.category !== 'UNIFORM_DAY' ? <span style={{ color: P.red }}> *</span> : null}</Label>
                <Input type="time" value={form.event_time} onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Uniform{(form.category === 'UNIFORM_DAY' && form.team !== 'raiders') ? <span style={{ color: P.red }}> *</span> : null}</Label>
              {form.team === 'raiders' ? (
                <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute }}>N/A — not applicable for Raiders events</div>
              ) : (
                <div style={{ display: 'flex', gap: sp[2], marginBottom: form.uniform_required ? sp[2] : 0 }}>
                  {[false, true].map((v) => (
                    <Btn
                      key={String(v)}
                      variant={form.uniform_required === v ? 'gold' : 'ghost'}
                      size="sm"
                      disabled={form.category === 'UNIFORM_DAY'}
                      onClick={() => setForm((f) => ({ ...f, uniform_required: v, uniform: v ? f.uniform : '' }))}
                    >
                      {v ? 'YES' : 'NO'}
                    </Btn>
                  ))}
                </div>
              )}
              {form.uniform_required && (
                <select value={form.uniform} onChange={(e) => setForm((f) => ({ ...f, uniform: e.target.value }))} style={selectStyle}>
                  <option value="">Select type…</option>
                  {UNIFORM_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>POC</Label>
              <Input value={form.poc} onChange={(e) => setForm((f) => ({ ...f, poc: e.target.value }))} placeholder="name / role" />
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Transportation</Label>
              <div style={{ display: 'flex', gap: sp[2], marginBottom: form.transportation_required ? sp[2] : 0 }}>
                {[false, true].map((v) => (
                  <Btn
                    key={String(v)}
                    variant={form.transportation_required === v ? 'gold' : 'ghost'}
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, transportation_required: v, transportation: v ? f.transportation : '' }))}
                  >
                    {v ? 'YES' : 'NO'}
                  </Btn>
                ))}
              </div>
              {form.transportation_required && (
                <Input value={form.transportation} onChange={(e) => setForm((f) => ({ ...f, transportation: e.target.value }))} placeholder="bus / van / walking…" />
              )}
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Permission Slip</Label>
              <div style={{ display: 'flex', gap: sp[2], marginBottom: form.permission_slip_required ? sp[2] : 0 }}>
                {[false, true].map((v) => (
                  <Btn
                    key={String(v)}
                    variant={form.permission_slip_required === v ? 'gold' : 'ghost'}
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, permission_slip_required: v, permission_slip_url: v ? f.permission_slip_url : '' }))}
                  >
                    {v ? 'YES' : 'NO'}
                  </Btn>
                ))}
              </div>
              {form.permission_slip_required && (
                <div>
                  <input
                    type="file" accept="application/pdf"
                    onChange={(e) => uploadPermissionSlip(e.target.files?.[0])}
                    style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream }}
                  />
                  {uploadingSlip && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: sp[1] }}>uploading…</div>}
                  {form.permission_slip_url && !uploadingSlip && (
                    <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginTop: sp[1] }}>
                      ✓ uploaded: <a href={form.permission_slip_url} target="_blank" rel="noopener noreferrer" style={{ color: P.green }}>view PDF</a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Color Guard</Label>
              <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
                {[false, true].map((v) => (
                  <Btn
                    key={String(v)}
                    variant={form.color_guard_required === v ? 'gold' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setForm((f) => ({ ...f, color_guard_required: v }));
                      if (v && !positions.length) setPositions(DEFAULT_COLOR_GUARD_POSITIONS());
                    }}
                  >
                    {v ? 'YES' : 'NO'}
                  </Btn>
                ))}
                {form.color_guard_required && (
                  <Btn onClick={() => setGuardOpen(true)} variant="ghost" size="sm">
                    MANAGE ROSTER ({positions.filter((p) => p.cadet_consent_id).length}/{positions.length})
                  </Btn>
                )}
              </div>
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Honor Guard</Label>
              <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
                {[false, true].map((v) => (
                  <Btn
                    key={String(v)}
                    variant={form.honor_guard_required === v ? 'gold' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setForm((f) => ({ ...f, honor_guard_required: v }));
                      if (v && !honorPositions.length) setHonorPositions(DEFAULT_HONOR_GUARD_POSITIONS());
                    }}
                  >
                    {v ? 'YES' : 'NO'}
                  </Btn>
                ))}
                {form.honor_guard_required && (
                  <Btn onClick={() => setHonorGuardOpen(true)} variant="ghost" size="sm">
                    MANAGE ROSTER ({honorPositions.filter((p) => p.cadet_consent_id).length}/{honorPositions.length})
                  </Btn>
                )}
              </div>
              <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.06em', marginTop: sp[1] }}>
                Commander + 10 sabre-bearers. All 11 positions required to post.
              </div>
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Description / notes</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} multiline />
            </div>

            <div style={{ marginBottom: sp[4] }}>
              <Label>Photo event</Label>
              <div style={{ display: 'flex', gap: sp[2] }}>
                {[false, true].map((v) => (
                  <Btn key={String(v)} variant={form.will_have_pictures === v ? 'gold' : 'ghost'} size="sm" onClick={() => setForm((f) => ({ ...f, will_have_pictures: v }))}>{v ? 'YES' : 'NO'}</Btn>
                ))}
              </div>
              <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.06em', marginTop: sp[1] }}>
                Gallery attaches, voting topics apply, and (for Raiders) OpticSend fires the day after.
              </div>
            </div>

            {form.will_have_pictures && (
              <div style={{ marginBottom: sp[4] }}>
                <Label>Voting topics</Label>
                {topics.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[2] }}>
                    {topics.map((t) => {
                      const on = topicIds.includes(t.id);
                      return (
                        <Btn
                          key={t.id}
                          variant={on ? 'gold' : 'ghost'}
                          size="sm"
                          onClick={() => setTopicIds((ids) => on ? ids.filter((id) => id !== t.id) : [...ids, t.id])}
                        >
                          {t.label}
                        </Btn>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute }}>
                    NO TOPICS DEFINED YET. Add some under Advanced → Voting Topics
                  </div>
                )}
              </div>
            )}

            {msg && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: msg.includes('✓') ? P.green : P.red, marginBottom: sp[3] }}>{msg}</div>}

            <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', alignItems: 'center' }}>
              <Btn onClick={saveDraft} variant="ghost" size="sm" disabled={saving}>{saving ? '…' : 'SAVE DRAFT'}</Btn>
              <Btn onClick={post} variant="gold" size="sm" disabled={saving || coreGaps.length > 0}>POST TO CALENDAR</Btn>
              {form.status === 'posted' && editing !== 'new' && <Btn onClick={() => unpost(rowById[editing])} variant="ghost" size="sm">UNPOST</Btn>}
              {coreGaps.length > 0 && <span style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>need: {coreGaps.join(', ')}</span>}
            </div>
          </Card>

          <Modal open={guardOpen} onClose={() => setGuardOpen(false)} title="COLOR GUARD ROSTER" width={640} footer={
            <Btn onClick={() => setGuardOpen(false)} variant="gold" size="sm">CLOSE</Btn>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
              {positions.map((p, idx) => {
                const patch = (fields) => setPositions((ps) => ps.map((row, i) => (i === idx ? { ...row, ...fields } : row)));
                return (
                  <div key={idx} style={{ border: `1px solid ${P.hair}`, borderRadius: 5, padding: sp[3] }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], marginBottom: sp[2] }}>
                      <div style={{ flex: 1 }}>
                        <Label style={{ marginBottom: 4 }}>
                          POSITION #{idx + 1}{p.required && <span style={{ color: P.red }}> *</span>}
                        </Label>
                        {idx < 5 ? (
                          <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream }}>{p.position_label}</div>
                        ) : (
                          <Input value={p.position_label} placeholder="Position name" onChange={(e) => patch({ position_label: e.target.value })} />
                        )}
                      </div>
                      {idx >= 5 && (
                        <button onClick={() => setPositions((ps) => ps.filter((_, i) => i !== idx))} aria-label="Remove position" style={{
                          all: 'unset', cursor: 'pointer', color: P.faint, fontSize: fs.md, lineHeight: 1, padding: 4,
                        }}>✕</button>
                      )}
                    </div>

                    <CadetPicker
                      value={p.cadet_consent_id}
                      name={p.cadet_name}
                      roster={roster}
                      onChange={(id, name) => patch({ cadet_consent_id: id, cadet_name: name, ascot_color: id ? p.ascot_color : null, glove_color: id ? p.glove_color : null })}
                    />

                    {p.cadet_consent_id && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginTop: sp[2] }}>
                        <div>
                          <Label style={{ marginBottom: 4 }}>Ascot<span style={{ color: P.red }}> *</span></Label>
                          <Select
                            value={p.ascot_color || ''}
                            onChange={(e) => patch({ ascot_color: e.target.value || null })}
                            options={[{ value: '', label: 'Select…' }, ...ASCOT_COLORS.map((c) => ({ value: c, label: c }))]}
                          />
                        </div>
                        <div>
                          <Label style={{ marginBottom: 4 }}>Glove<span style={{ color: P.red }}> *</span></Label>
                          <Select
                            value={p.glove_color || ''}
                            onChange={(e) => patch({ glove_color: e.target.value || null })}
                            options={[{ value: '', label: 'Select…' }, ...GLOVE_COLORS.map((c) => ({ value: c, label: c }))]}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <Btn
                onClick={() => setPositions((ps) => [...ps, { position_label: '', required: false, cadet_consent_id: null, cadet_name: '', ascot_color: null, glove_color: null }])}
                variant="ghost" size="sm"
              >
                + ADD POSITION
              </Btn>
            </div>
          </Modal>

          <Modal open={honorGuardOpen} onClose={() => setHonorGuardOpen(false)} title="HONOR GUARD ROSTER" width={640} footer={
            <Btn onClick={() => setHonorGuardOpen(false)} variant="gold" size="sm">CLOSE</Btn>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
              {honorPositions.map((p, idx) => {
                const patch = (fields) => setHonorPositions((ps) => ps.map((row, i) => (i === idx ? { ...row, ...fields } : row)));
                return (
                  <div key={idx} style={{ border: `1px solid ${P.hair}`, borderRadius: 5, padding: sp[3] }}>
                    <div style={{ marginBottom: sp[2] }}>
                      <Label style={{ marginBottom: 4 }}>
                        {p.position_label}<span style={{ color: P.red }}> *</span>
                      </Label>
                    </div>
                    <CadetPicker
                      value={p.cadet_consent_id}
                      name={p.cadet_name}
                      roster={roster}
                      onChange={(id, name) => patch({ cadet_consent_id: id, cadet_name: name })}
                    />
                  </div>
                );
              })}
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}

// Searchable cadet picker — filters the preloaded `roster` (id/name/company,
// from list_cadet_roster()) client-side by substring match. No typeahead
// component existed anywhere in this codebase, so this is a small purpose-built
// one rather than a new shared primitive (single consumer today).
function CadetPicker({ value, name, roster, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  if (value) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: inter, fontSize: fs.sm, color: P.cream,
        background: P.deep, border: `1px solid ${P.hair}`, borderRadius: 5, padding: '8px 10px',
      }}>
        {name || 'Assigned cadet'}
        <button onClick={() => onChange(null, '')} aria-label="Change" style={{
          all: 'unset', cursor: 'pointer', color: P.faint, fontSize: fs.tiny, marginLeft: 4,
        }}>✕ change</button>
      </div>
    );
  }

  const matches = query.trim()
    ? roster.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : roster.slice(0, 8);

  return (
    <div style={{ position: 'relative' }}>
      <Input
        value={query}
        placeholder="Search cadet…"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
          background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: 5, boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {matches.map((c) => (
            <div
              key={c.id}
              onMouseDown={() => { onChange(c.id, c.name); setQuery(''); setOpen(false); }}
              style={{
                padding: '8px 10px', cursor: 'pointer', fontFamily: inter, fontSize: fs.sm, color: P.cream,
                borderBottom: `1px solid ${P.hair}`,
              }}
            >
              {c.name} <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint }}>· {c.company}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  width: '100%', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: inter, fontSize: fs.sm, padding: '10px 12px', outline: 'none', cursor: 'pointer', borderRadius: 5, boxSizing: 'border-box',
};
