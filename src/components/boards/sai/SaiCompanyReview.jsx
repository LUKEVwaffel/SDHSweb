import { useState } from 'react';
import { boardApi, pinErrorText } from '../boardApi';
import { usePrintSheets } from '../PrintSheets';
import { COMPANY_LABEL, Modal, PinPad, SheetChip, fmtTime } from '../ui';
import { CATEGORIES, MAX_TOTAL, promotionOptions } from '../../../lib/boardRules';
import RankInsignia from '../RankInsignia';

// SAI review of one company: every sheet, overturn any single decision, then
// one PIN signature for the whole company.
export default function SaiCompanyReview({ company, quarter, rows, notBoarded, signoff, onBack, onChanged, toast, readOnly = false }) {
  const [overturn, setOverturn] = useState(null);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [printNode, print] = usePrintSheets();

  const unsigned = rows.filter((r) => !r.locked);
  const signedRows = rows.filter((r) => r.locked);
  const promotions = signedRows.filter((r) => r.final_decision === 'promote');
  const canSign = !readOnly && !signoff && unsigned.length === 0 && signedRows.length > 0;

  async function saveOverturn(decision, promoteTo, overturnNote) {
    setBusy(true);
    setError('');
    try {
      await boardApi.saiReview(overturn.id, decision, promoteTo, overturnNote);
      setOverturn(null);
      toast(decision ? 'Decision overturned' : 'Overturn removed');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sign(pin) {
    setBusy(true);
    setError('');
    try {
      const res = await boardApi.saiSignoff(quarter.id, company, pin, note);
      setSigning(false);
      toast(`${COMPANY_LABEL[company]} signed — ${res.signoff.promotions_applied} promotions applied`);
      onChanged();
    } catch (err) {
      setError(pinErrorText(err));
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="tb-toolbar" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="tb-btn tb-btn--ghost" onClick={onBack}>← All companies</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="tb-btn tb-btn--sm" disabled={!signedRows.length} onClick={() => print(signedRows)}>Print all {signedRows.length}</button>
          {!signoff && !readOnly && <button type="button" className="tb-btn tb-btn--gold" disabled={!canSign} onClick={() => { setError(''); setSigning(true); }}>Sign off {COMPANY_LABEL[company]}</button>}
        </div>
      </div>

      <div className="tb-hero" style={{ paddingTop: 10 }}>
        <div>
          <div className="tb-eyebrow">{quarter.label} · SAI review</div>
          <h1 className="tb-h1">{COMPANY_LABEL[company]} Company</h1>
          <p className="tb-sub">
            {signoff
              ? `You signed this company ${fmtTime(signoff.signed_at)}. ${signoff.promotions_applied} promotions were applied to the roster.`
              : unsigned.length
                ? `${unsigned.length} sheet${unsigned.length === 1 ? ' is' : 's are'} still waiting on the company board's signatures.`
                : `${promotions.length} promotion${promotions.length === 1 ? '' : 's'} pending your signature. Overturn any single decision first if needed.`}
          </p>
        </div>
        {signoff && (
          <div className="tb-seal" aria-label="Signed off">
            <span>SAI</span><b>APPROVED</b><span>{new Date(signoff.signed_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {notBoarded.length > 0 && !signoff && (
        <div className="tb-banner" style={{ marginBottom: 16 }}>
          <span>⚠</span>
          <span><b>{notBoarded.length} cadet{notBoarded.length === 1 ? '' : 's'} not boarded:</b> {notBoarded.map((c) => c.name).join(', ')}. You can still sign — they&rsquo;ll show as not boarded this quarter.</span>
        </div>
      )}
      {error && !signing && !overturn && <div className="tb-banner tb-banner--error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="tb-table-wrap">
        <table className="tb-table">
          <thead>
            <tr>
              <th>Cadet</th><th>LET</th><th>Rank</th>
              {CATEGORIES.map((c) => <th key={c.key} title={c.label}>{c.label.split(' ')[0]}</th>)}
              <th>Total</th><th>Board</th><th>Final</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.cadet_name}</b>{r.comment && <div className="tb-qrow-meta" style={{ whiteSpace: 'normal', maxWidth: 280 }}>“{r.comment}”</div>}</td>
                <td className="num">{r.let_level}</td>
                <td className="tb-mono">{r.rank_before}</td>
                {CATEGORIES.map((c) => <td key={c.key} className="num">{r.decision === 'absent' ? '—' : <span className="tb-pip" data-v={r[c.key]}>{r[c.key]}</span>}</td>)}
                <td className="total">{r.decision === 'absent' ? '—' : r.total}</td>
                <td><SheetChip sheet={{ ...r, sai_decision: null }} /></td>
                <td>
                  {r.final_decision === 'promote'
                    ? <span className="tb-mono" style={{ color: 'var(--green)' }}>→ {r.final_promote_to}</span>
                    : <span className="tb-mono" style={{ color: 'var(--mute)' }}>{r.final_decision === 'absent' ? 'absent' : 'hold'}</span>}
                  {r.sai_decision && <span className="tb-chip tb-chip--signed" style={{ marginLeft: 6 }}>Overturned</span>}
                </td>
                <td>
                  {!readOnly && !signoff && r.locked && r.decision !== 'absent' && (
                    <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => { setError(''); setOverturn(r); }}>Review</button>
                  )}
                  <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => print([r])}>Print</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overturn && (
        <OverturnModal row={overturn} busy={busy} error={error} onCancel={() => setOverturn(null)} onSave={saveOverturn} />
      )}

      {signing && (
        <Modal label="SAI sign off" onClose={() => !busy && setSigning(false)}>
          <div className="tb-eyebrow">Senior Army Instructor</div>
          <h3 className="tb-h1" style={{ fontSize: 28 }}>Sign off {COMPANY_LABEL[company]}</h3>
          <p className="tb-sub" style={{ fontSize: 13.5 }}>
            One signature covers all {signedRows.length} sheets. {promotions.length} promotion{promotions.length === 1 ? '' : 's'} will be written to the roster.
          </p>
          <label className="tb-field" style={{ margin: '14px 0 4px' }}>
            <span className="tb-label">Note (optional)</span>
            <input className="tb-input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </label>
          <PinPad onComplete={sign} busy={busy} resetKey={resetKey} error={error} />
        </Modal>
      )}
      {printNode}
    </div>
  );
}

function OverturnModal({ row, busy, error, onCancel, onSave }) {
  const options = promotionOptions(row.rank_before, row.let_level);
  const [decision, setDecision] = useState(row.sai_decision ?? (row.decision === 'promote' ? 'no_promote' : 'promote'));
  const [promoteTo, setPromoteTo] = useState(row.sai_promote_to ?? options[0] ?? null);
  const [note, setNote] = useState(row.sai_note ?? '');
  const invalid = decision === 'promote' && !options.includes(promoteTo);

  return (
    <Modal label="Overturn decision" onClose={() => !busy && onCancel()}>
      <div className="tb-eyebrow">SAI review · {row.total}/{MAX_TOTAL}</div>
      <h3 className="tb-h1" style={{ fontSize: 28 }}>{row.cadet_name}</h3>
      <p className="tb-sub" style={{ fontSize: 13.5, marginBottom: 14 }}>
        Board decided: <b>{row.decision === 'promote' ? `Promote to ${row.promote_to}` : 'Do not promote'}</b>. The board&rsquo;s original decision stays on record.
      </p>
      <div className="tb-decide" style={{ marginBottom: 14 }}>
        <button type="button" className="is-promote" aria-pressed={decision === 'promote'} disabled={!options.length} onClick={() => setDecision('promote')}>Promote</button>
        <button type="button" className="is-hold" aria-pressed={decision === 'no_promote'} onClick={() => setDecision('no_promote')}>Do not promote</button>
      </div>
      {decision === 'promote' && (
        <div className="tb-promo" style={{ marginBottom: 14 }}>
          {options.map((code) => (
            <button key={code} type="button" aria-pressed={promoteTo === code} onClick={() => setPromoteTo(code)}>
              <RankInsignia rank={code} size={28} title={false} />{code}
            </button>
          ))}
        </div>
      )}
      <label className="tb-field">
        <span className="tb-label">Reason</span>
        <textarea className="tb-textarea" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <div className="tb-banner tb-banner--error" style={{ marginTop: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {row.sai_decision
          ? <button type="button" className="tb-btn tb-btn--danger tb-btn--sm" disabled={busy} onClick={() => onSave(null, null, null)}>Restore board decision</button>
          : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="tb-btn tb-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="tb-btn tb-btn--gold" disabled={busy || invalid} onClick={() => onSave(decision, decision === 'promote' ? promoteTo : null, note)}>Save overturn</button>
        </div>
      </div>
    </Modal>
  );
}
