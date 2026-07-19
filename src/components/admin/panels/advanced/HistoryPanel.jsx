import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter } from '../../theme';
import { Btn, Card, Input, PanelHeader } from '../../shared/ui';

export default function HistoryPanel({ adminId }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await SB.from('change_log').select('*').order('created_at', { ascending: false }).limit(200);
    setLogs(data || []);
  }

  async function revert(entry) {
    if (!entry.value_before || !confirm('Revert this change?')) return;
    if (entry.page === 'personnel') {
      await SB.from('personnel').upsert(entry.value_before);
    } else {
      await SB.from('page_content').upsert({ key: entry.element, value: entry.value_before.value });
    }
    await SB.from('change_log').insert({
      admin_id: adminId, page: entry.page, element: entry.element,
      label: `REVERT: ${entry.label}`, value_before: entry.value_after, value_after: entry.value_before,
      is_revert: true, revert_of: entry.id,
    });
    load();
  }

  const filtered = filter ? logs.filter(l => l.element?.includes(filter) || l.page?.includes(filter) || l.label?.includes(filter)) : logs;

  return (
    <div>
      <PanelHeader title="CHANGE LOG" action={<Btn onClick={load} variant="ghost" style={{ fontSize: 9 }}>REFRESH</Btn>} />
      <div style={{ marginBottom: 10 }}>
        <Input value={filter} onChange={e => setFilter(e.target.value)} style={{ fontSize: 11 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(entry => (
          <Card key={entry.id} style={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 10, color: entry.is_revert ? P.bright : P.gold }}>
                  {entry.is_revert ? '↩ REVERT' : '✎'} {entry.page?.toUpperCase()} · {entry.element}
                </div>
                <div style={{ fontFamily: inter, fontSize: 11, color: P.cream, marginTop: 2 }}>{entry.label}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 2 }}>
                  {new Date(entry.created_at).toLocaleString()} · {entry.admin_id}
                </div>
              </div>
              {!entry.is_revert && entry.value_before && (
                <Btn onClick={() => revert(entry)} variant="ghost" style={{ fontSize: 9 }}>REVERT</Btn>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
