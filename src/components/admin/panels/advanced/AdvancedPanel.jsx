import { useState } from 'react';
import { P, mono } from '../../theme';
import HistoryPanel from './HistoryPanel';
import HealthPanel from './HealthPanel';
import RegistryPanel from './RegistryPanel';
import DesignTokensPanel from './DesignTokensPanel';
import QuickActionsPanel from './QuickActionsPanel';
import SettingsPanel from './SettingsPanel';

// Wall for developer + maintenance tools. A non-technical successor rarely opens
// this; daily work lives in the top-level sections.
const SUBTABS = [
  { id: 'history',  label: 'CHANGE HISTORY', danger: false },
  { id: 'health',   label: 'SITE HEALTH',    danger: false },
  { id: 'settings', label: 'SETTINGS',       danger: false },
  { id: 'registry', label: 'REGISTRIES',     danger: true },
  { id: 'tokens',   label: 'DESIGN TOKENS',  danger: false },
  { id: 'actions',  label: 'QUICK ACTIONS',  danger: true },
];

export default function AdvancedPanel({ adminId }) {
  const [tab, setTab] = useState('history');

  return (
    <div>
      <div style={{ background: 'rgba(192,57,43,0.12)', border: `1px solid ${P.red}`, padding: '8px 12px', marginBottom: 12 }}>
        <span style={{ fontFamily: mono, fontSize: 9, color: P.red, letterSpacing: '0.15em' }}>
          ⚠ ADVANCED · developer &amp; maintenance tools — some actions permanently change or delete data
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? P.navy : 'transparent',
            border: `1px solid ${tab === t.id ? P.gold : P.hair}`,
            color: tab === t.id ? P.cream : (t.danger ? P.red : P.mute),
            cursor: 'pointer', fontFamily: mono, fontSize: 9, letterSpacing: '0.1em',
            padding: '7px 10px',
          }}>{t.danger ? '⚠ ' : ''}{t.label}</button>
        ))}
      </div>
      {tab === 'history'  && <HistoryPanel adminId={adminId} />}
      {tab === 'health'   && <HealthPanel />}
      {tab === 'settings' && <SettingsPanel adminId={adminId} />}
      {tab === 'registry' && <RegistryPanel />}
      {tab === 'tokens'   && <DesignTokensPanel />}
      {tab === 'actions'  && <QuickActionsPanel adminId={adminId} />}
    </div>
  );
}
