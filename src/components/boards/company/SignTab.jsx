import { useState } from 'react';
import { boardApi, pinErrorText } from '../boardApi';
import { PinPad, Modal, fmtTime } from '../ui';
import { SIGN_ORDER, BOARD_ROLES } from '../../../lib/boardRules';

// The signing ceremony. One signature per board member per session — not per
// cadet. 1SG → XO → CMMDR, each on the same laptop with their own PIN. The
// CMMDR signature seals and locks every sheet in the session.
export default function SignTab({ session, lastSealed, sheets, members, onSigned }) {
  const [signing, setSigning] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);

  const inSession = sheets.filter((s) => s.session_id === session?.id);
  const drafts = inSession.filter((s) => s.status === 'draft');
  const complete = inSession.filter((s) => s.status === 'complete');
  const promote = complete.filter((s) => s.decision === 'promote').length;
  const absent = complete.filter((s) => s.decision === 'absent').length;
  const ready = complete.length > 0 && drafts.length === 0;
  const nextSeat = SIGN_ORDER.find((seat) => !session?.[`sig_${seat}_at`]);

  async function submit(pin) {
    setBusy(true);
    setError('');
    try {
      const res = await boardApi.signSession(session.id, signing, pin);
      setSigning(null);
      onSigned(res.session);
    } catch (err) {
      setError(pinErrorText(err));
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    if (!lastSealed) return <div className="tb-empty"><b>Nothing to sign yet</b>Board at least one cadet, then come back here.</div>;
    const count = sheets.filter((s) => s.session_id === lastSealed.id).length;
    return (
      <div className="tb-card" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 32, alignItems: 'center' }}>
        <div className="tb-seal" aria-label="Sealed"><span>Board</span><b>SEALED</b><span>{new Date(lastSealed.signed_at).toLocaleDateString()}</span></div>
        <div>
          <div className="tb-eyebrow">Session sealed · {count} sheet{count === 1 ? '' : 's'}</div>
          <h2 className="tb-h1" style={{ fontSize: 34 }}>Sent to the SAI</h2>
          <div className="tb-sign-grid" style={{ marginTop: 14 }}>
            {SIGN_ORDER.map((seat) => (
              <div key={seat}>
                <div className="tb-seat-step">{BOARD_ROLES[seat].short}</div>
                <div className="tb-signature">{lastSealed[`sig_${seat}_name`]}</div>
                <div className="tb-qrow-meta">{fmtTime(lastSealed[`sig_${seat}_at`]).toUpperCase()}</div>
              </div>
            ))}
          </div>
          <p className="tb-qrow-meta" style={{ marginTop: 14 }}>SEAL {lastSealed.seal?.slice(0, 32).toUpperCase()}</p>
          <p className="tb-sub" style={{ fontSize: 13.5, marginTop: 8 }}>Board anyone who was absent and a new session opens automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="tb-card tb-card--flat" style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="tb-stat"><b>{complete.length - absent}</b><span>Boarded</span></div>
        <div className="tb-stat"><b style={{ color: 'var(--green)' }}>{promote}</b><span>Promote</span></div>
        <div className="tb-stat"><b style={{ color: '#ff9ea1' }}>{complete.length - absent - promote}</b><span>Do not promote</span></div>
        <div className="tb-stat"><b style={{ color: 'var(--mute)' }}>{absent}</b><span>Absent</span></div>
        <div className="tb-stat"><b style={{ color: drafts.length ? 'var(--amber)' : 'var(--mute)' }}>{drafts.length}</b><span>Drafts</span></div>
        <p className="tb-sub" style={{ flex: '1 1 240px', fontSize: 13.5 }}>
          Each board member signs <b>once</b> for every sheet below. The CMMDR&rsquo;s signature seals the session — sheets can&rsquo;t be edited after that.
        </p>
      </div>

      {drafts.length > 0 && (
        <div className="tb-banner tb-banner--error">Finish or complete the {drafts.length} draft sheet{drafts.length === 1 ? '' : 's'} before signing.</div>
      )}

      <div className="tb-sign-grid">
        {SIGN_ORDER.map((seat, i) => {
          const holder = members.find((m) => m.board_role === seat);
          const signedName = session[`sig_${seat}_name`];
          const isNext = seat === nextSeat && ready;
          return (
            <div key={seat} className={`tb-seat${isNext ? ' is-next' : ''}${!signedName && !isNext ? ' is-locked' : ''}`}>
              <div className="tb-seat-step">STEP {i + 1} · {BOARD_ROLES[seat].short}</div>
              <div className="tb-seat-name">{holder?.display_name ?? 'No account set up'}</div>
              <div className="tb-sub" style={{ fontSize: 13 }}>{BOARD_ROLES[seat].label}</div>
              <div style={{ flex: 1 }} />
              {signedName ? (
                <>
                  <div className="tb-signature">{signedName}</div>
                  <div className="tb-qrow-meta">DIGITALLY SIGNED · {fmtTime(session[`sig_${seat}_at`]).toUpperCase()}</div>
                </>
              ) : (
                <button type="button" className={`tb-btn ${isNext ? 'tb-btn--gold' : ''}`} disabled={!isNext || !holder} onClick={() => { setError(''); setSigning(seat); }}>
                  {isNext ? `Sign as ${BOARD_ROLES[seat].short}` : 'Waiting'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {signing && (
        <Modal label="Sign" onClose={() => !busy && setSigning(null)}>
          <div className="tb-eyebrow">{BOARD_ROLES[signing].label}</div>
          <h3 className="tb-h1" style={{ fontSize: 28 }}>{members.find((m) => m.board_role === signing)?.display_name}</h3>
          <p className="tb-sub" style={{ fontSize: 13.5 }}>
            Enter <b>your</b> PIN to sign {complete.length} sheet{complete.length === 1 ? '' : 's'}.
            {signing === 'co' && ' This seals the session.'}
          </p>
          <PinPad onComplete={submit} busy={busy} resetKey={resetKey} error={error} />
        </Modal>
      )}
    </div>
  );
}
