import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import ReviewLogin from '../../review/ReviewLogin';
import '../../review/review.css';
import '../portal.css';

function money(n) {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Kaz runs everything through a spreadsheet — dump the full ops queue as CSV.
function exportCsv(rows, guestsBySignup) {
  const headers = [
    'Cadet', 'LET', 'Company', 'Status', 'Guest', 'Guest Type', 'Guest Age',
    'Host Owes', 'Friend Owes', 'Friend Payment Method',
    'Cash Received', 'Field Trip Form Required', 'Field Trip Form Received',
    'Guest POC Name', 'Guest POC Phone', 'Guest POC Email', 'Guest Personal Email', 'Cadet Contact Email',
  ];
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    const g = guestsBySignup[r.id];
    lines.push([
      r.cadet_name, r.cadet_let_level, r.cadet_company, r.status,
      g?.name, g?.guest_type, g?.age,
      r.amount_due, g?.friend_amount_due, g?.friend_payment_method,
      r.cash_received ? 'Yes' : 'No',
      r.field_trip_form_required ? 'Yes' : 'No',
      r.field_trip_form_received ? 'Yes' : 'No',
      g?.poc_name, g?.poc_phone, g?.poc_email, g?.personal_email, r.notification_email,
    ].map(csvCell).join(','));
  });
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ball-ops-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Ball Ops portal — Kaz/Chief payment + field trip form tracking. Reuses the
// EXISTING reviewer PIN/password login wholesale (ReviewLogin.jsx, same
// email_reviewers population + reviewer-pin-login edge fn as the email review
// portal) — same people (Kaz + Chief), second surface. Reads through
// ball_signups_ops_view / ball_guests_ops_view (RLS-scoped, no dress fields,
// no allergies). Writes go directly to the base table under the column-guard
// trigger, then a fire-and-forget notify-ball-status-update.
//
// Layout: three buckets — NEEDS ACTION (verified, still owes cash or form),
// AWAITING GUEST (guest hasn't finished their part), SETTLED (done, dimmed).
export default function BallOpsPortal() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [rows, setRows] = useState([]);
  const [guestsBySignup, setGuestsBySignup] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { id, field }
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState(null); // { tone: 'ok' | 'err', msg }

  useEffect(() => {
    if (!flash || flash.tone === 'err') return undefined;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  const loadAll = useCallback(async () => {
    const [{ data: signups, error: sErr }, { data: guests, error: gErr }] = await Promise.all([
      SB.from('ball_signups_ops_view').select('*').order('created_at', { ascending: true }),
      SB.from('ball_guests_ops_view').select('*'),
    ]);
    if (sErr || gErr) { setPhase('error'); setErrorMsg((sErr || gErr).message); return; }
    const bySignup = {};
    (guests || []).forEach((g) => { bySignup[g.signup_id] = g; });
    setGuestsBySignup(bySignup);
    setRows(signups || []);
    setPhase('ready');
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: rev } = await SB.from('email_reviewers')
      .select('email').eq('email', session.user.email.toLowerCase()).eq('active', true).maybeSingle();
    if (!rev) { setLoginNotice('That account is not an active ops reviewer.'); setPhase('login'); return; }
    await loadAll();
  }, [loadAll]);

  useEffect(() => { verifyAndLoad(); }, [verifyAndLoad]);

  // Live refresh: Kaz/Chief share this queue, so a payment marked by the
  // other reviewer (or a fresh signup landing) shows up without Refresh.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const channel = SB.channel('ball-ops-portal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_signups' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_guests' }, loadAll)
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [phase, loadAll]);

  async function signOut() {
    await SB.auth.signOut();
    setRows([]); setGuestsBySignup({});
    setPhase('login');
  }

  function requestToggle(row, field) {
    setConfirmTarget({ id: row.id, field });
  }

  function cancelToggle() {
    setConfirmTarget(null);
  }

  async function applyToggle(row, field, guest) {
    const label = field === 'cash_received' ? 'cash payment' : 'field trip form';
    const turningOn = !row[field];
    const who = `${row.cadet_name}${guest?.name ? ` (+ ${guest.name})` : ''}`;

    setConfirmTarget(null);
    setBusyId(row.id);
    setFlash(null);
    const { error } = await SB.from('ball_signups').update({ [field]: turningOn }).eq('id', row.id);
    if (error) {
      setBusyId(null);
      setFlash({ tone: 'err', msg: `Could not update: ${error.message}` });
      return;
    }
    // Notification is fire-and-forget — a failed email must not block the flip.
    await SB.functions
      .invoke('notify-ball-status-update', { body: { signup_id: row.id, field: field === 'cash_received' ? 'cash' : 'form' } })
      .catch(() => {});
    await loadAll();
    setBusyId(null);
    const Label = label.charAt(0).toUpperCase() + label.slice(1);
    setFlash({ tone: 'ok', msg: `${Label} ${turningOn ? 'marked received' : 'revoked'} for ${who}.` });
  }

  const settled = (r) => r.cash_received && (!r.field_trip_form_required || r.field_trip_form_received);

  const { needsAction, awaiting, done } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (r) => {
      if (!term) return true;
      const g = guestsBySignup[r.id];
      return [
        r.cadet_name, r.notification_email, r.cadet_school_email,
        g?.name, g?.poc_name, g?.poc_phone, g?.poc_email, g?.personal_email,
      ].some((v) => (v || '').toLowerCase().includes(term));
    };
    const v = rows.filter(match);
    return {
      needsAction: v.filter((r) => r.status === 'fully_verified' && !settled(r)),
      awaiting: v.filter((r) => r.status === 'guest_pending'),
      done: v.filter((r) => r.status === 'fully_verified' && settled(r)),
    };
  }, [rows, guestsBySignup, q]);

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion · Ball Ops</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);
  if (phase === 'login') return shell(<ReviewLogin notice={loginNotice || 'Sign in to Ball Ops (same account as email review).'} onSignedIn={verifyAndLoad} />);
  if (phase === 'error') return shell(<div className="rv-panel" style={{ borderColor: '#dcbdb6' }}><h1 className="rv-h1" style={{ fontSize: 20 }}>Something went wrong</h1><p className="rv-sub">{errorMsg}</p></div>);

  const totalVerified = rows.filter((r) => r.status === 'fully_verified').length;

  return shell(
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="rv-link" style={{ margin: 0 }} onClick={() => { window.location.href = '/review'; }}>&lsaquo; Switch portal</button>
        <button className="rv-link" style={{ margin: 0 }} onClick={signOut}>Sign out</button>
      </div>
      <div className="bp-head">
        <h1 className="bp-title">Ball Payments</h1>
        <div className="bp-head-actions">
          <button className="bp-refresh" onClick={() => exportCsv(rows, guestsBySignup)}>Export CSV</button>
          <button className="bp-refresh" onClick={loadAll}>Refresh</button>
        </div>
      </div>

      <div className="bp-stats">
        <span className={`bp-stat ${needsAction.length ? 'is-alert' : ''}`}><b>{needsAction.length}</b> need action</span>
        <span className="bp-stat"><b>{awaiting.length}</b> awaiting guest</span>
        <span className={`bp-stat ${done.length === totalVerified && totalVerified > 0 ? 'is-done' : ''}`}><b>{done.length}</b> settled</span>
      </div>

      {flash && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            border: `1px solid ${flash.tone === 'err' ? 'var(--rv-red)' : 'var(--rv-green)'}`,
            background: flash.tone === 'err' ? 'var(--rv-red-soft)' : 'var(--rv-green-soft)',
            color: flash.tone === 'err' ? 'var(--rv-red)' : 'var(--rv-green)',
            borderRadius: 'var(--rv-radius)', padding: '10px 14px', fontSize: 13, marginBottom: 18,
          }}
        >
          <span>{flash.msg}</span>
          <button className="rv-link" style={{ margin: 0, color: 'inherit' }} onClick={() => setFlash(null)}>Dismiss</button>
        </div>
      )}

      {rows.length > 6 && (
        <input className="bp-search" placeholder="Search by cadet, guest, or POC name / phone / email…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {rows.length === 0 ? (
        <div className="bp-empty">No signups yet.</div>
      ) : (
        <>
          <Section title={`Needs action · ${needsAction.length}`} hide={!needsAction.length}>
            {needsAction.map((r) => (
              <OpsRow
                key={r.id} r={r} guest={guestsBySignup[r.id]} busy={busyId === r.id}
                confirming={confirmTarget?.id === r.id ? confirmTarget.field : null}
                onRequestToggle={requestToggle} onConfirm={applyToggle} onCancel={cancelToggle} state="alert"
              />
            ))}
          </Section>
          <Section title={`Awaiting guest · ${awaiting.length}`} hide={!awaiting.length}>
            {awaiting.map((r) => (
              <OpsRow
                key={r.id} r={r} guest={guestsBySignup[r.id]} busy={busyId === r.id}
                confirming={confirmTarget?.id === r.id ? confirmTarget.field : null}
                onRequestToggle={requestToggle} onConfirm={applyToggle} onCancel={cancelToggle} state="wait"
              />
            ))}
          </Section>
          <Section title={`Settled · ${done.length}`} hide={!done.length}>
            {done.map((r) => (
              <OpsRow
                key={r.id} r={r} guest={guestsBySignup[r.id]} busy={busyId === r.id}
                confirming={confirmTarget?.id === r.id ? confirmTarget.field : null}
                onRequestToggle={requestToggle} onConfirm={applyToggle} onCancel={cancelToggle} state="done"
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, hide, children }) {
  if (hide) return null;
  return (
    <div className="bp-section">
      <div className="bp-section-head">{title}</div>
      {children}
    </div>
  );
}

function ContactLine({ label, name, phone, email }) {
  if (!name && !phone && !email) return null;
  return (
    <div className="bp-contact-line">
      <span className="bp-contact-label">{label}</span>
      {name && <span className="bp-contact-val">{name}</span>}
      {phone && <a className="bp-contact-val bp-contact-link" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>}
      {email && <a className="bp-contact-val bp-contact-link" href={`mailto:${email}`}>{email}</a>}
    </div>
  );
}

function OpsRow({ r, guest, busy, confirming, onRequestToggle, onConfirm, onCancel, state }) {
  const friend = guest?.guest_type === 'friend';
  const hasContact = guest?.poc_name || guest?.poc_phone || guest?.poc_email
    || guest?.personal_email || r.notification_email;

  const confirmLabel = confirming === 'cash_received' ? 'cash payment' : 'field trip form';
  const confirmTurningOn = confirming ? !r[confirming] : false;
  const who = `${r.cadet_name}${guest?.name ? ` (+ ${guest.name})` : ''}`;

  return (
    <div className={`bp-row is-${state}`}>
      <div className="bp-row-main">
        <div>
          <span className="bp-name">{r.cadet_name}</span>
          {guest?.guest_type && <span className="bp-tag">{guest.guest_type}</span>}
        </div>
        <div className="bp-meta">
          LET {r.cadet_let_level || '--'} · {(r.cadet_company || '').toUpperCase()}
          {guest?.name ? ` · guest ${guest.name}${guest.age != null ? ` (${guest.age})` : ''}` : ''}
        </div>
        <div className="bp-facts">
          <span className="bp-fact">Host owes <b>{money(r.amount_due) || 'TBD'}</b></span>
          {friend && (
            <span className="bp-fact">
              Friend owes <b>{money(guest.friend_amount_due) || 'TBD'}</b>
              {' '}({guest.friend_payment_method === 'host_delivers' ? 'host brings it' : 'friend pays direct'})
            </span>
          )}
          {!r.field_trip_form_required && <span className="bp-fact">no field trip form</span>}
        </div>

        {hasContact && (
          <div className="bp-contact">
            <ContactLine
              label="Guest POC"
              name={guest?.poc_name}
              phone={guest?.poc_phone}
              email={guest?.poc_email}
            />
            {guest?.personal_email && (
              <ContactLine label={`${guest?.name || 'Guest'} email`} email={guest.personal_email} />
            )}
            {r.notification_email && (
              <ContactLine label="Cadet contact" email={r.notification_email} />
            )}
          </div>
        )}
      </div>

      {state !== 'wait' && (
        confirming ? (
          <div className="bp-confirm">
            <span className="bp-confirm-msg">
              {confirmTurningOn ? `Mark ${confirmLabel} received for ${who}?` : `Revoke ${confirmLabel} for ${who}?`}
            </span>
            <button
              className={`bp-confirm-yes ${confirmTurningOn ? '' : 'is-revoke'}`}
              disabled={busy}
              onClick={() => onConfirm(r, confirming, guest)}
            >
              {busy ? 'Saving…' : confirmTurningOn ? 'Confirm' : 'Revoke'}
            </button>
            <button className="bp-confirm-no" disabled={busy} onClick={onCancel}>Cancel</button>
          </div>
        ) : (
          <div className="bp-actions">
            <button
              className={`bp-toggle ${r.cash_received ? 'is-on' : ''}`}
              disabled={busy}
              title={r.cash_received ? 'Click to revoke cash received' : 'Click to mark cash received'}
              onClick={() => onRequestToggle(r, 'cash_received')}
            >
              {r.cash_received ? '✓ Cash — revoke' : 'Cash received'}
            </button>
            {r.field_trip_form_required && (
              <button
                className={`bp-toggle ${r.field_trip_form_received ? 'is-on' : ''}`}
                disabled={busy}
                title={r.field_trip_form_received ? 'Click to revoke form received' : 'Click to mark form received'}
                onClick={() => onRequestToggle(r, 'field_trip_form_received')}
              >
                {r.field_trip_form_received ? '✓ Form — revoke' : 'Form received'}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
