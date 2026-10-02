import { useCallback, useEffect, useState } from 'react';
import { boardApi } from '../boardApi';
import { COMPANY_LABEL, Modal, ProgressRing, useToast } from '../ui';
import { COMPANIES, quarterLabel } from '../../../lib/boardRules';
import ResultsExplorer from '../results/ResultsExplorer';
import SaiCompanyReview from './SaiCompanyReview';

// SAI home: one card per company for the open quarter, quarter controls,
// and the battalion-wide results explorer. `readOnly` (DISPATCH S-6 view)
// keeps quarter controls but hides overturn / sign-off, which are SAI-only.
export default function SaiConsole({ canManageQuarters = true, readOnly = false }) {
  const [tab, setTab] = useState('companies');
  const [data, setData] = useState({ loading: true, error: '', quarter: null, rows: [], rosters: {}, signoffs: [] });
  const [open, setOpen] = useState(null);
  const [quarterModal, setQuarterModal] = useState(false);
  const [label, setLabel] = useState(quarterLabel());
  const [busy, setBusy] = useState(false);
  const [toastNode, toast] = useToast();

  const load = useCallback(async () => {
    try {
      const quarters = await boardApi.quarters();
      const quarter = quarters.find((q) => q.status === 'open') ?? null;
      const rosterList = await Promise.all(COMPANIES.map((c) => boardApi.roster(c)));
      const rosters = Object.fromEntries(COMPANIES.map((c, i) => [c, rosterList[i].filter((x) => !x.is_board_seat)]));
      const [rows, signoffs] = quarter ? await Promise.all([boardApi.results(quarter.id), boardApi.signoffs(quarter.id)]) : [[], []];
      setData({ loading: false, error: '', quarter, rows, rosters, signoffs });
    } catch (err) {
      setData((d) => ({ ...d, loading: false, error: err.message }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openQuarter() {
    setBusy(true);
    try {
      await boardApi.openQuarter(label);
      setQuarterModal(false);
      toast(`${label} is open`);
      await load();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function closeQuarter() {
    if (!window.confirm(`Close ${data.quarter.label}? Companies won't be able to board until a new quarter opens.`)) return;
    try {
      await boardApi.closeQuarter(data.quarter.id);
      toast('Quarter closed');
      await load();
    } catch (err) {
      toast(err.message);
    }
  }

  const { quarter, rows, rosters, signoffs } = data;

  function companyStats(c) {
    const r = rows.filter((x) => x.company === c);
    const real = r.filter((x) => x.decision !== 'absent' && x.status === 'complete');
    const boardedIds = new Set(real.map((x) => x.cadet_id));
    const roster = rosters[c] ?? [];
    return {
      rows: r,
      roster,
      boarded: boardedIds.size,
      promote: real.filter((x) => x.final_decision === 'promote').length,
      unsigned: r.filter((x) => !x.locked).length,
      notBoarded: roster.filter((x) => !boardedIds.has(x.id)),
      signoff: signoffs.find((s) => s.company === c) ?? null,
    };
  }

  if (data.loading) return <div className="tb-shell"><p className="tb-sub" style={{ padding: 40 }}><span className="tb-spin" /> Loading boards…</p></div>;

  if (open && quarter) {
    const s = companyStats(open);
    return (
      <div className="tb-shell" style={{ paddingTop: 24 }}>
        <SaiCompanyReview
          company={open} quarter={quarter} rows={s.rows} notBoarded={s.notBoarded} signoff={s.signoff} readOnly={readOnly}
          onBack={() => setOpen(null)} onChanged={load} toast={toast}
        />
        {toastNode}
      </div>
    );
  }

  return (
    <div className="tb-shell">
      <div className="tb-hero">
        <div>
          <div className="tb-eyebrow">{readOnly ? 'Quarter control' : 'Senior Army Instructor'}</div>
          <h1 className="tb-h1">{quarter ? quarter.label : 'Promotion Boards'}</h1>
          <p className="tb-sub">{quarter ? (readOnly ? 'Live progress for every company. Overturns and sign-off belong to the SAI at /boards.' : 'Review each company, overturn anything you disagree with, then sign each company once.') : 'No board quarter is open. Open one when companies are ready to board.'}</p>
        </div>
        {canManageQuarters && (
          <div style={{ display: 'flex', gap: 8 }}>
            {quarter && <button type="button" className="tb-btn tb-btn--ghost" onClick={closeQuarter}>Close quarter</button>}
            <button type="button" className={`tb-btn ${quarter ? '' : 'tb-btn--gold'}`} onClick={() => setQuarterModal(true)}>{quarter ? 'Start new quarter' : 'Open boards'}</button>
          </div>
        )}
      </div>
      {data.error && <div className="tb-banner tb-banner--error" style={{ marginBottom: 16 }}>{data.error}</div>}

      <div className="tb-tabs" role="tablist">
        <button type="button" role="tab" className="tb-tab" aria-selected={tab === 'companies'} onClick={() => setTab('companies')}>Companies</button>
        <button type="button" role="tab" className="tb-tab" aria-selected={tab === 'results'} onClick={() => setTab('results')}>Results &amp; export</button>
      </div>

      {tab === 'companies' && (quarter ? (
        <div className="tb-grid tb-grid-4">
          {COMPANIES.map((c) => {
            const s = companyStats(c);
            const status = s.signoff ? 'Signed off' : s.unsigned ? `${s.unsigned} awaiting board signatures` : s.boarded ? 'Ready for your signature' : 'Not started';
            const chip = s.signoff ? 'tb-chip--signed' : s.unsigned ? 'tb-chip--draft' : s.boarded ? 'tb-chip--promote' : 'tb-chip--todo';
            return (
              <button key={c} type="button" className="tb-card tb-co-card" onClick={() => setOpen(c)}>
                <span className="tb-co-letter" aria-hidden="true">{c[0].toUpperCase()}</span>
                <div className="tb-co-row">
                  <div>
                    <div className="tb-eyebrow">{COMPANY_LABEL[c]}</div>
                    <div className="tb-h2" style={{ marginTop: 6 }}>{s.roster.length} cadets</div>
                  </div>
                  <ProgressRing value={s.boarded} max={s.roster.length} size={78} label="BOARDED" />
                </div>
                <div className="tb-bars" aria-hidden="true">
                  <span style={{ width: `${s.roster.length ? (s.promote / s.roster.length) * 100 : 0}%`, background: 'var(--green)' }} />
                  <span style={{ width: `${s.roster.length ? ((s.boarded - s.promote) / s.roster.length) * 100 : 0}%`, background: 'var(--red)' }} />
                </div>
                <div className="tb-qrow-meta">{s.promote} PROMOTE · {s.boarded - s.promote} HOLD · {s.notBoarded.length} NOT BOARDED</div>
                <div style={{ marginTop: 14 }}><span className={`tb-chip ${chip}`}>{status}</span></div>
              </button>
            );
          })}
        </div>
      ) : <div className="tb-empty"><b>Boards are closed</b>Open a quarter to let companies start boarding.</div>)}

      {tab === 'results' && <ResultsExplorer initialQuarterId={quarter?.id ?? null} />}

      {quarterModal && (
        <Modal label="Open quarter" onClose={() => setQuarterModal(false)}>
          <div className="tb-eyebrow">Board quarter</div>
          <h3 className="tb-h1" style={{ fontSize: 28 }}>{quarter ? 'Start a new quarter' : 'Open boards'}</h3>
          <p className="tb-sub" style={{ fontSize: 13.5, marginBottom: 14 }}>
            {quarter ? `This closes ${quarter.label}. ` : ''}Companies can board as soon as it opens. Every past quarter stays on record.
          </p>
          <label className="tb-field">
            <span className="tb-label">Label</span>
            <input className="tb-input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="tb-btn tb-btn--ghost" onClick={() => setQuarterModal(false)}>Cancel</button>
            <button type="button" className="tb-btn tb-btn--gold" disabled={busy || !label.trim()} onClick={openQuarter}>Open {label}</button>
          </div>
        </Modal>
      )}
      {toastNode}
    </div>
  );
}
