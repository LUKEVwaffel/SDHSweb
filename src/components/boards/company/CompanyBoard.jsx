import { useCallback, useEffect, useMemo, useState } from 'react';
import { boardApi } from '../boardApi';
import { ProgressRing, COMPANY_LABEL, useToast } from '../ui';
import BoardQueue, { cadetState } from './BoardQueue';
import SheetEditor from './SheetEditor';
import RanksTab from './RanksTab';
import SignTab from './SignTab';
import ArchiveTab from './ArchiveTab';

// Container for a company board laptop (CO / XO / 1SG signed in).
export default function CompanyBoard({ me }) {
  const company = me.company;
  const [tab, setTab] = useState('board');
  const [state, setState] = useState({ loading: true, error: '', quarter: null, roster: [], sheets: [], sessions: [], members: [], signoff: null });
  const [editing, setEditing] = useState(null);
  const [toastNode, toast] = useToast();

  const load = useCallback(async () => {
    try {
      const quarters = await boardApi.quarters();
      const quarter = quarters.find((q) => q.status === 'open') ?? null;
      const [roster, members] = await Promise.all([boardApi.roster(company), boardApi.members()]);
      const [sheets, sessions, signoffs] = quarter
        ? await Promise.all([boardApi.sheets(quarter.id, company), boardApi.sessions(quarter.id, company), boardApi.signoffs(quarter.id)])
        : [[], [], []];
      setState({
        loading: false, error: '', quarter, roster, sheets, sessions,
        members: members.filter((m) => m.company === company),
        signoff: signoffs.find((s) => s.company === company) ?? null,
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const { quarter, roster, sheets, sessions, members, signoff } = state;
  const cadets = useMemo(() => roster.filter((c) => !c.is_board_seat), [roster]);
  const openSession = sessions.find((s) => s.status === 'open') ?? null;
  const lastSealed = sessions.filter((s) => s.status === 'signed').sort((a, b) => (b.signed_at ?? '').localeCompare(a.signed_at ?? ''))[0] ?? null;

  // A cadet's sheet for the quarter: the real one if it exists, otherwise
  // their most recent absence.
  const sheetByCadet = useMemo(() => {
    const map = new Map();
    [...sheets].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((s) => {
      const cur = map.get(s.cadet_id);
      if (!cur || cur.decision === 'absent') map.set(s.cadet_id, s);
    });
    return map;
  }, [sheets]);
  const sheetFor = useCallback((id) => sheetByCadet.get(id) ?? null, [sheetByCadet]);

  const done = cadets.filter((c) => cadetState(sheetFor(c.id)) === 'done').length;
  const queueOrder = cadets.filter((c) => ['todo', 'absent', 'draft'].includes(cadetState(sheetFor(c.id))));

  function openCadet(cadet) {
    const s = sheetFor(cadet.id);
    setEditing({ cadet, sheet: s && !s.locked ? s : null });
  }

  async function onSaved(saved, { next }) {
    toast(saved.decision === 'absent' ? `${saved.cadet_name} marked absent` : `${saved.cadet_name} saved`);
    await load();
    if (next) {
      const after = queueOrder.filter((c) => c.id !== saved.cadet_id);
      if (after.length) { openCadet(after[0]); return; }
    }
    setEditing(null);
  }

  if (state.loading) return <div className="tb-shell"><p className="tb-sub" style={{ padding: 40 }}><span className="tb-spin" /> Loading {COMPANY_LABEL[company]} Company…</p></div>;

  const header = (
    <div className="tb-hero">
      <div>
        <div className="tb-eyebrow">{quarter ? quarter.label : 'No quarter open'} · Promotion boards</div>
        <h1 className="tb-h1">{COMPANY_LABEL[company]} Company</h1>
        <p className="tb-sub">
          {signoff
            ? `Signed off by ${signoff.signed_name}. ${signoff.promotions_applied} promotion${signoff.promotions_applied === 1 ? '' : 's'} applied.`
            : 'Score every cadet on the five categories, then all three of you sign once.'}
        </p>
      </div>
      <ProgressRing value={done} max={cadets.length} size={112} label="BOARDED" />
    </div>
  );

  if (editing) {
    return (
      <div className="tb-shell" style={{ paddingTop: 24 }}>
        <SheetEditor
          key={editing.cadet.id}
          cadet={editing.cadet}
          sheet={editing.sheet}
          hasNext={queueOrder.some((c) => c.id !== editing.cadet.id)}
          onSaved={onSaved}
          onClose={() => setEditing(null)}
        />
        {toastNode}
      </div>
    );
  }

  const tabs = [
    { id: 'board', label: 'Board', count: queueOrder.length },
    { id: 'ranks', label: 'Ranks', count: cadets.filter((c) => !c.cadet_rank).length },
    { id: 'sign', label: 'Sign & Seal' },
    { id: 'archive', label: 'Signed sheets' },
  ];

  return (
    <div className="tb-shell">
      {header}
      {state.error && <div className="tb-banner tb-banner--error" style={{ marginBottom: 16 }}>{state.error}</div>}
      {!quarter && tab !== 'ranks' && (
        <div className="tb-banner" style={{ marginBottom: 16 }}>Boards aren&rsquo;t open yet. You can still record ranks now — Chief opens the quarter when boards start.</div>
      )}
      {signoff && <div className="tb-banner tb-banner--ok" style={{ marginBottom: 16 }}>The SAI has signed off this company for {quarter?.label}. Boarding is closed.</div>}

      <div className="tb-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" className="tb-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}{t.count ? <span className="tb-count">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'board' && (quarter && !signoff
        ? <BoardQueue cadets={cadets} sheetFor={sheetFor} onOpen={openCadet} />
        : <div className="tb-empty"><b>{signoff ? 'Boards complete' : 'Waiting on Chief'}</b>{signoff ? 'See Signed sheets.' : 'No board quarter is open.'}</div>)}
      {tab === 'ranks' && <RanksTab cadets={cadets} onChanged={load} toast={toast} />}
      {tab === 'sign' && <SignTab session={openSession} lastSealed={lastSealed} sheets={sheets} members={members} onSigned={() => { toast('Signature recorded'); load(); }} />}
      {tab === 'archive' && <ArchiveTab quarterId={quarter?.id} sessions={sessions} />}
      {toastNode}
    </div>
  );
}
