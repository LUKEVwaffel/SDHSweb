import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, oswald, inter } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader } from '../../shared/ui';

// Read-mostly registries: element registry, page registry, widget library.
// Combined under one ADVANCED panel with sub-tabs.

function ElementRegistry() {
  const [registry, setRegistry] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    SB.from('dispatch_registry').select('*').order('page').then(({ data }) => setRegistry(data || []));
  }, []);

  const filtered = filter
    ? registry.filter(r => r.element_id.includes(filter) || r.page.includes(filter) || r.content_type.includes(filter) || r.field_name.includes(filter))
    : registry;

  const byPage = filtered.reduce((acc, r) => {
    (acc[r.page] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Input value={filter} onChange={e => setFilter(e.target.value)} style={{ fontSize: 11 }} />
      </div>
      {Object.entries(byPage).map(([page, items]) => (
        <div key={page} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 6 }}>{page.toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {items.map(r => (
              <Card key={r.element_id} style={{ padding: '5px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: P.cream }}>{r.element_id}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: P.gold }}>{r.content_type}</span>
                    <span style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{r.field_name}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PageRegistry() {
  const [pages, setPages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await SB.from('dispatch_pages').select('*').order('sort_order');
    setPages(data || []);
  }

  async function save() {
    await SB.from('dispatch_pages').upsert(form);
    setEditing(null);
    load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pages.map(p => (
        <Card key={p.id} style={{ padding: '8px 12px' }}>
          {editing === p.id ? (
            <div>
              {[['label','Label'],['short_label','Short Label'],['description','Description']].map(([k,l]) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <Label>{l}</Label>
                  <Input value={form[k]||''} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <Btn onClick={() => setEditing(null)} variant="ghost" style={{ fontSize: 9 }}>CANCEL</Btn>
                <Btn onClick={save} variant="gold" style={{ fontSize: 9 }}>SAVE</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: mono, fontSize: 10, color: P.gold }}>{p.id}</span>
                <span style={{ fontFamily: inter, fontSize: 11, color: P.cream, marginLeft: 10 }}>{p.label}</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: p.visible ? P.green : P.mute, marginLeft: 10 }}>{p.visible ? 'LIVE' : 'HIDDEN'}</span>
              </div>
              <Btn onClick={() => { setEditing(p.id); setForm({...p}); }} variant="ghost" style={{ fontSize: 9 }}>EDIT</Btn>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function WidgetLibrary() {
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    SB.from('dispatch_widgets').select('*').order('sort_order').then(({ data }) => setWidgets(data || []));
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {widgets.map(w => (
        <Card key={w.id} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>{w.preview_icon}</div>
          <div style={{ fontFamily: oswald, fontSize: 11, color: P.cream, letterSpacing: '0.1em' }}>{w.name}</div>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 4 }}>{w.category}</div>
          <div style={{ fontFamily: inter, fontSize: 10, color: P.mute, marginTop: 4 }}>{w.description}</div>
        </Card>
      ))}
      {!widgets.length && (
        <div style={{ gridColumn: '1/-1', fontFamily: mono, fontSize: 10, color: P.mute, textAlign: 'center', marginTop: 20 }}>NO WIDGETS</div>
      )}
    </div>
  );
}

export default function RegistryPanel() {
  const [tab, setTab] = useState('ELEMENTS');
  return (
    <div>
      <PanelHeader title="REGISTRIES" action={
        <div style={{ display: 'flex', gap: 4 }}>
          {['ELEMENTS','PAGES','WIDGETS'].map(t => (
            <Btn key={t} variant={tab===t?'gold':'ghost'} onClick={() => setTab(t)} style={{ fontSize: 9 }}>{t}</Btn>
          ))}
        </div>
      }/>
      {tab === 'ELEMENTS' && <ElementRegistry />}
      {tab === 'PAGES' && <PageRegistry />}
      {tab === 'WIDGETS' && <WidgetLibrary />}
    </div>
  );
}
