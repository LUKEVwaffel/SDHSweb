import { useState, useEffect, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../shared/ui';
import { EVENT_CATEGORIES, EVENT_TEAMS, UNIFORM_TYPES, DEFAULT_POC, categoryColor, teamLabel, MONTHS, MON3, toCalendarItem, groupByMonth } from '../../../lib/calendar';

// S-6 manages the whole calendar here: the main battalion calendar (team NULL)
// and all 4 specialty-team calendars, one row per event in `events`. Mirrors the
// public calendar (Bulletin) structure — month-grouped, category color pills —
// but this is backend-only: NO photos are shown here. `will_have_pictures` just
// flags an event that a gallery will attach to later.
const CATEGORY_OPTIONS = EVENT_CATEGORIES.filter((c) => c.id !== 'EVENT');
const PERMISSION_SLIP_BUCKET = 'permission-slips';

const emptyForm = () => ({
  title: '', date: '', end_date: '', team: '', category: 'BATTALION',
  event_time: '', location: '', poc: DEFAULT_POC.name, description: '', will_have_pictures: false, status: 'draft',
  uniform_required: false, uniform: '',
  transportation_required: false, transportation: '',
  permission_slip_required: false, permission_slip_url: '',
});

// Core fields required before an event can be POSTED to the public calendar —
// mirrors the DB backstop in events_ironclad.sql (events_posted_requires_fields_check).
function missingCore(f) {
  const gaps = [];
  if (!f.title?.trim()) gaps.push('title');
  if (!f.date) gaps.push('date');
  if (!f.category) gaps.push('category');
  if (!f.event_time) gaps.push('time');
  if (f.uniform_required && !f.uniform) gaps.push('uniform type');
  if (f.transportation_required && !f.transportation?.trim()) gaps.push('transportation detail');
  if (f.permission_slip_required && !f.permission_slip_url) gaps.push('permission slip PDF');
  return gaps;
}

export default function EventsPanel({ adminId, battalionOnly = false }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // 'new' | id | null
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [msg, setMsg] = useState('');
  const [teamFilter, setTeamFilter] = useState(battalionOnly ? 'battalion' : 'all');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await SB.from('events').select('*').order('date', { ascending: true });
    setRows(data || []);
  }

  function startNew() {
    setEditing('new');
    setForm(emptyForm());
    setMsg('');
  }
  function startEdit(r) {
    setEditing(r.id);
    setForm({
      title: r.title || '', date: r.date || '', end_date: r.end_date || '',
      team: r.team || '', category: r.category || 'BATTALION', event_time: r.event_time || '',
      location: r.location || '', poc: r.poc || '', description: r.description || '',
      will_have_pictures: !!r.will_have_pictures, status: r.status || 'draft',
      uniform_required: !!r.uniform_required, uniform: r.uniform || '',
      transportation_required: !!r.transportation_required, transportation: r.transportation || '',
      permission_slip_required: !!r.permission_slip_required, permission_slip_url: r.permission_slip_url || '',
    });
    setMsg('');
  }
  function cancel() { setEditing(null); setMsg(''); }

  // Build the row payload; team '' → NULL (battalion), empty strings → NULL.
  function payload(overrides = {}) {
    const f = { ...form, ...overrides };
    const nz = (v) => (v && String(v).trim() ? v : null);
    return {
      title: f.title.trim(), date: f.date, end_date: f.category === 'BREAK' ? nz(f.end_date) : null,
      team: f.team || null, category: f.category, event_time: nz(f.event_time),
      location: nz(f.location), poc: nz(f.poc), description: nz(f.description),
      will_have_pictures: !!f.will_have_pictures, status: f.status,
      uniform_required: !!f.uniform_required, uniform: f.uniform_required ? nz(f.uniform) : null,
      transportation_required: !!f.transportation_required,
      transportation: f.transportation_required ? nz(f.transportation) : null,
      permission_slip_required: !!f.permission_slip_required,
      permission_slip_url: f.permission_slip_required ? nz(f.permission_slip_url) : null,
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
    let error;
    if (editing && editing !== 'new') {
      ({ error } = await SB.from('events').update(body).eq('id', editing));
    } else {
      ({ error } = await SB.from('events').insert(body));
    }
    setSaving(false);
    if (error) { setMsg(error.message); return false; }
    await SB.from('change_log').insert({
      admin_id: adminId, page: 'events', element: editing === 'new' ? 'new' : editing,
      label: `${body.status === 'posted' ? 'POST' : 'SAVE'} EVENT: ${body.title}`,
      value_before: {}, value_after: body,
    });
    load();
    return true;
  }

  async function saveDraft() {
    if (!form.title.trim()) { setMsg('Title required to save'); return; }
    const ok = await persist(payload({ status: form.status === 'posted' ? 'posted' : 'draft' }));
    if (ok) { setMsg('Saved ✓'); setEditing(null); }
  }
  async function post() {
    const gaps = missingCore(form);
    if (gaps.length) { setMsg(`Cannot post — missing: ${gaps.join(', ')}`); return; }
    const ok = await persist(payload({ status: 'posted' }));
    if (ok) { setMsg('Posted to public calendar ✓'); setEditing(null); }
  }
  async function unpost(r) {
    await SB.from('events').update({ status: 'draft' }).eq('id', r.id);
    load();
  }
  async function del(r) {
    if (!confirm(`Delete "${r.title}"? This removes it from the calendar permanently.`)) return;
    await SB.from('change_log').insert({ admin_id: adminId, page: 'events', element: r.id, label: `DELETE EVENT: ${r.title}`, value_before: r, value_after: null });
    await SB.from('events').delete().eq('id', r.id);
    if (editing === r.id) setEditing(null);
    load();
  }

  const filtered = useMemo(() => {
    if (battalionOnly) return rows.filter((r) => !r.team);
    if (teamFilter === 'all') return rows;
    if (teamFilter === 'battalion') return rows.filter((r) => !r.team);
    return rows.filter((r) => r.team === teamFilter);
  }, [rows, teamFilter, battalionOnly]);

  const groups = groupByMonth(filtered.map(toCalendarItem));
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);

  const postedCount = rows.filter((r) => r.status === 'posted').length;
  const coreGaps = missingCore(form);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 1fr' : '1fr', gap: sp[4], maxWidth: editing ? 'none' : 900 }}>
      <div>
        <PanelHeader
          title={battalionOnly ? 'BATTALION CALENDAR' : 'CALENDAR'}
          sub={battalionOnly ? `${filtered.length} battalion events · main calendar (S-5)` : `${rows.length} events · ${postedCount} posted · battalion + team calendars`}
          action={<Btn onClick={startNew} variant="gold" size="sm">+ NEW EVENT</Btn>}
        />

        {/* team calendar filter — hidden for S-5 (battalion-only scope) */}
        {!battalionOnly && (
          <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
            {[{ id: 'all', label: 'ALL' }, { id: 'battalion', label: 'BATTALION' }, ...EVENT_TEAMS.filter((t) => t.id).map((t) => ({ id: t.id, label: t.label.toUpperCase() }))].map((t) => (
              <Btn key={t.id} variant={teamFilter === t.id ? 'gold' : 'ghost'} size="sm" onClick={() => setTeamFilter(t.id)}>{t.label}</Btn>
            ))}
          </div>
        )}

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
              {editing !== 'new' && <Btn onClick={() => del(rowById[editing])} variant="danger" size="sm">DELETE</Btn>}
            </div>
          } />
          <Card>
            <div style={{ marginBottom: sp[3] }}>
              <Label>Title <span style={{ color: P.red }}>*</span></Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: form.category === 'BREAK' ? '1fr 1fr' : '1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Date <span style={{ color: P.red }}>*</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              {form.category === 'BREAK' && (
                <div>
                  <Label>End date (multi-day / range)</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: battalionOnly ? '1fr' : '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              {!battalionOnly && (
                <div>
                  <Label>Calendar (team)</Label>
                  <select value={form.team} onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))} style={selectStyle}>
                    {EVENT_TEAMS.map((t) => <option key={t.id || 'battalion'} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label>Category <span style={{ color: P.red }}>*</span></Label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    setForm((f) => ({
                      ...f, category,
                      end_date: category === 'BREAK' ? f.end_date : '',
                      uniform_required: category === 'UNIFORM_DAY' ? true : f.uniform_required,
                    }));
                  }}
                  style={selectStyle}
                >
                  {CATEGORY_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.id === 'UNIFORM_DAY' ? 'UNIFORM DAY' : c.id}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Time <span style={{ color: P.red }}>*</span></Label>
                <Input type="time" value={form.event_time} onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))} />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Uniform{form.category === 'UNIFORM_DAY' ? <span style={{ color: P.red }}> *</span> : null}</Label>
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
                      ✓ uploaded — <a href={form.permission_slip_url} target="_blank" rel="noopener noreferrer" style={{ color: P.green }}>view PDF</a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Description / notes</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} multiline />
            </div>

            <div style={{ marginBottom: sp[4] }}>
              <Label>Will have pictures</Label>
              <div style={{ display: 'flex', gap: sp[2] }}>
                {[false, true].map((v) => (
                  <Btn key={String(v)} variant={form.will_have_pictures === v ? 'gold' : 'ghost'} size="sm" onClick={() => setForm((f) => ({ ...f, will_have_pictures: v }))}>{v ? 'YES' : 'NO'}</Btn>
                ))}
              </div>
            </div>

            {msg && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: msg.includes('✓') ? P.green : P.red, marginBottom: sp[3] }}>{msg}</div>}

            <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', alignItems: 'center' }}>
              <Btn onClick={saveDraft} variant="ghost" size="sm" disabled={saving}>{saving ? '…' : 'SAVE DRAFT'}</Btn>
              <Btn onClick={post} variant="gold" size="sm" disabled={saving || coreGaps.length > 0}>POST TO CALENDAR</Btn>
              {form.status === 'posted' && editing !== 'new' && <Btn onClick={() => unpost(rowById[editing])} variant="ghost" size="sm">UNPOST</Btn>}
              {coreGaps.length > 0 && <span style={{ fontFamily: mono, fontSize: 8, color: P.mute }}>need: {coreGaps.join(', ')}</span>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  width: '100%', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
  fontFamily: inter, fontSize: fs.sm, padding: '10px 12px', outline: 'none', cursor: 'pointer', borderRadius: 5, boxSizing: 'border-box',
};
