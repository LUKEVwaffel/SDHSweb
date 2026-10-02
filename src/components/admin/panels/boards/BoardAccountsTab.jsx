import { useCallback, useEffect, useState } from 'react';
import { boardApi } from '../../../boards/boardApi';
import { COMPANY_LABEL, Modal, fmtTime } from '../../../boards/ui';
import { BOARD_ROLES, COMPANIES } from '../../../../lib/boardRules';

// S-6: who holds each company's CO / XO / 1SG seat, the SAI and results
// viewers, and their 4-digit signature PINs (board-admin-member).
const SEATS = ['co', 'xo', '1sg'];

function PinForm({ member, onDone }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      await boardApi.adminMember({ action: 'set_pin', email: member.email, pin });
      onDone(`PIN set for ${member.display_name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal label="Set PIN" onClose={() => onDone()}>
      <div className="tb-eyebrow">Signature PIN</div>
      <h3 className="tb-h1" style={{ fontSize: 26 }}>{member.display_name}</h3>
      <p className="tb-sub" style={{ fontSize: 13.5, marginBottom: 14 }}>Give it to them in person. They can change it from the PIN button on /boards.</p>
      <input className="tb-input tb-mono" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="4 digits" autoFocus style={{ fontSize: 26, letterSpacing: '0.5em', textAlign: 'center' }} />
      {error && <div className="tb-banner tb-banner--error" style={{ marginTop: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" className="tb-btn tb-btn--ghost" onClick={() => onDone()}>Cancel</button>
        <button type="button" className="tb-btn tb-btn--gold" disabled={busy || pin.length !== 4} onClick={save}>Set PIN</button>
      </div>
    </Modal>
  );
}

function SeatForm({ company, seat, roster, onDone }) {
  const [cadetId, setCadetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cadet = roster.find((c) => c.id === cadetId);
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (!cadet?.school_email) throw new Error('That cadet has no school email on the roster');
      await boardApi.adminMember({ action: 'upsert', email: cadet.school_email, display_name: cadet.name, board_role: seat, company, cadet_id: cadet.id });
      onDone(`${cadet.name} is ${COMPANY_LABEL[company]} ${BOARD_ROLES[seat].short}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal label="Assign seat" onClose={() => onDone()}>
      <div className="tb-eyebrow">{COMPANY_LABEL[company]} Company</div>
      <h3 className="tb-h1" style={{ fontSize: 26 }}>Assign {BOARD_ROLES[seat].label}</h3>
      <p className="tb-sub" style={{ fontSize: 13.5, marginBottom: 14 }}>Replaces the current holder. They&rsquo;re removed from their own company&rsquo;s board list.</p>
      <select className="tb-select" value={cadetId} onChange={(e) => setCadetId(e.target.value)}>
        <option value="">Choose a cadet…</option>
        {roster.map((c) => <option key={c.id} value={c.id}>{c.name}{c.school_email ? '' : ' (no email)'}</option>)}
      </select>
      {error && <div className="tb-banner tb-banner--error" style={{ marginTop: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" className="tb-btn tb-btn--ghost" onClick={() => onDone()}>Cancel</button>
        <button type="button" className="tb-btn tb-btn--gold" disabled={busy || !cadetId} onClick={save}>Assign</button>
      </div>
    </Modal>
  );
}

function StaffForm({ onDone }) {
  const [form, setForm] = useState({ display_name: '', email: '', board_role: 'viewer' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      await boardApi.adminMember({ action: 'upsert', ...form });
      onDone(`${form.display_name} added`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal label="Add SAI or viewer" onClose={() => onDone()}>
      <div className="tb-eyebrow">Battalion level</div>
      <h3 className="tb-h1" style={{ fontSize: 26 }}>Add SAI or viewer</h3>
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        <input className="tb-input" placeholder="Name" value={form.display_name} onChange={set('display_name')} />
        <input className="tb-input" placeholder="Email" type="email" value={form.email} onChange={set('email')} />
        <select className="tb-select" value={form.board_role} onChange={set('board_role')}>
          <option value="viewer">Viewer — read + export (S-1, instructors)</option>
          <option value="sai">SAI — review, overturn, sign off</option>
        </select>
      </div>
      {error && <div className="tb-banner tb-banner--error" style={{ marginTop: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" className="tb-btn tb-btn--ghost" onClick={() => onDone()}>Cancel</button>
        <button type="button" className="tb-btn tb-btn--gold" disabled={busy || !form.display_name || !form.email} onClick={save}>Add</button>
      </div>
    </Modal>
  );
}

function MemberRow({ m, label, onPin, onAct, extra = null }) {
  const locked = m?.pin_locked_until && new Date(m.pin_locked_until) > new Date();
  return (
    <div className="tb-qrow" style={{ cursor: 'default', gridTemplateColumns: '64px minmax(0,1fr) auto auto' }}>
      <span className="tb-mono" style={{ color: 'var(--gold)', fontSize: 12 }}>{label}</span>
      <div style={{ minWidth: 0 }}>
        <div className="tb-qrow-name">{m ? m.display_name : <span style={{ color: 'var(--faint)' }}>Vacant</span>}</div>
        {m && <div className="tb-qrow-meta">{m.email}</div>}
      </div>
      {m ? (
        <span className={`tb-chip ${locked ? 'tb-chip--hold' : m.has_pin ? 'tb-chip--promote' : 'tb-chip--draft'}`}>
          {locked ? `Locked until ${fmtTime(m.pin_locked_until)}` : m.has_pin ? 'PIN set' : 'No PIN'}
        </span>
      ) : <span />}
      <div style={{ display: 'flex', gap: 6 }}>
        {extra}
        {m && <button type="button" className="tb-btn tb-btn--sm" onClick={() => onPin(m)}>{m.has_pin ? 'Reset PIN' : 'Set PIN'}</button>}
        {m?.has_pin && <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => onAct({ action: 'clear_pin', email: m.email }, 'PIN cleared')}>Clear</button>}
        {m && !m.company && <button type="button" className="tb-btn tb-btn--danger tb-btn--sm" onClick={() => window.confirm(`Remove ${m.display_name}?`) && onAct({ action: 'set_active', email: m.email, active: false }, 'Removed')}>Remove</button>}
      </div>
    </div>
  );
}

export default function BoardAccountsTab() {
  const [members, setMembers] = useState([]);
  const [rosters, setRosters] = useState({});
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, ...rs] = await Promise.all([boardApi.memberStatus(), ...COMPANIES.map((c) => boardApi.cadetsWithEmail(c))]);
      setMembers(m ?? []);
      setRosters(Object.fromEntries(COMPANIES.map((c, i) => [c, rs[i]])));
      setError('');
    } catch (err) {
      setError(err.message.includes('board_member_status') ? 'Run supabase/company_boards.sql first.' : err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  function done(msg) {
    setModal(null);
    if (msg) { setFlash(msg); load(); }
  }

  async function act(body, msg) {
    try {
      await boardApi.adminMember(body);
      done(msg);
    } catch (err) {
      setError(err.message);
    }
  }

  const active = members.filter((m) => m.active);
  const staff = active.filter((m) => !m.company);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <div className="tb-banner tb-banner--error">{error}</div>}
      {flash && <div className="tb-banner tb-banner--ok">{flash}</div>}

      <div className="tb-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
        {COMPANIES.map((c) => (
          <section key={c} className="tb-card tb-card--flat">
            <div className="tb-eyebrow" style={{ marginBottom: 12 }}>{COMPANY_LABEL[c]} Company board</div>
            <div className="tb-queue">
              {SEATS.map((seat) => {
                const m = active.find((x) => x.company === c && x.board_role === seat);
                return (
                  <MemberRow
                    key={seat} m={m} label={BOARD_ROLES[seat].short}
                    onPin={(x) => setModal({ type: 'pin', member: x })} onAct={act}
                    extra={<button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => setModal({ type: 'seat', company: c, seat })}>{m ? 'Reassign' : 'Assign'}</button>}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="tb-card tb-card--flat">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="tb-eyebrow">SAI + results viewers</div>
          <button type="button" className="tb-btn tb-btn--sm" onClick={() => setModal({ type: 'staff' })}>+ Add</button>
        </div>
        <div className="tb-queue">
          {staff.length === 0 && <p className="tb-sub">Nobody yet.</p>}
          {staff.map((m) => <MemberRow key={m.email} m={m} label={m.board_role === 'sai' ? 'SAI' : 'VIEW'} onPin={(x) => setModal({ type: 'pin', member: x })} onAct={act} />)}
        </div>
      </section>

      {modal?.type === 'pin' && <PinForm member={modal.member} onDone={done} />}
      {modal?.type === 'seat' && <SeatForm company={modal.company} seat={modal.seat} roster={rosters[modal.company] ?? []} onDone={done} />}
      {modal?.type === 'staff' && <StaffForm onDone={done} />}
    </div>
  );
}
