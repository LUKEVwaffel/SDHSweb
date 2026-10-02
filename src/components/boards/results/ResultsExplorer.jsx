import { useEffect, useMemo, useState } from 'react';
import { boardApi } from '../boardApi';
import { usePrintSheets } from '../PrintSheets';
import { COMPANY_LABEL, SheetChip, Modal, fmtTime } from '../ui';
import { downloadCsv } from './csv';
import { CATEGORIES, MAX_TOTAL } from '../../../lib/boardRules';
import RankInsignia from '../RankInsignia';

// Filterable results across companies (SAI, S-1 viewers, S-6). The CSV and
// "print filtered" both export exactly what the filters show.

const EMPTY = { q: '', company: 'all', let: 'all', decision: 'all', signed: 'all', min: '', max: '', overturned: false, comments: false };

function applyFilters(rows, f) {
  const min = f.min === '' ? null : Number(f.min);
  const max = f.max === '' ? null : Number(f.max);
  return rows.filter((r) => {
    if (f.company !== 'all' && r.company !== f.company) return false;
    if (f.let !== 'all' && String(r.let_level) !== f.let) return false;
    if (f.decision !== 'all' && r.final_decision !== f.decision) return false;
    if (f.signed === 'sai' && !r.sai_signed_at) return false;
    if (f.signed === 'board' && !(r.locked && !r.sai_signed_at)) return false;
    if (f.signed === 'unsigned' && r.locked) return false;
    if (min !== null && (r.decision === 'absent' || r.total < min)) return false;
    if (max !== null && (r.decision === 'absent' || r.total > max)) return false;
    if (f.overturned && !r.sai_decision) return false;
    if (f.comments && !r.comment && !r.sai_note) return false;
    return !f.q || r.cadet_name.toLowerCase().includes(f.q.toLowerCase());
  });
}

const SORTS = {
  name: (r) => r.cadet_name.split(' ').slice(-1)[0].toLowerCase(),
  company: (r) => r.company,
  let: (r) => r.let_level ?? '',
  total: (r) => (r.decision === 'absent' ? -1 : r.total),
  decision: (r) => r.final_decision ?? '',
};

