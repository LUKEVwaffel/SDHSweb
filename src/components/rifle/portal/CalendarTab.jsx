import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';
import { SectionLabel, Card, PrimaryBtn, DangerBtn, EmptyState } from './ui';

// Rifle calendar CRUD — feeds the public /rifle page's EventCalendar, which
// was a static placeholder with no data source until rifle_calendar.sql.
// Same RLS gate as everywhere else in the portal (is_rifle_admin() or
// is_s6()), logged to rifle_audit_log same as scores/matches/roster.
const TYPE_LABEL = { competition: 'Competition', practice: 'Practice', qualifier: 'Qualifier', other: 'Other' };
const TYPE_COLOR = { competition: P.gold, practice: '#4A9EFF', qualifier: P.win, other: P.mute };

const label = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em' };
const inputStyle = { background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '9px 11px', outline: 'none' };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showPast, setShowPast] = useState(false);
  const [form, setForm] = useState({ event_date: '', title: '', event_type: 'practice', location: '', notes: '' });

  const load = useCallback(async () => {
    setErr('');
    const { data, error } = await SB.from('rifle_calendar_events').select('*').order('event_date');
    if (error) { setErr(error.message); setLoading(false); return; }
    setEvents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg) {
    setOk(msg);
    setTimeout(() => setOk(''), 2000);
  }

  async function addEvent() {
    if (!form.event_date || !form.title.trim()) { setErr('Date and title are required.'); return; }
    setErr('');
    const { error } = await SB.from('rifle_calendar_events').insert({
      event_date: form.event_date, title: form.title.trim(), event_type: form.event_type,
      location: form.location.trim() || null, notes: form.notes.trim() || null,
    });
    if (error) { setErr(error.message); return; }
    setForm({ event_date: '', title: '', event_type: 'practice', location: '', notes: '' });
    await load();
    flash('Event added');
  }

  async function updateField(ev, field, raw) {
    const value = raw.trim ? raw.trim() || null : raw;
    if (value === (ev[field] ?? null)) return;
    setErr('');
    const { error } = await SB.from('rifle_calendar_events').update({ [field]: value }).eq('id', ev.id);
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function deleteEvent(ev) {
    if (!confirm(`Delete "${ev.title}" (${ev.event_date})?`)) return;
    setErr('');
    const { error } = await SB.from('rifle_calendar_events').delete().eq('id', ev.id);
    if (error) { setErr(error.message); return; }
    await load();
    flash('Event deleted');
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayStr();
    return events
      .filter((e) => showPast || e.event_date >= today)
      .filter((e) => typeFilter === 'All' || e.event_type === typeFilter)
      .filter((e) => !q || [e.title, e.location, e.notes].some((v) => (v || '').toLowerCase().includes(q)));
  }, [events, search, typeFilter, showPast]);

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading calendar…</div>;

  return (
    <div>
      <SectionLabel tag="// SCHEDULE · CALENDAR" title="Events" sub="Matches, practices, and qualifiers — shows live on the public /rifle page's Event Calendar." />

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}
      {ok && <div style={{ fontFamily: mono, fontSize: 12, color: P.win, marginBottom: 14 }}>{ok}</div>}

      <Card style={{ marginBottom: 24 }}>
        <div style={{ ...label, marginBottom: 10 }}>ADD AN EVENT</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ ...label, fontSize: 10, marginBottom: 4 }}>DATE</div>
            <input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={{ ...label, fontSize: 10, marginBottom: 4 }}>TITLE</div>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. vs Eastmark NJROTC" style={{ ...inputStyle, minWidth: 200 }} />
          </div>
          <div>
            <div style={{ ...label, fontSize: 10, marginBottom: 4 }}>TYPE</div>
            <select value={form.event_type} onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))} style={inputStyle}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <div style={{ ...label, fontSize: 10, marginBottom: 4 }}>LOCATION</div>
            <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} style={inputStyle} />
          </div>
          <PrimaryBtn onClick={addEvent}>ADD</PrimaryBtn>
        </div>
        <div style={{ marginTop: 10 }}>
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>SEARCH</div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="title, location, notes…" style={{ ...inputStyle, minWidth: 220 }} />
        </div>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>TYPE</div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
            <option value="All">All</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 12, color: P.mute, cursor: 'pointer', paddingBottom: 9 }}>
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Show past events
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState>No events match.</EmptyState>
      ) : visible.map((ev) => (
        <div key={ev.id} style={{ border: `1px solid ${P.hair}`, borderLeft: `3px solid ${TYPE_COLOR[ev.event_type] || P.mute}`, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', flex: 1 }}>
            <input type="date" defaultValue={ev.event_date} onBlur={(e) => updateField(ev, 'event_date', e.target.value)} style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} />
            <input defaultValue={ev.title} onBlur={(e) => updateField(ev, 'title', e.target.value)} style={{ ...inputStyle, padding: '6px 8px', fontSize: 12, minWidth: 180 }} />
            <select defaultValue={ev.event_type} onChange={(e) => updateField(ev, 'event_type', e.target.value)} style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input defaultValue={ev.location || ''} onBlur={(e) => updateField(ev, 'location', e.target.value)} placeholder="location" style={{ ...inputStyle, padding: '6px 8px', fontSize: 12, minWidth: 140 }} />
          </div>
          <DangerBtn onClick={() => deleteEvent(ev)}>DELETE</DangerBtn>
        </div>
      ))}
    </div>
  );
}
