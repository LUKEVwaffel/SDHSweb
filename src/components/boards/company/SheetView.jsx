import { CATEGORIES, MAX_TOTAL, SCORE_GUIDE, rankInfo } from '../../../lib/boardRules';
import RankInsignia from '../RankInsignia';
import { Modal } from '../ui';

// Read-only look at one completed board sheet, laid out like the paper form.
// Opened from Sign & Seal so each signer can check what they are signing.

const GUIDE = Object.fromEntries(SCORE_GUIDE.map((g) => [g.value, g.label]));

function Decision({ sheet }) {
  if (sheet.decision === 'absent') {
    return <div className="tb-banner" style={{ marginTop: 14 }}><b>Absent</b> — not boarded this session.</div>;
  }
  if (sheet.decision !== 'promote') {
    return (
      <div className="tb-view-decision is-hold">
        <b>Do not promote</b>
        <span>Stays {rankInfo(sheet.rank_before)?.name ?? sheet.rank_before}</span>
      </div>
    );
  }
  return (
    <div className="tb-view-decision is-promote">
      <b>Promote</b>
      <div className="tb-transition" style={{ border: 0, background: 'none', padding: 0 }}>
        <figure><RankInsignia rank={sheet.rank_before} size={34} /><figcaption>{sheet.rank_before}</figcaption></figure>
        <span className="tb-transition-arrow">→</span>
        <figure><RankInsignia rank={sheet.promote_to} size={34} /><figcaption>{sheet.promote_to}</figcaption></figure>
      </div>
    </div>
  );
}

/**
 * @param {{ sheet: object, onClose: () => void, onEdit?: () => void }} props
 * onEdit is passed only while the sheet can still be changed (nobody signed).
 */
export default function SheetView({ sheet, onClose, onEdit }) {
  const absent = sheet.decision === 'absent';
  const date = sheet.completed_at ? new Date(sheet.completed_at).toLocaleDateString() : '—';
  return (
    <Modal wide label={`Board sheet for ${sheet.cadet_name}`} onClose={onClose}>
      <section className="tb-paper" style={{ margin: 0 }}>
        <header className="tb-paper-head">
          <img src="/assets/trojan-helmet.png" alt="" width="64" height="64" />
          <div><h2>Trojan Battalion</h2><p>ARMY JROTC</p></div>
          <img src="/assets/army-jrotc.png" alt="" width="64" height="52" style={{ objectFit: 'contain' }} />
        </header>
        <div className="tb-paper-title">Boards</div>

        <div className="tb-paper-fields">
          <div className="tb-pf"><small>Cadet name</small><b>{sheet.cadet_name}</b></div>
          <div className="tb-pf"><small>Rank</small><b>{sheet.rank_before ?? '—'}</b></div>
          <div className="tb-pf"><small>LET</small><b>{sheet.let_level ?? '—'}</b></div>
          <div className="tb-pf"><small>Date</small><b>{date}</b></div>
        </div>

        {CATEGORIES.map((c) => {
          const v = sheet[c.key];
          return (
            <div className="tb-cat" key={c.key}>
              <div>
                <h4>{c.label}</h4>
                {c.sub && <p>{c.sub}</p>}
              </div>
              <div className="tb-view-score">
                {absent || v == null ? <b>—</b> : <><b data-v={v}>{v}</b><small>/ 3 · {GUIDE[v]}</small></>}
              </div>
            </div>
          );
        })}

        <div className="tb-total">
          <span>Total points</span>
          <b>{absent ? '—' : sheet.total}<small> / {MAX_TOTAL}</small></b>
        </div>

        <Decision sheet={sheet} />

        {sheet.comment && (
          <p className="tb-view-comment"><small>Board comment</small>{sheet.comment}</p>
        )}
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        {onEdit && <button type="button" className="tb-btn" onClick={onEdit}>Edit sheet</button>}
        <button type="button" className="tb-btn tb-btn--gold" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
