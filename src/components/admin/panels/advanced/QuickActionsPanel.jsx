import { useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono } from '../../theme';
import { Btn, Card, Label, PanelHeader } from '../../shared/ui';

// Danger + maintenance actions. Deliberately walled in ADVANCED.
export default function QuickActionsPanel({ adminId }) {
  const [log, setLog] = useState([]);

  function addLog(msg) { setLog(l => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l.slice(0, 19)]); }

  function download(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  const actions = [
    { label: 'CLEAR STYLE CACHE', icon: '⊘', fn: async () => {
      const { error } = await SB.from('element_styles').delete().neq('element_id', '__never__');
      addLog(error ? `ERROR: ${error.message}` : 'Style cache cleared');
    }},
    { label: 'EXPORT CONTENT JSON', icon: '↓', fn: async () => {
      const { data } = await SB.from('page_content').select('*');
      download('page_content.json', data);
      addLog('Exported page_content.json');
    }},
    { label: 'EXPORT PERSONNEL JSON', icon: '↓', fn: async () => {
      const { data } = await SB.from('personnel').select('*');
      download('personnel.json', data);
      addLog('Exported personnel.json');
    }},
    { label: 'EXPORT CHANGE LOG JSON', icon: '↓', fn: async () => {
      const { data } = await SB.from('change_log').select('*').order('created_at', { ascending: false });
      download('change_log.json', data);
      addLog('Exported change_log.json');
    }},
    { label: 'COUNT PERSONNEL', icon: '#', fn: async () => {
      const { count } = await SB.from('personnel').select('*', { count: 'exact', head: true });
      addLog(`Personnel count: ${count}`);
    }},
    { label: 'RELOAD REGISTRY', icon: '↺', fn: async () => {
      const { count } = await SB.from('dispatch_registry').select('*', { count: 'exact', head: true });
      addLog(`Registry loaded: ${count} elements`);
    }},
    { label: 'COUNT PHOTOS', icon: '⊞', fn: async () => {
      const { count } = await SB.from('photos').select('*', { count: 'exact', head: true });
      addLog(`Photos: ${count}`);
    }},
    { label: 'CLEAR OLD LOGS (30d)', icon: '⊗', fn: async () => {
      if (!confirm('Delete change-log entries older than 30 days? This cannot be undone.')) return;
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { error } = await SB.from('change_log').delete().lt('created_at', cutoff);
      addLog(error ? `ERROR: ${error.message}` : 'Old logs cleared');
    }},
  ];

  return (
    <div>
      <PanelHeader title="QUICK ACTIONS" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {actions.map(a => (
          <Btn key={a.label} onClick={a.fn} variant="ghost" style={{ textAlign: 'left', padding: '10px 12px', fontSize: 9 }}>
            <span style={{ color: P.gold, marginRight: 6 }}>{a.icon}</span>{a.label}
          </Btn>
        ))}
      </div>
      <Card>
        <Label>ACTION LOG</Label>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, lineHeight: 1.8, maxHeight: 160, overflowY: 'auto' }}>
          {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <div>No actions run yet.</div>}
        </div>
      </Card>
    </div>
  );
}
