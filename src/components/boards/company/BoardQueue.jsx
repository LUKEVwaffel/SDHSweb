import { useMemo, useState } from 'react';
import RankInsignia from '../RankInsignia';
import { SheetChip } from '../ui';
import { MAX_TOTAL, normalizeLet } from '../../../lib/boardRules';

// The company's to-board list. One row per cadet with their status this
// quarter; click a row to open (or resume) their sheet.

const FILTERS = [
  { id: 'todo', label: 'To board' },
  { id: 'draft', label: 'Drafts' },
  { id: 'done', label: 'Done' },
  { id: 'absent', label: 'Absent' },
  { id: 'all', label: 'All' },
];

export function cadetState(sheet) {
  if (!sheet) return 'todo';
  if (sheet.status === 'draft') return 'draft';
  if (sheet.decision === 'absent') return 'absent';
  return 'done';
}

export default function BoardQueue({ cadets, sheetFor, onOpen }) {
  const [filter, setFilter] = useState('todo');
  const [q, setQ] = useState('');
  const [letFilter, setLetFilter] = useState('all');

  const counts = useMemo(() => {
    const c = { todo: 0, draft: 0, done: 0, absent: 0, all: cadets.length };
    cadets.forEach((cadet) => { c[cadetState(sheetFor(cadet.id))] += 1; });
    // Absent cadets still need boarding, so they also count as "to board".
    c.todo += c.absent;
    return c;
  }, [cadets, sheetFor]);

  const rows = cadets.filter((cadet) => {
    const state = cadetState(sheetFor(cadet.id));
    if (filter === 'todo' && state !== 'todo' && state !== 'absent') return false;
    if (filter !== 'todo' && filter !== 'all' && state !== filter) return false;
    if (letFilter !== 'all' && String(normalizeLet(cadet.let_level)) !== letFilter) return false;
    return !q || cadet.name.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <div className="tb-toolbar">
        <input className="tb-input" placeholder="Search cadet…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cadets" />
        <div className="tb-seg" role="group" aria-label="Status filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} · {counts[f.id]}
            </button>
          ))}
        </div>
        <select className="tb-select" style={{ width: 'auto' }} value={letFilter} onChange={(e) => setLetFilter(e.target.value)} aria-label="LET filter">
          <option value="all">All LETs</option>
          {['1', '2', '3', '4'].map((l) => <option key={l} value={l}>LET {l}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="tb-empty">
          <b>{filter === 'todo' ? 'Everyone is boarded' : 'Nothing here'}</b>
          {filter === 'todo' ? 'Head to Sign & Seal when the board is finished.' : 'Try a different filter.'}
        </div>
      ) : (
        <div className="tb-queue">
          {rows.map((cadet) => {
            const sheet = sheetFor(cadet.id);
            const scored = sheet && sheet.decision !== 'absent' && sheet.status === 'complete';
            return (
              <button type="button" key={cadet.id} className="tb-qrow" onClick={() => onOpen(cadet)} disabled={sheet?.locked && sheet.decision !== 'absent'}>
                <RankInsignia rank={sheet?.rank_before ?? cadet.cadet_rank} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div className="tb-qrow-name">{cadet.name}</div>
                  <div className="tb-qrow-meta">
                    LET {normalizeLet(cadet.let_level) ?? '?'} · GR {cadet.grade ?? '?'} · {cadet.cadet_rank ?? 'RANK NOT ON FILE'}
                  </div>
                </div>
                <div className="tb-qrow-score">{scored ? <>{sheet.total}<small>/{MAX_TOTAL}</small></> : ''}</div>
                <SheetChip sheet={sheet} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
