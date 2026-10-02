import { useMemo, useState } from 'react';
import {
  CATEGORIES, MAX_TOTAL, allScored, totalScore, promotionOptions, promotionEligibility,
  defaultPromotion, rankInfo, normalizeLet,
} from '../../../lib/boardRules';
import RankInsignia from '../RankInsignia';
import RankPicker from './RankPicker';
import { boardApi } from '../boardApi';
import { Modal } from '../ui';

// The digital board sheet. Left: the paper form (header fields + five 0–3
// categories + total). Right: the decision rail (promote / do not, promote-to
// with insignia preview, comment, save). Rules come from boardRules.js and
// are re-enforced by board_validate_sheet() in the database.

function initialScores(sheet) {
  return Object.fromEntries(CATEGORIES.map((c) => [c.key, sheet?.[c.key] ?? null]));
}

export default function SheetEditor({ cadet, sheet, onSaved, onClose, hasNext }) {
  const [rank, setRank] = useState(sheet?.rank_before ?? cadet.cadet_rank ?? null);
  const [askRank, setAskRank] = useState(!(sheet?.rank_before ?? cadet.cadet_rank));
  const [scores, setScores] = useState(() => initialScores(sheet));
  const [decision, setDecision] = useState(sheet?.decision === 'absent' ? null : sheet?.decision ?? null);
  const [promoteTo, setPromoteTo] = useState(sheet?.promote_to ?? null);
  const [comment, setComment] = useState(sheet?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmAbsent, setConfirmAbsent] = useState(false);

  const letLevel = normalizeLet(cadet.let_level);
  const total = totalScore(scores);
  const scored = allScored(scores);
  const options = useMemo(() => promotionOptions(rank, letLevel), [rank, letLevel]);
  const elig = promotionEligibility({ scores, currentRank: rank, letLevel });
  const promoteInvalid = decision === 'promote' && (!elig.eligible || !options.includes(promoteTo));
  const canComplete = scored && !!rank && !!decision && !promoteInvalid;

  function setScore(key, v) {
    setScores((s) => ({ ...s, [key]: s[key] === v ? null : v }));
    setError('');
  }

  function choose(d) {
    setDecision(d);
    if (d === 'promote' && !options.includes(promoteTo)) setPromoteTo(defaultPromotion(rank, letLevel));
    setError('');
  }

  async function save(status, { next = false, absent = false } = {}) {
    setSaving(true);
    setError('');
    try {
      const saved = await boardApi.saveSheet({
        id: sheet?.id ?? null,
        cadet_id: cadet.id,
        rank_before: rank,
        ...(absent ? {} : scores),
        decision: absent ? 'absent' : decision,
        promote_to: !absent && decision === 'promote' ? promoteTo : null,
        comment,
        status,
      });
      onSaved(saved, { next });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toLocaleDateString();

  return (
    <div>
      <div className="tb-toolbar" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="tb-btn tb-btn--ghost" onClick={onClose}>← Back to roster</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {!sheet?.locked && <button type="button" className="tb-btn tb-btn--sm" onClick={() => setConfirmAbsent(true)} disabled={saving}>Mark absent</button>}
        </div>
      </div>

      <div className="tb-sheet-wrap">
        <section className="tb-paper" aria-label={`Board sheet for ${cadet.name}`}>
          <header className="tb-paper-head">
            <img src="/assets/trojan-helmet.png" alt="" width="64" height="64" />
            <div>
              <h2>Trojan Battalion</h2>
              <p>ARMY JROTC</p>
            </div>
            <img src="/assets/army-jrotc.png" alt="" width="64" height="64" />
          </header>
          <div className="tb-paper-title">Boards</div>

          <div className="tb-paper-fields">
            <div className="tb-pf"><small>Cadet name</small><b>{cadet.name}</b></div>
            <div className="tb-pf">
              <small>Rank</small>
              <b className={rank ? '' : 'is-missing'}>
                <button type="button" onClick={() => setAskRank(true)} style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline dotted' }}>
                  {rank ? `${rank}` : 'Ask cadet'}
                </button>
              </b>
            </div>
            <div className="tb-pf"><small>LET</small><b className={letLevel ? '' : 'is-missing'}>{letLevel ?? '?'}</b></div>
            <div className="tb-pf"><small>Date</small><b>{today}</b></div>
          </div>

          {CATEGORIES.map((c) => (
            <div className="tb-cat" key={c.key}>
              <div>
                <h4>{c.label}</h4>
                <p>{c.sub}</p>
              </div>
              <div className="tb-score" role="group" aria-label={`${c.label} score`}>
                {[0, 1, 2, 3].map((v) => (
                  <button key={v} type="button" data-v={v} aria-pressed={scores[c.key] === v} onClick={() => setScore(c.key, v)}>{v}</button>
                ))}
              </div>
            </div>
          ))}

          <div className="tb-total">
            <span>Total points</span>
            <b>{total}<small> / {MAX_TOTAL}</small></b>
          </div>
        </section>

        <aside className="tb-rail">
          <div className="tb-card tb-card--flat">
            <div className="tb-eyebrow" style={{ marginBottom: 12 }}>Board decision</div>
            <div className="tb-decide">
              <button type="button" className="is-promote" aria-pressed={decision === 'promote'} disabled={!elig.eligible} onClick={() => choose('promote')}>Promote</button>
              <button type="button" className="is-hold" aria-pressed={decision === 'no_promote'} disabled={!scored || !rank} onClick={() => choose('no_promote')}>Do not promote</button>
            </div>
            {!elig.eligible && <p className="tb-decide-note" style={{ marginTop: 10 }}>● {elig.reason}</p>}
          </div>

          {decision === 'promote' && elig.eligible && (
            <div className="tb-card tb-card--flat">
              <div className="tb-eyebrow" style={{ marginBottom: 12 }}>Promote to</div>
              <div className="tb-promo">
                {options.map((code) => (
                  <button key={code} type="button" aria-pressed={promoteTo === code} onClick={() => setPromoteTo(code)} title={rankInfo(code).name}>
                    <RankInsignia rank={code} size={30} title={false} />
                    {code}
                  </button>
                ))}
              </div>
              {promoteTo && (
                <div className="tb-transition" style={{ marginTop: 14 }}>
                  <figure><RankInsignia rank={rank} size={40} /><figcaption>{rank}</figcaption></figure>
                  <span className="tb-transition-arrow">→</span>
                  <figure><RankInsignia rank={promoteTo} size={40} /><figcaption style={{ color: 'var(--gold-hi)' }}>{promoteTo}</figcaption></figure>
                </div>
              )}
            </div>
          )}

          <div className="tb-card tb-card--flat">
            <label className="tb-field">
              <span className="tb-label">Comment (optional)</span>
              <textarea className="tb-textarea" value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} placeholder="Anything the SAI should know" />
            </label>
          </div>

          {error && <div className="tb-banner tb-banner--error" role="alert">{error}</div>}

          <div style={{ display: 'grid', gap: 8 }}>
            {hasNext && (
              <button type="button" className="tb-btn tb-btn--gold tb-btn--lg" disabled={!canComplete || saving} onClick={() => save('complete', { next: true })}>
                {saving ? <span className="tb-spin" /> : 'Complete & next cadet →'}
              </button>
            )}
            <button type="button" className={`tb-btn ${hasNext ? '' : 'tb-btn--gold tb-btn--lg'}`} disabled={!canComplete || saving} onClick={() => save('complete')}>
              Complete sheet
            </button>
            <button type="button" className="tb-btn tb-btn--ghost" disabled={saving} onClick={() => save('draft')}>Save as draft</button>
          </div>
        </aside>
      </div>

      {askRank && (
        <Modal wide label="Current rank" onClose={rank ? () => setAskRank(false) : undefined}>
          <div className="tb-eyebrow">Ask the cadet</div>
          <h3 className="tb-h1" style={{ fontSize: 30 }}>What is {cadet.name.split(' ')[0]}&rsquo;s current rank?</h3>
          <p className="tb-sub" style={{ marginBottom: 18 }}>Saved to the roster, so next quarter&rsquo;s board already has it.</p>
          <RankPicker value={rank} onPick={(code) => { setRank(code); setAskRank(false); if (decision === 'promote') setDecision(null); }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="tb-btn tb-btn--ghost" onClick={onClose}>Cancel board</button>
          </div>
        </Modal>
      )}

      {confirmAbsent && (
        <Modal label="Mark absent" onClose={() => setConfirmAbsent(false)}>
          <div className="tb-eyebrow">Confirm</div>
          <h3 className="tb-h1" style={{ fontSize: 28 }}>Mark {cadet.name} absent?</h3>
          <p className="tb-sub">Recorded on this session&rsquo;s sheets. They can still be boarded later this quarter.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="tb-btn tb-btn--ghost" onClick={() => setConfirmAbsent(false)}>Cancel</button>
            <button type="button" className="tb-btn tb-btn--gold" disabled={saving} onClick={() => save('complete', { absent: true, next: hasNext })}>Mark absent</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
