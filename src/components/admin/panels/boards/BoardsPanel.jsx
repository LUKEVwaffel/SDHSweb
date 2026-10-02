import { useState } from 'react';
import ResultsExplorer from '../../../boards/results/ResultsExplorer';
import SaiConsole from '../../../boards/sai/SaiConsole';
import BoardAccountsTab from './BoardAccountsTab';
import '../../../boards/boards.css';

// DISPATCH → Promotion Boards (S-6). Results + export, quarter open/close,
// and board account / PIN provisioning. Rendered in the /boards visual
// language (.tb) so screenshots match what the boards and SAI see.
const TABS = [
  { id: 'results', label: 'Results & export' },
  { id: 'quarters', label: 'Quarters & companies' },
  { id: 'accounts', label: 'Board accounts' },
];

export default function BoardsPanel() {
  const [tab, setTab] = useState('results');
  return (
    <div className="tb tb--embed" style={{ padding: '8px 24px 32px' }}>
      <div className="tb-hero" style={{ paddingTop: 18 }}>
        <div>
          <div className="tb-eyebrow">DISPATCH · S-6</div>
          <h1 className="tb-h1">Promotion boards</h1>
          <p className="tb-sub">Company boards run at <b className="tb-mono">/boards</b>. Chief signs off there too. Everything is visible here.</p>
        </div>
        <a className="tb-btn" href="/boards" target="_blank" rel="noopener noreferrer">Open /boards ↗</a>
      </div>
      <div className="tb-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tb-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'results' && <ResultsExplorer />}
      {tab === 'quarters' && <div style={{ marginTop: -24 }}><SaiConsole readOnly /></div>}
      {tab === 'accounts' && <BoardAccountsTab />}
    </div>
  );
}
