import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter } from '../theme';
import { Btn, Card, Label, Input, PanelHeader } from '../shared/ui';

// Upcoming-events manager (public Events page). Backed by `upcoming_events`.
export default function EventsPanel({ adminId }) {
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await SB.from('upcoming_events').select('*').order('sort_order');
    setEvents(data || []);
  }

  async function save() {
    if (form.id) {
      await SB.from('upcoming_events').update(form).eq('id', form.id);
    } else {
      await SB.from('upcoming_events').insert(form);
    }
    setEditing(null);
    load();
  }

  async function del(id) {
    if (!confirm('Delete event?')) return;
    await SB.from('upcoming_events').delete().eq('id', id);
    load();
  }

  const fields = [['date_label','Date Label'],['tag','Tag (e.g. COMPETITION)'],['title','Title'],['location','Location'],['time_label','Time Label'],['sort_order','Sort Order']];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <PanelHeader title="UPCOMING EVENTS" action={
          <Btn onClick={() => { setEditing('new'); setForm({ date_label:'', tag:'', title:'', location:'', time_label:'', sort_order: events.length, visible: true }); }}
            variant="gold" style={{ fontSize: 9 }}>+ NEW</Btn>
        }/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {events.map(ev => (
            <Card key={ev.id} style={{ padding: '8px 10px', border: `1px solid ${editing===ev.id?P.gold:P.hair}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: P.gold }}>{ev.date_label} · {ev.tag}</div>
                  <div style={{ fontFamily: inter, fontSize: 12, color: P.cream }}>{ev.title}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{ev.location}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn onClick={() => { setEditing(ev.id); setForm({...ev}); }} variant="ghost" style={{ fontSize: 9 }}>EDIT</Btn>
                  <Btn onClick={() => del(ev.id)} variant="danger" style={{ fontSize: 9 }}>DEL</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      {editing && (
        <div>
          <PanelHeader title={editing==='new'?'NEW EVENT':'EDIT EVENT'} action={
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn onClick={() => setEditing(null)} variant="ghost" style={{ fontSize: 9 }}>CANCEL</Btn>
              <Btn onClick={save} variant="gold" style={{ fontSize: 9 }}>SAVE</Btn>
            </div>
          }/>
          <Card>
            {fields.map(([k, l]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <Label>{l}</Label>
                <Input value={form[k]||''} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
            <Label>VISIBLE</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[true, false].map(v => <Btn key={String(v)} variant={form.visible===v?'gold':'ghost'} onClick={() => setForm(f=>({...f,visible:v}))} style={{ fontSize: 9 }}>{v?'YES':'NO'}</Btn>)}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
