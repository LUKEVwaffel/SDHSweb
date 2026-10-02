import { useEffect, useState } from 'react';
import { boardApi } from '../boardApi';
import { usePrintSheets } from '../PrintSheets';
import { SheetChip, fmtTime } from '../ui';
import { MAX_TOTAL } from '../../../lib/boardRules';

// Sealed sessions for this company + reprintable sheets.
export default function ArchiveTab({ quarterId, sessions }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [printNode, print] = usePrintSheets();

  useEffect(() => {
    if (!quarterId) return;
    boardApi.results(quarterId).then((r) => setRows(r.filter((x) => x.locked))).catch((e) => setError(e.message));
  }, [quarterId, sessions]);

  const sealed = sessions.filter((s) => s.status === 'signed');
  if (!quarterId) return <div className="tb-empty"><b>No quarter open</b></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <div className="tb-banner tb-banner--error">{error}</div>}
      {sealed.length === 0 && <div className="tb-empty"><b>Nothing sealed yet</b>Sheets appear here once the CMMDR signs.</div>}
      {sealed.map((s) => {
        const list = rows.filter((r) => r.session_id === s.id);
        return (
          <section key={s.id} className="tb-card tb-card--flat">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div className="tb-eyebrow">Sealed {fmtTime(s.signed_at)}</div>
                <div className="tb-qrow-meta" style={{ marginTop: 6 }}>SEAL {s.seal?.slice(0, 24).toUpperCase()}</div>
              </div>
              <button type="button" className="tb-btn tb-btn--sm" onClick={() => print(list)} disabled={!list.length}>Print all {list.length}</button>
            </div>
            <div className="tb-queue" style={{ marginTop: 14 }}>
              {list.map((r) => (
                <div key={r.id} className="tb-qrow" style={{ cursor: 'default', gridTemplateColumns: 'minmax(0,1fr) auto auto auto' }}>
                  <div className="tb-qrow-name">{r.cadet_name}</div>
                  <div className="tb-qrow-score">{r.decision === 'absent' ? '' : <>{r.total}<small>/{MAX_TOTAL}</small></>}</div>
                  <SheetChip sheet={r} />
                  <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => print([r])}>Print</button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {printNode}
    </div>
  );
}
