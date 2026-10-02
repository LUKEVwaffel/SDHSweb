import { useCallback, useEffect, useState } from 'react';
import { boardApi, boardApiReady, isSandbox, pinErrorText } from './boardApi';
import SandboxBar from './SandboxBar';
import BoardLogin from './BoardLogin';
import CompanyBoard from './company/CompanyBoard';
import SaiConsole from './sai/SaiConsole';
import ResultsExplorer from './results/ResultsExplorer';
import { COMPANY_LABEL, Modal, PinPad } from './ui';
import { BOARD_ROLES } from '../../lib/boardRules';
import './boards.css';

// /boards — company promotion boards. One route, three views by role:
// company CO/XO/1SG → their company's board; SAI → review + sign-off;
// viewer (S-1 / instructors) or S-6 → results + export.

function roleLine(me) {
  if (me.board_role === 'sai') return 'Senior Army Instructor';
  if (me.board_role === 'viewer') return me.is_s6 ? 'S-6 · Results' : 'Results viewer';
  return `${BOARD_ROLES[me.board_role]?.short ?? ''} · ${COMPANY_LABEL[me.company] ?? ''} Company`;
}

function ChangePin({ onClose }) {
  const [step, setStep] = useState('current');
  const [current, setCurrent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [done, setDone] = useState(false);

  async function finish(newPin) {
    setBusy(true);
    setError('');
    try {
      await boardApi.setOwnPin(current, newPin);
      setDone(true);
    } catch (err) {
      setError(pinErrorText(err));
      setStep('current');
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal label="Change PIN" onClose={onClose}>
      <div className="tb-eyebrow">Your signature PIN</div>
      <h3 className="tb-h1" style={{ fontSize: 28 }}>{done ? 'PIN changed' : step === 'current' ? 'Current PIN' : 'New PIN'}</h3>
      {done ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" className="tb-btn tb-btn--gold" onClick={onClose}>Done</button></div>
      ) : (
        <PinPad
          key={step}
          busy={busy}
          resetKey={resetKey}
          error={error}
          onComplete={(pin) => (step === 'current' ? (setCurrent(pin), setStep('new'), setError('')) : finish(pin))}
        />
      )}
    </Modal>
  );
}

export default function BoardsApp() {
  const [phase, setPhase] = useState('checking');
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [pinOpen, setPinOpen] = useState(false);

  const load = useCallback(async () => {
    await boardApiReady;
    const session = await boardApi.session();
    if (!session) { setPhase('login'); return; }
    try {
      const rows = await boardApi.whoami();
      if (!rows.length) { setPhase('denied'); return; }
      setMe(rows[0]);
      setPhase('ready');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function signOut() {
    await boardApi.signOut();
    setMe(null);
    setPhase('login');
  }

  if (phase === 'checking') return <main className="tb" style={{ display: 'grid', placeItems: 'center' }}><span className="tb-spin" /></main>;
  if (phase === 'login') return <BoardLogin onSignedIn={load} />;
  if (phase !== 'ready') {
    return (
      <main className="tb" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="tb-card" style={{ maxWidth: 440, textAlign: 'center' }}>
          <div className="tb-eyebrow">Promotion boards</div>
          <h1 className="tb-h1" style={{ fontSize: 32 }}>{phase === 'denied' ? 'No board access' : 'Something broke'}</h1>
          <p className="tb-sub" style={{ margin: '0 auto 18px' }}>{phase === 'denied' ? 'This account isn’t set up for boards. Ask S-6.' : error}</p>
          <button type="button" className="tb-btn" onClick={signOut}>Sign out</button>
        </div>
      </main>
    );
  }

  const isSeat = ['co', 'xo', '1sg'].includes(me.board_role);
  return (
    <main className={`tb${isSandbox ? ' tb--sandbox' : ''}`}>
      <header className="tb-top">
        <img src="/assets/trojan-helmet.png" alt="" width="38" height="38" />
        <div className="tb-brand"><b>Trojan Battalion</b><span>Promotion boards</span></div>
        <div className="tb-top-spacer" />
        <div className="tb-whoami"><b>{me.display_name}</b><span>{roleLine(me)}</span></div>
        {!me.is_s6 && <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => setPinOpen(true)}>PIN</button>}
        <button type="button" className="tb-btn tb-btn--sm" onClick={signOut}>Sign out</button>
      </header>

      {isSeat && <CompanyBoard me={me} />}
      {me.board_role === 'sai' && <SaiConsole />}
      {me.board_role === 'viewer' && (
        <div className="tb-shell">
          <div className="tb-hero"><div><div className="tb-eyebrow">Battalion</div><h1 className="tb-h1">Board results</h1><p className="tb-sub">Filter any way you need, then export exactly what you see.</p></div></div>
          <ResultsExplorer />
        </div>
      )}
      {pinOpen && <ChangePin onClose={() => setPinOpen(false)} />}
      {isSandbox && <SandboxBar />}
    </main>
  );
}
