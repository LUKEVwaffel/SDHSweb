import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIES, PROMOTABLE, MAX_TOTAL } from '../../lib/boardRules';
import { fmtTime } from './ui';
import { isSandbox } from './boardApi';

// Official paper layout for one or many board sheets. Rows come from the
// board_results view (final decision + every signature joined in). Hidden on
// screen; @media print in boards.css shows only this.

function Sig({ label, name, at, pending = 'Not signed' }) {
  return (
    <div className="tb-print-sig">
      <span>{label}</span>
      <div>{name ? <>{name}<small>DIGITALLY SIGNED {fmtTime(at).toUpperCase()}</small></> : <small>{pending}</small>}</div>
    </div>
  );
}

function Sheet({ r }) {
  const decision = r.final_decision;
  const promoteTo = r.final_promote_to;
  const overturned = r.sai_decision && r.sai_decision !== r.decision;
  return (
    <article className="tb-print-sheet">
      <header className="tb-print-head">
        <img src="/assets/trojan-helmet.png" alt="" />
        <div>
          <h1>TROJAN BATTALION</h1>
          <p>ARMY JROTC</p>
        </div>
        <img src="/assets/army-jrotc.png" alt="" />
      </header>
      <div className="tb-print-title">Boards</div>

      <div className="tb-print-fields">
        <div><small>Cadet name (first and last)</small>{r.cadet_name}</div>
        <div><small>Rank</small>{r.rank_before || '—'}</div>
        <div><small>LET</small>{r.let_level || '—'}</div>
        <div><small>Date</small>{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}</div>
      </div>

      <table className="tb-print-table">
        <thead><tr><th>Category</th><th>Points</th></tr></thead>
        <tbody>
          {CATEGORIES.map((c) => (
            <tr key={c.key}>
              <td>{c.label}{c.key === 'score_facing' && <><br />(Left, Right, About)</>}</td>
              <td>{decision === 'absent' ? '—' : (r[c.key] ?? '—')} / 3</td>
            </tr>
          ))}
          <tr className="tb-print-total"><td>Total Points</td><td>{decision === 'absent' ? '—' : r.total} / {MAX_TOTAL}</td></tr>
        </tbody>
      </table>

      {decision === 'absent' ? (
        <p className="tb-print-ranks"><b>ABSENT</b> — cadet was not present for boards.</p>
      ) : (
        <>
          <div className="tb-print-decision">
            <span className={decision === 'promote' ? 'is-on' : ''}>Promote</span>
            <span className={decision === 'no_promote' ? 'is-on' : ''}>Do not promote</span>
          </div>
          <div className="tb-print-ranks">
            <b>Promote to:</b>
            {PROMOTABLE.map((code) => <span key={code} className={promoteTo === code ? 'is-on' : ''}>{code}</span>)}
          </div>
        </>
      )}

      <div className="tb-print-max">
        <b>MAX RANKS</b>
        LET 1 - Corporal (CPL) &nbsp;&nbsp; LET 2 - Staff Sergeant (SSG)<br />
        LET 3 - Sergeant First Class (SFC) &nbsp;&nbsp; LET 4 - Master Sergeant (MSG)
      </div>

      {(r.comment || overturned) && (
        <div className="tb-print-comment">
          {r.comment && <><b>Board comment:</b> {r.comment}</>}
          {overturned && <>{r.comment && <br />}<b>SAI overturned</b> board decision ({r.decision === 'promote' ? `Promote to ${r.promote_to}` : 'Do not promote'}){r.sai_note ? `: ${r.sai_note}` : ''}</>}
        </div>
      )}

      <Sig label="1SG Signature:" name={r.sig_1sg_name} at={r.sig_1sg_at} />
      <Sig label="XO Signature:" name={r.sig_xo_name} at={r.sig_xo_at} />
      <Sig label="CMMDR:" name={r.sig_co_name} at={r.sig_co_at} />
      <Sig label="SAI Signature:" name={r.sai_signed_name} at={r.sai_signed_at} pending="Awaiting SAI review" />

      <footer className="tb-print-foot">
        <span>{r.quarter_label} · {String(r.company || '').toUpperCase()} COMPANY</span>
        {isSandbox && <span><b>SANDBOX — NOT AN OFFICIAL RECORD</b></span>}
        <span>{r.seal ? `SEAL ${r.seal.slice(0, 16).toUpperCase()}` : 'UNSEALED DRAFT'}</span>
      </footer>
    </article>
  );
}

/** Returns [portalNode, print(rows)]. Renders sheets, prints, then clears. */
export function usePrintSheets() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!rows) return undefined;
    document.body.classList.add('tb-printing');
    const done = () => setRows(null);
    window.addEventListener('afterprint', done);
    // Let images (crest) load before the print dialog snapshots the page.
    const t = setTimeout(() => window.print(), 350);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('tb-printing');
    };
  }, [rows]);

  const node = rows
    ? createPortal(<div className="tb-print-root">{rows.map((r) => <Sheet key={r.id} r={r} />)}</div>, document.body)
    : null;
  return [node, (list) => setRows(list?.length ? list : null)];
}