function Insights({ rows }) {
  const scored = rows.filter((r) => r.decision !== 'absent' && r.status === 'complete');
  const promoted = scored.filter((r) => r.final_decision === 'promote').length;
  const avg = scored.length ? scored.reduce((s, r) => s + r.total, 0) / scored.length : 0;
  const hist = Array.from({ length: MAX_TOTAL + 1 }, (_, n) => scored.filter((r) => r.total === n).length);
  const peak = Math.max(1, ...hist);
  return (
    <div className="tb-grid tb-insights">
      <div className="tb-card tb-card--flat" style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <div className="tb-stat"><b>{scored.length}</b><span>Boarded</span></div>
        <div className="tb-stat"><b style={{ color: 'var(--green)' }}>{scored.length ? Math.round((promoted / scored.length) * 100) : 0}%</b><span>Promoted</span></div>
        <div className="tb-stat"><b>{avg.toFixed(1)}</b><span>Avg / {MAX_TOTAL}</span></div>
      </div>
      <div className="tb-card tb-card--flat">
        <div className="tb-label" style={{ marginBottom: 10 }}>Category averages</div>
        {CATEGORIES.map((c) => {
          const a = scored.length ? scored.reduce((s, r) => s + (r[c.key] ?? 0), 0) / scored.length : 0;
          return (
            <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 34px', gap: 10, alignItems: 'center', margin: '6px 0', fontSize: 12.5 }}>
              <span style={{ color: 'var(--mute)' }}>{c.label}</span>
              <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${(a / 3) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--gold), var(--gold-hi))', transition: 'width 700ms var(--ease)' }} />
              </div>
              <span className="tb-mono" style={{ textAlign: 'right' }}>{a.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      <div className="tb-card tb-card--flat">
        <div className="tb-label" style={{ marginBottom: 10 }}>Score distribution</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 96 }} aria-label="Histogram of total scores">
          {hist.map((n, i) => (
            <div key={i} title={`${i}/${MAX_TOTAL}: ${n} cadet${n === 1 ? '' : 's'}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', height: `${(n / peak) * 80}px`, minHeight: n ? 3 : 1, borderRadius: 3, background: n ? (i >= 12 ? 'var(--green)' : i >= 10 ? 'var(--blue)' : 'var(--amber)') : 'rgba(255,255,255,0.06)', transition: 'height 700ms var(--ease)' }} />
              <span className="tb-mono" style={{ fontSize: 9, color: 'var(--faint)' }}>{i}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ResultsExplorer({ initialQuarterId = null }) {
  const [quarters, setQuarters] = useState([]);
  const [quarterId, setQuarterId] = useState(initialQuarterId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [f, setF] = useState(EMPTY);
  const [sort, setSort] = useState({ key: 'company', dir: 1 });
  const [detail, setDetail] = useState(null);
  const [printNode, print] = usePrintSheets();

  useEffect(() => {
    boardApi.quarters().then((qs) => {
      setQuarters(qs);
      setQuarterId((cur) => cur ?? qs.find((q) => q.status === 'open')?.id ?? qs[0]?.id ?? 'all');
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!quarterId) return;
    setLoading(true);
    boardApi.results(quarterId === 'all' ? null : quarterId)
      .then((r) => { setRows(r); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quarterId]);

  const filtered = useMemo(() => {
    const get = SORTS[sort.key];
    return applyFilters(rows, f).sort((a, b) => {
      const x = get(a); const y = get(b);
      return (x < y ? -1 : x > y ? 1 : a.cadet_name.localeCompare(b.cadet_name)) * sort.dir;
    });
  }, [rows, f, sort]);

  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const th = (key, label) => (
    <th onClick={() => sortBy(key)} aria-sort={sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      {label}{sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
    </th>
  );
  const quarterLabel = quarters.find((q) => q.id === quarterId)?.label ?? 'all-quarters';
  const active = JSON.stringify(f) !== JSON.stringify(EMPTY);

  return (
    <div>
      <div className="tb-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="tb-select" style={{ width: 'auto' }} value={quarterId ?? ''} onChange={(e) => setQuarterId(e.target.value)} aria-label="Quarter">
            {quarters.map((q) => <option key={q.id} value={q.id}>{q.label}{q.status === 'open' ? ' (open)' : ''}</option>)}
            <option value="all">All quarters</option>
          </select>
          <span className="tb-sub" style={{ fontSize: 13 }}>{filtered.length} of {rows.length} sheets</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {active && <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => setF(EMPTY)}>Clear filters</button>}
          <button type="button" className="tb-btn tb-btn--sm" disabled={!filtered.length} onClick={() => print(filtered.filter((r) => r.status === 'complete'))}>Print {filtered.length} sheets</button>
          <button type="button" className="tb-btn tb-btn--gold tb-btn--sm" disabled={!filtered.length} onClick={() => downloadCsv(filtered, `boards-${quarterLabel.replace(/\s+/g, '-')}${f.company !== 'all' ? `-${f.company}` : ''}.csv`)}>Export CSV</button>
        </div>
      </div>

      <div className="tb-filters">
        <input className="tb-input" placeholder="Search name…" value={f.q} onChange={set('q')} aria-label="Search name" />
        <select className="tb-select" value={f.company} onChange={set('company')} aria-label="Company">
          <option value="all">All companies</option>
          {Object.entries(COMPANY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="tb-select" value={f.let} onChange={set('let')} aria-label="LET">
          <option value="all">All LETs</option>
          {['1', '2', '3', '4'].map((l) => <option key={l} value={l}>LET {l}</option>)}
        </select>
        <select className="tb-select" value={f.decision} onChange={set('decision')} aria-label="Decision">
          <option value="all">Any decision</option>
          <option value="promote">Promote</option>
          <option value="no_promote">Do not promote</option>
          <option value="absent">Absent</option>
        </select>
        <select className="tb-select" value={f.signed} onChange={set('signed')} aria-label="Signature status">
          <option value="all">Any signature status</option>
          <option value="unsigned">Not yet signed</option>
          <option value="board">Board signed, SAI pending</option>
          <option value="sai">SAI signed</option>
        </select>
        <input className="tb-input" type="number" min="0" max={MAX_TOTAL} placeholder="Min score" value={f.min} onChange={set('min')} aria-label="Minimum score" />
        <input className="tb-input" type="number" min="0" max={MAX_TOTAL} placeholder="Max score" value={f.max} onChange={set('max')} aria-label="Maximum score" />
        <label className="tb-chip tb-chip--check"><input type="checkbox" checked={f.overturned} onChange={set('overturned')} /> SAI overturned</label>
        <label className="tb-chip tb-chip--check"><input type="checkbox" checked={f.comments} onChange={set('comments')} /> Has comment</label>
      </div>

      {error && <div className="tb-banner tb-banner--error" style={{ marginBottom: 12 }}>{error}</div>}
      {!loading && <Insights rows={filtered} />}

      {loading ? <p className="tb-sub"><span className="tb-spin" /> Loading results…</p> : filtered.length === 0 ? (
        <div className="tb-empty"><b>No sheets match</b>{rows.length ? 'Loosen the filters.' : 'Nothing has been boarded this quarter yet.'}</div>
      ) : (
        <div className="tb-table-wrap">
          <table className="tb-table">
            <thead>
              <tr>
                {th('name', 'Cadet')}{th('company', 'Co')}{th('let', 'LET')}
                <th>Rank</th>
                {CATEGORIES.map((c) => <th key={c.key} title={c.label}>{c.label.split(' ')[0]}</th>)}
                {th('total', 'Total')}{th('decision', 'Decision')}
                <th>Signed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setDetail(r)} style={{ cursor: 'pointer' }}>
                  <td><b>{r.cadet_name}</b>{r.comment && <span title="Has comment" style={{ color: 'var(--gold)', marginLeft: 6 }}>✎</span>}</td>
                  <td>{COMPANY_LABEL[r.company]}</td>
                  <td className="num">{r.let_level}</td>
                  <td className="tb-mono">{r.rank_before}{r.final_promote_to && <span style={{ color: 'var(--green)' }}> → {r.final_promote_to}</span>}</td>
                  {CATEGORIES.map((c) => <td key={c.key} className="num">{r.decision === 'absent' ? '—' : <span className="tb-pip" data-v={r[c.key]}>{r[c.key] ?? '·'}</span>}</td>)}
                  <td className="total">{r.decision === 'absent' ? '—' : r.total}</td>
                  <td><SheetChip sheet={r} />{r.sai_decision && <span className="tb-chip tb-chip--signed" style={{ marginLeft: 6 }}>SAI</span>}</td>
                  <td className="tb-mono" style={{ fontSize: 11, color: 'var(--mute)' }}>{r.sai_signed_at ? 'SAI ✓' : r.locked ? 'Board ✓' : 'Open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal wide label="Sheet detail" onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <RankInsignia rank={detail.final_promote_to ?? detail.rank_before} size={48} />
            <div>
              <div className="tb-eyebrow">{COMPANY_LABEL[detail.company]} · LET {detail.let_level} · {detail.quarter_label}</div>
              <h3 className="tb-h1" style={{ fontSize: 30, margin: '6px 0' }}>{detail.cadet_name}</h3>
            </div>
          </div>
          <div className="tb-table-wrap" style={{ margin: '16px 0' }}>
            <table className="tb-table">
              <tbody>
                {CATEGORIES.map((c) => <tr key={c.key}><td>{c.label}</td><td className="num"><span className="tb-pip" data-v={detail[c.key]}>{detail[c.key] ?? '—'}</span> / 3</td></tr>)}
                <tr><td><b>Total</b></td><td className="total">{detail.decision === 'absent' ? 'Absent' : `${detail.total} / ${MAX_TOTAL}`}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="tb-sub" style={{ fontSize: 14 }}>
            <b>Board:</b> {detail.decision === 'promote' ? `Promote ${detail.rank_before} → ${detail.promote_to}` : detail.decision === 'absent' ? 'Absent' : 'Do not promote'}
            {detail.sai_decision && <><br /><b>SAI overturned:</b> {detail.sai_decision === 'promote' ? `Promote → ${detail.sai_promote_to}` : 'Do not promote'}{detail.sai_note ? ` — ${detail.sai_note}` : ''}</>}
            {detail.comment && <><br /><b>Comment:</b> {detail.comment}</>}
          </p>
          <p className="tb-qrow-meta" style={{ lineHeight: 1.8 }}>
            1SG {detail.sig_1sg_name ?? '—'} {fmtTime(detail.sig_1sg_at)}<br />
            XO {detail.sig_xo_name ?? '—'} {fmtTime(detail.sig_xo_at)}<br />
            CMMDR {detail.sig_co_name ?? '—'} {fmtTime(detail.sig_co_at)}<br />
            SAI {detail.sai_signed_name ?? 'pending'} {fmtTime(detail.sai_signed_at)}<br />
            {detail.seal && <>SEAL {detail.seal.toUpperCase()}</>}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="tb-btn tb-btn--ghost" onClick={() => setDetail(null)}>Close</button>
            <button type="button" className="tb-btn tb-btn--gold" onClick={() => print([detail])}>Print sheet</button>
          </div>
        </Modal>
      )}
      {printNode}
    </div>
  );
}
