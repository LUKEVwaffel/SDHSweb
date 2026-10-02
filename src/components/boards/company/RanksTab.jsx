import { useState } from 'react';
import RankInsignia from '../RankInsignia';
import RankPicker from './RankPicker';
import { boardApi } from '../boardApi';
import { Modal } from '../ui';
import { normalizeLet, rankInfo } from '../../../lib/boardRules';

// Pre-board rank collection: commanders walk the roster and record each
// cadet's current rank so board day goes straight to scoring.
export default function RanksTab({ cadets, onChanged, toast }) {
  const [editing, setEditing] = useState(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [error, setError] = useState('');

  const missing = cadets.filter((c) => !c.cadet_rank).length;
  const rows = onlyMissing ? cadets.filter((c) => !c.cadet_rank) : cadets;

  async function pick(code) {
    const cadet = editing;
    setEditing(null);
    setError('');
    try {
      await boardApi.setRank(cadet.id, code);
      toast(`${cadet.name} → ${code}`);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="tb-toolbar" style={{ justifyContent: 'space-between' }}>
        <p className="tb-sub">
          {missing === 0
            ? 'Every cadet has a rank on file. You’re ready for boards.'
            : `${missing} cadet${missing === 1 ? '' : 's'} still need a rank. Get these before boards start.`}
        </p>
        <div className="tb-seg" role="group" aria-label="Show">
          <button type="button" aria-pressed={onlyMissing} onClick={() => setOnlyMissing(true)}>Missing · {missing}</button>
          <button type="button" aria-pressed={!onlyMissing} onClick={() => setOnlyMissing(false)}>All · {cadets.length}</button>
        </div>
      </div>
      {error && <div className="tb-banner tb-banner--error" style={{ marginBottom: 12 }}>{error}</div>}

      {rows.length === 0 ? (
        <div className="tb-empty"><b>All ranks recorded</b>Switch to “All” to change one.</div>
      ) : (
        <div className="tb-queue">
          {rows.map((c) => (
            <button key={c.id} type="button" className="tb-qrow" style={{ gridTemplateColumns: '48px minmax(0,1fr) auto' }} onClick={() => setEditing(c)}>
              <RankInsignia rank={c.cadet_rank} size={34} />
              <div style={{ minWidth: 0 }}>
                <div className="tb-qrow-name">{c.name}</div>
                <div className="tb-qrow-meta">LET {normalizeLet(c.let_level) ?? '?'} · {c.cadet_rank ? rankInfo(c.cadet_rank)?.name : 'No rank on file'}</div>
              </div>
              <span className={`tb-chip ${c.cadet_rank ? 'tb-chip--done' : 'tb-chip--draft'}`}>{c.cadet_rank ?? 'Set rank'}</span>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <Modal wide label="Set rank" onClose={() => setEditing(null)}>
          <div className="tb-eyebrow">Set rank</div>
          <h3 className="tb-h1" style={{ fontSize: 30 }}>{editing.name}</h3>
          <p className="tb-sub" style={{ marginBottom: 16 }}>Pick the rank the cadet holds right now.</p>
          <RankPicker value={editing.cadet_rank} onPick={pick} />
        </Modal>
      )}
    </div>
  );
}
