import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase as SB } from '../../../lib/supabaseClient';
import PortalMovedNotice from '../../portal/PortalMovedNotice';
import { isPortalMoveNoticeActive } from '../../portal/portalMoveConfig';
import { ERROR_CODES, reportError } from '../../../lib/errorCodes';
import '../../review/review.css';
import '../portal.css';

function money(n) {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

// Small status pill — same tone language as BallOverviewTab's chip() (own
// copy here since these are two separate portals, kept self-contained).
function chip(tone) {
  const map = {
    green: ['var(--rv-green)', 'var(--rv-green-soft)'],
    accent: ['var(--rv-accent)', 'var(--rv-accent-soft)'],
    mute: ['var(--rv-faint)', 'transparent'],
  };
  const [c, bg] = map[tone] || map.mute;
  return {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.06em',
    textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, color: c,
    background: bg, border: `1px solid ${c}`, whiteSpace: 'nowrap',
  };
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Every toggle in this portal, keyed by a UI-facing field id, resolved to the
// table/column it actually writes and the human label used in confirm/flash
// copy. 'guest_field_trip_form_received' is a synthetic id — ball_guests and
// ball_signups both have a real column named field_trip_form_received (the
// host's own vs. the guest's own), so the UI key has to be distinct even
// though the DB column name is the same on the guest side.
const FIELD_TARGETS = {
  cash_received: { table: 'ball_signups', column: 'cash_received', label: 'cash payment', notify: 'cash' },
  field_trip_form_received: { table: 'ball_signups', column: 'field_trip_form_received', label: 'field trip form', notify: 'form' },
  friend_cash_received: { table: 'ball_guests', column: 'friend_cash_received', label: "guest's cash payment", notify: 'friend_cash' },
  guest_field_trip_form_received: { table: 'ball_guests', column: 'field_trip_form_received', label: "guest's field trip form", notify: 'guest_form' },
};

// Kaz runs everything through a spreadsheet — dump the full ops queue as CSV.
function exportCsv(rows, guestsBySignup) {
  const headers = [
    'Cadet', 'LET', 'Company', 'Status', 'Guest', 'Guest Type', 'Guest Age',
    'Host Owes', 'Friend Owes', 'Friend Payment Method',
    'Cash Received', 'Friend Cash Received', 'Field Trip Form Required',
    'Host Form Received', 'Guest Form Received',
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
      g?.guest_type === 'friend' ? (g?.friend_cash_received ? 'Yes' : 'No') : '',
      r.field_trip_form_required ? 'Yes' : 'No',
      r.field_trip_form_received ? 'Yes' : 'No',
      g?.field_trip_form_required ? (g?.field_trip_form_received ? 'Yes' : 'No') : '',
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

// Ball Ops portal — Kaz/Chief payment + field trip form tracking. Same
// email_reviewers population as /review (reached from its PortalPicker); an
// unauthed direct hit here since 2026-09-17 shows PortalMovedNotice and
// redirects to /portal instead of its own login screen. Reads through
// ball_signups_ops_view / ball_guests_ops_view (RLS-scoped, no dress fields,
// no allergies). Writes go directly to the base table under the column-guard
// trigger, then a fire-and-forget notify-ball-status-update.
//
// Layout: three buckets — NEEDS ACTION (verified, still owes cash or form),
// AWAITING GUEST (guest hasn't finished their part), SETTLED (done, dimmed).
export default function BallOpsPortal() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [deniedMsg, setDeniedMsg] = useState('');
  const [rows, setRows] = useState([]);
  const [guestsBySignup, setGuestsBySignup] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { id, field }
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState(null); // { tone: 'ok' | 'err', msg }
  const [openId, setOpenId] = useState(null); // signup id currently drilled into, or null for the lookup list

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
    if (sErr || gErr) {
      const err = sErr || gErr;
      setErrorMsg(reportError(ERROR_CODES.BALL_OPS_LOAD_FAILED, 'ball_ops', err.message, {
        detail: { supabase_error: err }, context: { source: sErr ? 'ball_signups_ops_view' : 'ball_guests_ops_view' },
      }));
      setPhase('error');
      return;
    }
    const bySignup = {};
    (guests || []).forEach((g) => { bySignup[g.signup_id] = g; });
    setGuestsBySignup(bySignup);
    setRows(signups || []);
    setPhase('ready');
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: rev, error: revErr } = await SB.from('email_reviewers')
      .select('email').eq('email', session.user.email.toLowerCase()).eq('active', true).eq('can_ball_ops', true).maybeSingle();
    if (revErr) {
      setErrorMsg(reportError(ERROR_CODES.BALL_OPS_SESSION_ERROR, 'ball_ops', revErr.message, {
        detail: { supabase_error: revErr }, context: { stage: 'reviewer_check', email: session.user.email },
      }));
      setPhase('error');
      return;
    }
    if (!rev) {
      setDeniedMsg(reportError(ERROR_CODES.BALL_OPS_NOT_AUTHORIZED, 'ball_ops', 'That account is not an active ops reviewer.', {
        context: { email: session.user.email },
      }));
      setPhase('denied');
      return;
    }
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
    setRows([]); setGuestsBySignup({}); setOpenId(null); setConfirmTarget(null); setDeniedMsg('');
    setPhase('login');
  }

  function requestToggle(row, field) {
    setConfirmTarget({ id: row.id, field });
  }

  function cancelToggle() {
    setConfirmTarget(null);
  }

  async function applyToggle(row, field, guest) {
    const target = FIELD_TARGETS[field];
    const onGuest = target.table === 'ball_guests';
    const current = onGuest ? guest?.[target.column] : row[target.column];
    const turningOn = !current;
    const who = onGuest ? (guest?.name || 'guest') : `${row.cadet_name}${guest?.name ? ` (+ ${guest.name})` : ''}`;

    setConfirmTarget(null);
    setBusyId(row.id);
    setFlash(null);
    try {
      const { error, count } = onGuest
        ? await SB.from('ball_guests').update({ [target.column]: turningOn }, { count: 'exact' }).eq('id', guest.id)
        : await SB.from('ball_signups').update({ [target.column]: turningOn }, { count: 'exact' }).eq('id', row.id);
      if (error) {
        setFlash({
          tone: 'err',
          msg: reportError(ERROR_CODES.BALL_OPS_TOGGLE_FAILED, 'ball_ops', `Could not update: ${error.message}`, {
            detail: { supabase_error: error }, context: { signup_id: row.id, guest_id: guest?.id, field, table: target.table },
          }),
        });
        return;
      }
      // No error AND no row matched means RLS/the column-guard silently
      // filtered the write instead of raising — the request "succeeds" with
      // nothing actually changed. Without this check that reads as success.
      if (!count) {
        setFlash({
          tone: 'err',
          msg: reportError(ERROR_CODES.BALL_OPS_TOGGLE_NO_MATCH, 'ball_ops', 'Update was blocked (0 rows changed) — this looks like a permissions issue, not a network drop. Nothing was saved.', {
            context: { signup_id: row.id, guest_id: guest?.id, field, table: target.table },
          }),
        });
        return;
      }
      // Notification is fire-and-forget — a failed email must not block the flip.
      await SB.functions
        .invoke('notify-ball-status-update', { body: { signup_id: row.id, field: target.notify } })
        .catch(() => {});
      await loadAll();
      const Label = target.label.charAt(0).toUpperCase() + target.label.slice(1);
      setFlash({ tone: 'ok', msg: `${Label} ${turningOn ? 'marked received' : 'revoked'} for ${who}.` });
    } catch (e) {
      // A dropped connection mid-request throws instead of resolving with
      // { error } — without this the button would stay greyed out forever.
      setFlash({
        tone: 'err',
        msg: reportError(ERROR_CODES.BALL_OPS_TOGGLE_EXCEPTION, 'ball_ops', `Could not update: ${e?.message || 'connection lost mid-request'}. Try again.`, {
          detail: { thrown: String(e?.message || e) }, context: { signup_id: row.id, guest_id: guest?.id, field, table: target.table },
        }),
      });
    } finally {
      setBusyId(null);
    }
  }

  // A self_pays friend owes their own $35 in a separate handoff — settled
  // requires BOTH the host's cash_received AND the friend's own
  // friend_cash_received. host_delivers is one handoff, covered by
  // cash_received alone, but the toggle (below) is still shown for ANY
  // friend so ops can note it arrived separately without it gating settled.
  // A 'date' guest has no separate payment at all — couple rate is one
  // combined charge, so no guest-cash toggle exists for a date. Field trip
  // form is a real per-person legal requirement, not optional: the guest
  // needs their own (guest.field_trip_form_required, set at signup from
  // whether THEY are an SDHS student) independent of whatever the host's own
  // flag is — this applies to date AND friend guests alike.
  const needsFriendCash = (r, g) => g?.guest_type === 'friend' && g?.friend_payment_method === 'self_pays';
  const needsGuestForm = (r, g) => !!g && g.field_trip_form_required;
  const settled = useCallback((r) => {
    const g = guestsBySignup[r.id];
    return r.cash_received
      && (!needsFriendCash(r, g) || g.friend_cash_received)
      && (!r.field_trip_form_required || r.field_trip_form_received)
      && (!needsGuestForm(r, g) || g.field_trip_form_received);
  }, [guestsBySignup]);

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
  }, [rows, guestsBySignup, q, settled]);

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion · Ball Ops</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);
  if (phase === 'login') return isPortalMoveNoticeActive() ? <PortalMovedNotice portalName="Ball Ops" /> : <Navigate to="/portal" replace />;
  if (phase === 'denied') return shell(
    <div className="rv-panel" style={{ borderColor: '#dcbdb6' }}>
      <h1 className="rv-h1" style={{ fontSize: 20 }}>Not authorized</h1>
      <p className="rv-sub">{deniedMsg}</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <a className="rv-link" style={{ margin: 0 }} href="/portal">&lsaquo; Back to portal picker</a>
        <button className="rv-link" style={{ margin: 0 }} onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
  if (phase === 'error') return shell(<div className="rv-panel" style={{ borderColor: '#dcbdb6' }}><h1 className="rv-h1" style={{ fontSize: 20 }}>Something went wrong</h1><p className="rv-sub">{errorMsg}</p></div>);

  const totalVerified = rows.filter((r) => r.status === 'fully_verified').length;
  const totalGuests = rows.filter((r) => guestsBySignup[r.id]).length;

  // Detail mode: a person clicked from the lookup list. Options (the toggle
  // buttons) live only here — the list itself stays compact.
  const openRow = openId ? rows.find((r) => r.id === openId) : null;
  function openPerson(id) { setConfirmTarget(null); setOpenId(id); }
  function backToList() { setConfirmTarget(null); setOpenId(null); }

  return shell(
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="rv-link" style={{ margin: 0 }} onClick={() => { window.location.href = '/review'; }}>&lsaquo; Switch portal</button>
        <button className="rv-link" style={{ margin: 0 }} onClick={signOut}>Sign out</button>
      </div>

      {openRow ? (
        <PersonDetail
          r={openRow} guest={guestsBySignup[openRow.id]} busy={busyId === openRow.id}
          confirming={confirmTarget?.id === openRow.id ? confirmTarget.field : null}
          onRequestToggle={requestToggle} onConfirm={applyToggle} onCancel={cancelToggle}
          onBack={backToList}
        />
      ) : (
        <>
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
            <span className="bp-stat"><b>{totalGuests}</b> guests</span>
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

          <input className="bp-search" placeholder="Look up a cadet, guest, or POC by name, phone, or email…" value={q} onChange={(e) => setQ(e.target.value)} />

          {rows.length === 0 ? (
            <div className="bp-empty">No signups yet.</div>
          ) : (
            <>
              <Section title={`Needs action · ${needsAction.length}`} hide={!needsAction.length}>
                {needsAction.map((r) => (
                  <LookupRow key={r.id} r={r} guest={guestsBySignup[r.id]} onOpen={openPerson} tone="alert" />
                ))}
              </Section>
              <Section title={`Awaiting guest · ${awaiting.length}`} hide={!awaiting.length}>
                {awaiting.map((r) => (
                  <LookupRow key={r.id} r={r} guest={guestsBySignup[r.id]} onOpen={openPerson} tone="wait" />
                ))}
              </Section>
              <Section title={`Settled · ${done.length}`} hide={!done.length}>
                {done.map((r) => (
                  <LookupRow key={r.id} r={r} guest={guestsBySignup[r.id]} onOpen={openPerson} tone="done" />
                ))}
              </Section>
              {!needsAction.length && !awaiting.length && !done.length && (
                <div className="bp-empty">No one matches "{q}".</div>
              )}
            </>
          )}
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

// Compact, click-to-open row — no action buttons here on purpose. Status at
// a glance via chips; the options live one tap away in PersonDetail.
function LookupRow({ r, guest, onOpen, tone }) {
  const friendPaysOwnCash = guest?.guest_type === 'friend' && guest?.friend_payment_method === 'self_pays';
  const cashDone = r.cash_received && (!friendPaysOwnCash || guest.friend_cash_received);
  const guestNeedsOwnForm = !!guest && guest.field_trip_form_required;
  const formDone = !r.field_trip_form_required || (r.field_trip_form_received && (!guestNeedsOwnForm || guest.field_trip_form_received));
  const awaitingGuest = r.status === 'guest_pending';

  return (
    <button type="button" className={`bp-row bp-row-btn is-${tone}`} onClick={() => onOpen(r.id)}>
      <div className="bp-row-main">
        <div>
          <span className="bp-name">{r.cadet_name}</span>
          {guest?.guest_type && <span className="bp-tag">{guest.guest_type}</span>}
        </div>
        <div className="bp-meta">
          LET {r.cadet_let_level || '--'} · {(r.cadet_company || '').toUpperCase()}
          {guest?.name ? ` · guest ${guest.name}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
        {awaitingGuest && <span style={chip('mute')}>awaiting guest</span>}
        <span style={chip(cashDone ? 'green' : 'accent')}>{cashDone ? 'paid' : `owes ${money(r.amount_due) || '?'}`}</span>
        {r.field_trip_form_required && <span style={chip(formDone ? 'green' : 'accent')}>{formDone ? 'form in' : 'form out'}</span>}
      </div>
    </button>
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

// Drill-down: look-up-a-person, click, get options. Everything actionable
// lives here instead of cluttering every row in the list.
function PersonDetail({ r, guest, busy, confirming, onRequestToggle, onConfirm, onCancel, onBack }) {
  const friend = guest?.guest_type === 'friend';
  const guestNeedsOwnForm = !!guest && guest.field_trip_form_required;
  const awaitingGuest = r.status === 'guest_pending';
  const hasContact = guest?.poc_name || guest?.poc_phone || guest?.poc_email
    || guest?.personal_email || r.notification_email;

  const confirmTarget = confirming ? FIELD_TARGETS[confirming] : null;
  const confirmOnGuest = confirmTarget?.table === 'ball_guests';
  const confirmCurrent = confirmTarget ? (confirmOnGuest ? guest?.[confirmTarget.column] : r[confirmTarget.column]) : false;
  const confirmTurningOn = confirming ? !confirmCurrent : false;
  const who = confirmOnGuest ? (guest?.name || 'guest') : `${r.cadet_name}${guest?.name ? ` (+ ${guest.name})` : ''}`;

  return (
    <div>
      <button type="button" className="rv-back" onClick={onBack}>&lsaquo; Back to list</button>
      <div className="rv-panel" style={{ padding: '22px 24px' }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--rv-ink)' }}>
          {r.cadet_name}
          {guest?.name && <span style={{ color: 'var(--rv-mute)', fontWeight: 400 }}> + {guest.name}</span>}
        </div>
        <div className="bp-meta" style={{ marginTop: 4 }}>
          LET {r.cadet_let_level || '--'} · {(r.cadet_company || '').toUpperCase()}
          {guest?.guest_type ? ` · ${guest.guest_type} guest${guest.age != null ? ` (${guest.age})` : ''}` : ''}
        </div>

        <div className="bp-facts" style={{ marginTop: 12 }}>
          <span className="bp-fact">Host owes <b>{money(r.amount_due) || 'TBD'}</b></span>
          {friend && (
            <span className="bp-fact">
              Friend owes <b>{money(guest.friend_amount_due) || 'TBD'}</b>
              {' '}({guest.friend_payment_method === 'host_delivers' ? 'host brings it' : 'friend pays direct'})
            </span>
          )}
          {!r.field_trip_form_required && <span className="bp-fact">no field trip form</span>}
          {guestNeedsOwnForm && <span className="bp-fact">guest needs own field trip form too</span>}
        </div>

        {hasContact && (
          <div className="bp-contact">
            <ContactLine label="Guest POC" name={guest?.poc_name} phone={guest?.poc_phone} email={guest?.poc_email} />
            {guest?.personal_email && (
              <ContactLine label={`${guest?.name || 'Guest'} email`} email={guest.personal_email} />
            )}
            {r.notification_email && (
              <ContactLine label="Cadet contact" email={r.notification_email} />
            )}
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px dashed var(--rv-border)' }}>
          <div className="bp-section-head" style={{ marginBottom: 12 }}>Options</div>

          {awaitingGuest ? (
            <p className="rv-sub" style={{ margin: 0, fontSize: 13 }}>
              Waiting on the guest to finish their part — nothing to record yet.
            </p>
          ) : confirming ? (
            <div className="bp-confirm" style={{ justifyContent: 'flex-start' }}>
              <span className="bp-confirm-msg">
                {confirmTurningOn ? `Mark ${confirmTarget.label} received for ${who}?` : `Revoke ${confirmTarget.label} for ${who}?`}
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
            <div className="bp-options">
              <button
                className={`bp-toggle ${r.cash_received ? 'is-on' : ''}`}
                disabled={busy}
                onClick={() => onRequestToggle(r, 'cash_received')}
              >
                {r.cash_received ? '✓ Cash received — tap to revoke' : 'Mark cash received'}
              </button>
              {guest?.guest_type === 'friend' && (
                <button
                  className={`bp-toggle ${guest.friend_cash_received ? 'is-on' : ''}`}
                  disabled={busy}
                  onClick={() => onRequestToggle(r, 'friend_cash_received')}
                >
                  {guest.friend_cash_received ? "✓ Guest's cash received — tap to revoke" : "Mark guest's cash received"}
                </button>
              )}
              {r.field_trip_form_required && (
                <button
                  className={`bp-toggle ${r.field_trip_form_received ? 'is-on' : ''}`}
                  disabled={busy}
                  onClick={() => onRequestToggle(r, 'field_trip_form_received')}
                >
                  {r.field_trip_form_received
                    ? `✓ ${guestNeedsOwnForm ? 'Host form' : 'Field trip form'} received — tap to revoke`
                    : `Mark ${guestNeedsOwnForm ? 'host form' : 'field trip form'} received`}
                </button>
              )}
              {guestNeedsOwnForm && (
                <button
                  className={`bp-toggle ${guest.field_trip_form_received ? 'is-on' : ''}`}
                  disabled={busy}
                  onClick={() => onRequestToggle(r, 'guest_field_trip_form_received')}
                >
                  {guest.field_trip_form_received ? "✓ Guest's form received — tap to revoke" : "Mark guest's form received"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
