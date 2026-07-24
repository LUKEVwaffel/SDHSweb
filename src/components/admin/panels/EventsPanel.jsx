import { useState, useEffect, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../shared/ui';
import { EVENT_CATEGORIES, EVENT_TEAMS, categoryColor, teamLabel, MONTHS, MON3, toCalendarItem, groupByMonth } from '../../../lib/calendar';

// S-6 manages the whole calendar here: the main battalion calendar (team NULL)
// and all 4 specialty-team calendars, one row per event in `events`. Mirrors the
// public calendar (Bulletin) structure — month-grouped, category color pills —
// but this is backend-only: NO photos are shown here. `will_have_pictures` just
// flags an event that a gallery will attach to later.
const CATEGORY_OPTIONS = EVENT_CATEGORIES.filter((c) => c.id !== 'EVENT');

const emptyForm = () => ({
  title: '', date: '', end_date: '', team: '', category: 'BATTALION',
  time_label: '', location: '', uniform: '', poc: '', transportation: '',
  description: '', will_have_pictures: false, status: 'draft',
});

// Core fields required before an event can be POSTED to the public calendar.
function missingCore(f) {
  const gaps = [];
  if (!f.title?.trim()) gaps.push('title');
  if (!f.date) gaps.push('date');
  if (!f.category) gaps.push('category');
  return gaps;
}

export default function EventsPanel({ adminId, battalionOnly = false }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // 'new' | id | null
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
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
      team: r.team || '', category: r.category || 'BATTALION', time_label: r.time_label || '',
      location: r.location || '', uniform: r.uniform || '', poc: r.poc || '',
      transportation: r.transportation || '', description: r.description || '',
      will_have_pictures: !!r.will_have_pictures, status: r.status || 'draft',
    });
    setMsg('');
  }
  function cancel() { setEditing(null); setMsg(''); }

  // Build the row payload; team '' → NULL (battalion), empty strings → NULL.
  function payload(overrides = {}) {
    const f = { ...form, ...overrides };
    const nz = (v) => (v && String(v).trim() ? v : null);
    return {
      title: f.title.trim(), date: f.date, end_date: nz(f.end_date),
      team: f.team || null, category: f.category, time_label: nz(f.time_label),
      location: nz(f.location), uniform: nz(f.uniform), poc: nz(f.poc),
      transportation: nz(f.transportation), description: nz(f.description),
      will_have_pictures: !!f.will_have_pictures, status: f.status,
    };
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
                              {teamLabel(r.team).toUpperCase()} · {r.category || 'EVENT'}{r.will_have_pictures ? ' · 📷' : ''}{r.location ? ` · ${r.location}` : ''}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Date <span style={{ color: P.red }}>*</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>End date (multi-day)</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
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
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={selectStyle}>
                  {CATEGORY_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Time</Label>
                <Input value={form.time_label} onChange={(e) => setForm((f) => ({ ...f, time_label: e.target.value }))} placeholder="e.g. 0800 · report 0730" />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[3], marginBottom: sp[3] }}>
              <div>
                <Label>Uniform</Label>
                <Input value={form.uniform} onChange={(e) => setForm((f) => ({ ...f, uniform: e.target.value }))} placeholder="ASU / ACU / PT / civilian" />
              </div>
              <div>
                <Label>POC</Label>
                <Input value={form.poc} onChange={(e) => setForm((f) => ({ ...f, poc: e.target.value }))} placeholder="name / role" />
              </div>
            </div>

            <div style={{ marginBottom: sp[3] }}>
              <Label>Transportation</Label>
              <Input value={form.transportation} onChange={(e) => setForm((f) => ({ ...f, transportation: e.target.value }))} placeholder="bus / POV · departure time" />
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
