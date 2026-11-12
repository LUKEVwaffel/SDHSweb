import ChiefBirthday from "./ChiefBirthday";
import BallOpsCreate from "./BallOpsCreate";
import { opsRequest } from "../../../lib/ballOpsApi";
import { openBallOpsPacket } from "../../../lib/ballOpsPacket";
import "./ballOps.css";
import { ballBalance } from "../../../lib/ballBalance";
import {
  getBallPaymentFacts,
  isBallGuestFormRequired,
  isBallHostFormRequired,
} from "../../../lib/ballLabelEligibility";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase as SB } from "../../../lib/supabaseClient";
import PortalMovedNotice from "../../portal/PortalMovedNotice";
import { isPortalMoveNoticeActive } from "../../portal/portalMoveConfig";
import { ERROR_CODES, reportError } from "../../../lib/errorCodes";
import "../../review/review.css";
import "../portal.css";

function money(n) {
  return n == null
    ? null
    : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

// Small status pill — same tone language as BallOverviewTab's chip() (own
// copy here since these are two separate portals, kept self-contained).
function chip(tone) {
  const map = {
    green: ["var(--rv-green)", "var(--rv-green-soft)"],
    accent: ["var(--rv-accent)", "var(--rv-accent-soft)"],
    mute: ["var(--rv-faint)", "transparent"],
  };
  const [c, bg] = map[tone] || map.mute;
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "3px 9px",
    borderRadius: 999,
    color: c,
    background: bg,
    border: `1px solid ${c}`,
    whiteSpace: "nowrap",
  };
}

function csvCell(v) {
  if (v == null) return "";
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
  cash_received: {
    table: "ball_signups",
    column: "cash_received",
    label: "cash payment",
    notify: "cash",
  },
  field_trip_form_received: {
    table: "ball_signups",
    column: "field_trip_form_received",
    label: "host field trip form",
    notify: "form",
  },
  friend_cash_received: {
    table: "ball_guests",
    column: "friend_cash_received",
    label: "guest's cash payment",
    notify: "friend_cash",
  },
  guest_field_trip_form_received: {
    table: "ball_guests",
    column: "field_trip_form_received",
    label: "guest's field trip form",
    notify: "guest_form",
  },
};

// Kaz runs everything through a spreadsheet — dump the full ops queue as CSV.
function exportCsv(rows, guestsBySignup, ticketsBySignup = {}) {
  const headers = [
    "Cadet",
    "LET",
    "Company",
    "Status",
    "Guest",
    "Guest Type",
    "Guest Age",
    "Host Owes",
    "Friend Owes",
    "Friend Payment Method",
    "Cash Received",
    "Friend Cash Received",
    "Field Trip Form Required",
    "Host Form Received",
    "Guest Form Received",
    "Guest POC Name",
    "Guest POC Phone",
    "Guest POC Email",
    "Guest Personal Email",
    "Cadet Contact Email",
    "Tickets received",
    "Tickets ready",
    "Ticket pickup",
  ];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const g = guestsBySignup[r.id];
    lines.push(
      [
        r.cadet_name,
        r.cadet_let_level,
        r.cadet_company,
        r.status,
        g?.name,
        g?.guest_type,
        g?.age,
        r.amount_due,
        g?.friend_amount_due,
        g?.friend_payment_method,
        r.cash_received ? "Yes" : "No",
        g?.guest_type === "friend"
          ? (g?.friend_cash_received ? "Yes" : "No")
          : "",
        r.field_trip_form_required === true
          ? "Yes"
          : r.field_trip_form_required === false
          ? "No"
          : "Unknown",
        r.field_trip_form_received ? "Yes" : "No",
        g?.field_trip_form_required === true
          ? (g.field_trip_form_received ? "Yes" : "No")
          : g?.field_trip_form_required === false
          ? "No"
          : g
          ? "Unknown"
          : "",
        g?.poc_name,
        g?.poc_phone,
        g?.poc_email,
        g?.personal_email,
        r.notification_email,
        ticketsBySignup[r.id]
          ? (ticketsBySignup[r.id].distributed ? "Yes" : "No")
          : "Unknown",
        ticketsBySignup[r.id]
          ? (ticketsBySignup[r.id].ready ? "Yes" : "No")
          : "Unknown",
        ticketsBySignup[r.id]?.recipient_name,
      ].map(csvCell).join(","),
    );
  });
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
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
  const [viewerEmail, setViewerEmail] = useState("");
  const [ticketsBySignup, setTicketsBySignup] = useState({});
  const [ticketTrackingAvailable, setTicketTrackingAvailable] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [ticketConfirm, setTicketConfirm] = useState(null);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const loadSequence = useRef(0);
  const hasLoaded = useRef(false);
  const [creating, setCreating] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [phase, setPhase] = useState("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const [deniedMsg, setDeniedMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [guestsBySignup, setGuestsBySignup] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { id, field }
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState(null); // { tone: 'ok' | 'err', msg }
  const [openId, setOpenId] = useState(null); // signup id currently drilled into, or null for the lookup list

  useEffect(() => {
    if (!flash || flash.tone === "err") return undefined;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  const loadAll = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setRefreshing(true);
    try {
      const [
        { data: signups, error: sErr },
        { data: guests, error: gErr },
        ticketResult,
      ] = await Promise.all([
        SB.from("ball_signups_ops_view").select("*").order("created_at", {
          ascending: true,
        }),
        SB.from("ball_guests_ops_view").select("*"),
        opsRequest({ action: "tickets" }).then(
          (data) => ({ data }),
          (error) => ({ error }),
        ),
      ]);
      if (sequence !== loadSequence.current) return false;
      if (sErr || gErr) throw new Error((sErr || gErr).message);
      const bySignup = {};
      (guests || []).forEach((g) => {
        bySignup[g.signup_id] = g;
      });
      if (ticketResult.error) {
        setTicketError(ticketResult.error.message);
        setTicketTrackingAvailable(false);
      } else {
        setTicketsBySignup(
          Object.fromEntries(
            (ticketResult.data.tickets || []).map(
              (ticket) => [ticket.signup_id, ticket],
            ),
          ),
        );
        setTicketTrackingAvailable(
          ticketResult.data.tracking_available === true,
        );
        setTicketError("");
      }
      setGuestsBySignup(bySignup);
      setRows(signups || []);
      setRefreshError("");
      hasLoaded.current = true;
      setPhase("ready");
      return true;
    } catch (error) {
      if (sequence !== loadSequence.current) return false;
      const message =
        `Could not refresh reservations. ${error.message}. Retry before changing a record.`;
      if (hasLoaded.current) setRefreshError(message);
      else {
        setErrorMsg(message);
        setPhase("error");
      }
      return false;
    } finally {
      if (sequence === loadSequence.current) setRefreshing(false);
    }
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session }, error: sessionError } = await SB.auth
      .getSession();
    if (sessionError) {
      setErrorMsg("Could not check your session. Please retry.");
      setPhase("error");
      return;
    }
    if (!session) {
      setPhase("login");
      return;
    }
    const { data: rev, error: revErr } = await SB.from("email_reviewers")
      .select("email").eq("email", (session.user.email || "").toLowerCase()).eq(
        "active",
        true,
      ).eq("can_ball_ops", true).maybeSingle();
    if (revErr) {
      setPhase("error");
      setErrorMsg(
        reportError(
          ERROR_CODES.BALL_OPS_SESSION_ERROR,
          "ball_ops",
          revErr.message,
          {
            detail: { supabase_error: revErr },
            context: { stage: "reviewer_check", email: session.user.email },
          },
        ),
      );
      return;
    }
    if (!rev) {
      setDeniedMsg(
        reportError(
          ERROR_CODES.BALL_OPS_NOT_AUTHORIZED,
          "ball_ops",
          "That account is not an active ops reviewer.",
          {
            context: { email: session.user.email },
          },
        ),
      );
      setPhase("denied");
      return;
    }
    setViewerEmail(session.user.email || "");
    await loadAll();
  }, [loadAll]);

  useEffect(() => {
    verifyAndLoad().catch((e) => {
      setErrorMsg(e.message || "Could not check your session.");
      setPhase("error");
    });
  }, [verifyAndLoad]);

  // Live refresh: Kaz/Chief share this queue, so a payment marked by the
  // other reviewer (or a fresh signup landing) shows up without Refresh.
  useEffect(() => {
    if (phase !== "ready") return undefined;
    const channel = SB.channel("ball-ops-portal")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ball_signups",
      }, loadAll)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ball_guests",
      }, loadAll)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ball_ticket_deliveries",
      }, loadAll)
      .subscribe();
    return () => {
      SB.removeChannel(channel);
    };
  }, [phase, loadAll]);

  useEffect(() => {
    if (phase !== "ready") return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadAll();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [phase, loadAll]);

  async function signOut() {
    const { error } = await SB.auth.signOut();
    if (error) {
      setFlash({ tone: "err", msg: "Could not sign out. Please retry." });
      return;
    }
    setViewerEmail("");
    setTicketsBySignup({});
    setTicketConfirm(null);
    setRows([]);
    setGuestsBySignup({});
    setOpenId(null);
    setConfirmTarget(null);
    setDeniedMsg("");
    ++loadSequence.current;
    hasLoaded.current = false;
    setCreating(false);
    setFlash(null);
    setRefreshError("");
    setPhase("login");
  }

  function requestToggle(row, field) {
    setRemoveConfirm(false);
    const target = FIELD_TARGETS[field];
    const guest = guestsBySignup[row.id];
    const onGuest = target.table === "ball_guests";
    setConfirmTarget({
      id: row.id,
      field,
      current: !!(onGuest ? guest?.[target.column] : row[target.column]),
      guestId: onGuest ? guest?.id : null,
      who: onGuest ? (guest?.name || "Guest") : row.cadet_name,
    });
  }

  function cancelToggle() {
    setConfirmTarget(null);
  }

  async function applyToggle(row, field, guest) {
    const target = FIELD_TARGETS[field];
    const onGuest = target.table === "ball_guests";
    const expected = confirmTarget;
    if (!expected || expected.id !== row.id || expected.field !== field) return;
    if (onGuest && expected.guestId !== guest?.id) {
      setConfirmTarget(null);
      setFlash({
        tone: "err",
        msg:
          "The guest changed. Refresh and review the reservation before updating it.",
      });
      return;
    }
    const current = expected.current;
    const turningOn = !current;
    const who = onGuest ? (guest?.name || "guest") : row.cadet_name;

    setConfirmTarget(null);
    setBusyId(row.id);
    setFlash(null);
    try {
      const { error, count } = onGuest
        ? await SB.from("ball_guests").update({ [target.column]: turningOn }, {
          count: "exact",
        }).eq("id", guest.id).eq(target.column, !!current)
        : await SB.from("ball_signups").update({ [target.column]: turningOn }, {
          count: "exact",
        }).eq("id", row.id).eq(target.column, !!current);
      if (error) {
        setFlash({
          tone: "err",
          msg: reportError(
            ERROR_CODES.BALL_OPS_TOGGLE_FAILED,
            "ball_ops",
            `Could not update: ${error.message}`,
            {
              detail: { supabase_error: error },
              context: {
                signup_id: row.id,
                guest_id: guest?.id,
                field,
                table: target.table,
              },
            },
          ),
        });
        return;
      }
      // No error AND no row matched means RLS/the column-guard silently
      // filtered the write instead of raising — the request "succeeds" with
      // nothing actually changed. Without this check that reads as success.
      if (!count) {
        setFlash({
          tone: "err",
          msg: reportError(
            ERROR_CODES.BALL_OPS_TOGGLE_NO_MATCH,
            "ball_ops",
            "No row changed. Another staff member may have updated this record, or your access may have changed. Refresh and review it again.",
            {
              context: {
                signup_id: row.id,
                guest_id: guest?.id,
                field,
                table: target.table,
              },
            },
          ),
        });
        return;
      }
      // Notification is fire-and-forget — a failed email must not block the flip.
      if (turningOn) {
        void SB.functions
          .invoke("notify-ball-status-update", {
            body: { signup_id: row.id, field: target.notify },
          })
          .catch(() => {});
      }
      await loadAll();
      const Label = target.label.charAt(0).toUpperCase() +
        target.label.slice(1);
      setFlash({
        tone: "ok",
        msg: `${Label} ${
          turningOn ? "marked received" : "revoked"
        } for ${who}.`,
      });
    } catch (e) {
      // A dropped connection mid-request throws instead of resolving with
      // { error } — without this the button would stay greyed out forever.
      setFlash({
        tone: "err",
        msg: reportError(
          ERROR_CODES.BALL_OPS_TOGGLE_EXCEPTION,
          "ball_ops",
          `Could not update: ${
            e?.message || "connection lost mid-request"
          }. Try again.`,
          {
            detail: { thrown: String(e?.message || e) },
            context: {
              signup_id: row.id,
              guest_id: guest?.id,
              field,
              table: target.table,
            },
          },
        ),
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
  const settled = useCallback((r) => {
    const g = guestsBySignup[r.id];
    return getBallPaymentFacts(r, g).complete &&
      (!isBallHostFormRequired(r) || r.field_trip_form_received === true) &&
      (!isBallGuestFormRequired(g) || g.field_trip_form_received === true);
  }, [guestsBySignup]);

  const { needsAction, awaiting, done, allMatches } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (r) => {
      if (!term) return true;
      const g = guestsBySignup[r.id];
      return [
        r.cadet_name,
        r.notification_email,
        r.cadet_school_email,
        g?.name,
        g?.poc_name,
        g?.poc_phone,
        g?.poc_email,
        g?.personal_email,
      ].some((v) => String(v || "").toLowerCase().includes(term));
    };
    const v = rows.filter(match);
    return {
      allMatches: v,
      needsAction: v.filter((r) =>
        r.status === "fully_verified" && !settled(r)
      ),
      awaiting: v.filter((r) => r.status === "guest_pending"),
      done: v.filter((r) => r.status === "fully_verified" && settled(r)),
    };
  }, [rows, guestsBySignup, q, settled]);

  const shell = (children) => (
    <div className="rv bo-portal">
      <div className="rv-shell bo-shell">
        {children}
      </div>
    </div>
  );

  if (phase === "checking") {
    return shell(
      <p className="rv-sub">
        <span className="rv-dot" />Checking your session&hellip;
      </p>,
    );
  }
  if (phase === "login") {
    return isPortalMoveNoticeActive()
      ? <PortalMovedNotice portalName="Ball Ops" />
      : <Navigate to="/portal" replace />;
  }
  if (phase === "denied") {
    return shell(
      <div className="rv-panel" style={{ borderColor: "#dcbdb6" }}>
        <h1 className="rv-h1" style={{ fontSize: 20 }}>Not authorized</h1>
        <p className="rv-sub">{deniedMsg}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <a className="rv-link" style={{ margin: 0 }} href="/portal">
            &lsaquo; Back to portal picker
          </a>
          <button className="rv-link" style={{ margin: 0 }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>,
    );
  }
  if (phase === "error") {
    return shell(
      <div className="rv-panel" style={{ borderColor: "#dcbdb6" }}>
        <h1 className="rv-h1" style={{ fontSize: 20 }}>Something went wrong</h1>
        <p className="rv-sub">{errorMsg}</p>
        <button className="bp-confirm-yes" onClick={verifyAndLoad}>
          Retry loading
        </button>
        <a className="rv-link" href="/portal">Back to staff portal</a>
      </div>,
    );
  }

  const totalGuests = rows.filter((r) => guestsBySignup[r.id]).length;
  const completeCount =
    rows.filter((r) => r.status === "fully_verified" && settled(r)).length;
  const awaitingCount = rows.filter((r) => r.status === "guest_pending").length;
  const actionCount = rows.length - completeCount - awaitingCount;
  const visibleRows = filter === "action"
    ? needsAction
    : filter === "awaiting"
    ? awaiting
    : filter === "tickets_ready"
    ? allMatches.filter((r) =>
      ticketsBySignup[r.id]?.ready && !ticketsBySignup[r.id]?.distributed
    )
    : filter === "tickets_received"
    ? allMatches.filter((r) => ticketsBySignup[r.id]?.distributed)
    : filter === "complete"
    ? done
    : allMatches;
  const openRow = openId ? rows.find((r) => r.id === openId) : null;
  const blocked = !!busyId || !!refreshError;
  function openPerson(id) {
    if (busyId) return;
    setCreating(false);
    setRemoveConfirm(false);
    setTicketConfirm(null);
    setFlash(null);
    setConfirmTarget(null);
    setOpenId(id);
  }
  function backToList() {
    setConfirmTarget(null);
    setRemoveConfirm(false);
    setTicketConfirm(null);
    setOpenId(null);
  }
  async function printPacket(row) {
    const win = window.open("", "_blank");
    setBusyId(row.id);
    try {
      if (!win) throw new Error("Allow popups to print the packet.");
      win.document.write("<p>Loading current receipt…</p>");
      openBallOpsPacket(
        await opsRequest({ action: "packet", signup_id: row.id }),
        win,
      );
    } catch (e) {
      win?.close();
      setFlash({ tone: "err", msg: e.message });
    } finally {
      setBusyId(null);
    }
  }
  async function reviewGuestAction(mode) {
    setBusyId(openRow.id);
    setFlash(null);
    setConfirmTarget(null);
    setTicketConfirm(null);
    try {
      const packet = await opsRequest({
        action: "packet",
        signup_id: openRow.id,
      });
      if (!packet.guest) {
        throw new Error(
          "This reservation no longer has a guest. Refresh the list.",
        );
      }
      setRemoveConfirm({ ...packet, mode });
    } catch (e) {
      setFlash({ tone: "err", msg: e.message });
    } finally {
      setBusyId(null);
    }
  }
  async function removeGuest() {
    setBusyId(openRow.id);
    try {
      const result = await opsRequest({
        action: removeConfirm.mode,
        signup_id: removeConfirm.signup.id,
        guest_id: removeConfirm.guest.id,
        expected_version: removeConfirm.version,
        expected_solo_price: removeConfirm.config.price_cadet,
        paper_acknowledged: removeConfirm.mode === "complete_guest",
        expected_total: removeConfirm.signup.amount_due,
        expected_paid: ballBalance(removeConfirm.signup).paid,
      });
      setRemoveConfirm(false);
      await loadAll();
      setFlash({
        tone: "ok",
        msg: removeConfirm.mode === "complete_guest"
          ? "Guest registration recorded from signed paperwork. Attire approval remains separate."
          : `Guest removed. Payment preserved. Credit for staff review: ${
            money(ballBalance(result.signup).credit)
          }. No refund issued.`,
      });
    } catch (e) {
      setFlash({ tone: "err", msg: e.message });
    } finally {
      setBusyId(null);
    }
  }

  async function receiveTickets() {
    if (!ticketConfirm) return;
    const selected = ticketConfirm;
    setBusyId(selected.signup_id);
    setFlash(null);
    try {
      const result = await opsRequest({
        action: "receive_tickets",
        signup_id: selected.signup_id,
        expected_version: selected.version,
      });
      setTicketConfirm(null);
      await loadAll();
      setFlash({
        tone: "ok",
        msg: result.already_received
          ? "These tickets are already recorded as received."
          : "Tickets marked received. Other reservation requirements are unchanged.",
      });
    } catch (e) {
      setTicketConfirm(null);
      await loadAll();
      setFlash({ tone: "err", msg: e.message });
    } finally {
      setBusyId(null);
    }
  }
  return shell(
    <main>
      <ChiefBirthday email={viewerEmail} />
      {refreshError && (
        <div role="alert" className="bo-flash is-error">
          <span>{refreshError}</span>
          <button disabled={refreshing} onClick={loadAll}>Retry refresh</button>
        </div>
      )}
      {flash && (
        <div
          role={flash.tone === "err" ? "alert" : "status"}
          className={`bo-flash ${
            flash.tone === "err" ? "is-error" : "is-success"
          }`}
        >
          <span>{flash.msg}</span>
          <button onClick={() => setFlash(null)}>Dismiss</button>
        </div>
      )}
      <div
        className={`bo-workspace ${openRow || creating ? "has-detail" : ""}`}
      >
        <section className="bo-list" aria-label="Reservation list">
          <div className="bo-list-toolbar">
            <div>
              <h1>
                Reservations <span>{rows.length}</span>
              </h1>
              <p>Chief’s ball portal · {totalGuests} guests</p>
            </div>
            <button
              className="bp-confirm-yes bo-new"
              disabled={!!busyId}
              onClick={() => {
                setTicketConfirm(null);
                setFlash(null);
                setConfirmTarget(null);
                setCreating(true);
              }}
            >
              <span aria-hidden="true">+</span> Create reservation
            </button>
          </div>
          <div className="bo-search-wrap">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <circle
                cx="8.5"
                cy="8.5"
                r="5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <input
              aria-label="Search reservations"
              className="bp-search"
              placeholder="Search cadet, guest, phone, or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button aria-label="Clear search" onClick={() => setQ("")}>
                ×
              </button>
            )}
          </div>
          <div className="bo-filters" aria-label="Filter reservations">
            {[
              ["all", "All", rows.length],
              ["action", "Need action", actionCount],
              ["awaiting", "Awaiting guest", awaitingCount],
              ["complete", "Complete", completeCount],
              [
                "tickets_ready",
                "Hand out tickets",
                Object.values(ticketsBySignup).filter((t) =>
                  t.ready && !t.distributed
                ).length,
              ],
              [
                "tickets_received",
                "Tickets received",
                Object.values(ticketsBySignup).filter((t) => t.distributed)
                  .length,
              ],
            ].map(([key, label, count]) => (
              <button
                key={key}
                aria-pressed={filter === key}
                className={filter === key ? "is-active" : ""}
                onClick={() => setFilter(key)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          {(ticketError || !ticketTrackingAvailable) && (
            <p className="bo-ticket-note" role="status">
              {ticketError
                ? "Ticket status could not refresh. Retry before recording receipt."
                : "Ticket status is shown read-only until the ticket-recording SQL update is installed."}
            </p>
          )}
          <div className="bo-list-caption">
            <span>
              {q
                ? `${visibleRows.length} matching reservation${
                  visibleRows.length === 1 ? "" : "s"
                }`
                : "Cadet / guest"}
            </span>
            <span>Payment & paperwork</span>
          </div>
          <div className="bo-list-rows">
            {visibleRows.map((r) => (
              <LookupRow
                key={r.id}
                r={r}
                guest={guestsBySignup[r.id]}
                ticket={ticketError ? null : ticketsBySignup[r.id]}
                onOpen={openPerson}
                selected={openId === r.id && !creating}
                disabled={!!busyId}
                tone={r.status === "guest_pending"
                  ? "wait"
                  : settled(r)
                  ? "done"
                  : "alert"}
              />
            ))}
            {!visibleRows.length && (
              <div className="bp-empty">
                <h3>
                  {rows.length
                    ? "No matching reservations"
                    : "Your reservation list is empty"}
                </h3>
                <p>
                  {rows.length
                    ? "Try a different name or filter."
                    : "Create a reservation to record a cadet’s payment and paperwork."}
                </p>
                {(q || filter !== "all") && (
                  <button
                    className="bp-refresh"
                    onClick={() => {
                      setQ("");
                      setFilter("all");
                    }}
                  >
                    Clear search & filters
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="bo-list-footer">
            <span>{visibleRows.length} of {rows.length} reservations</span>
            <span>Complete = cash & forms received</span>
          </div>
        </section>
        <aside
          className="bo-detail"
          aria-label={creating
            ? "Create reservation"
            : openRow
            ? `Reservation for ${openRow.cadet_name}`
            : "Reservation details"}
        >
          {creating
            ? (
              <BallOpsCreate
                onBack={() => setCreating(false)}
                onCreated={loadAll}
              />
            )
            : openRow
            ? (
              <PersonDetail
                r={openRow}
                guest={guestsBySignup[openRow.id]}
                busy={blocked}
                confirming={confirmTarget?.id === openRow.id
                  ? confirmTarget
                  : null}
                onRequestToggle={requestToggle}
                onConfirm={applyToggle}
                onCancel={cancelToggle}
                onBack={backToList}
                removeConfirm={removeConfirm}
                onRemoveRequest={() => reviewGuestAction("remove_guest")}
                onPaperRequest={() => reviewGuestAction("complete_guest")}
                onRemoveCancel={() => setRemoveConfirm(false)}
                onPrint={() => printPacket(openRow)}
                onRemove={removeGuest}
                ticket={ticketError ? null : ticketsBySignup[openRow.id]}
                ticketTrackingAvailable={ticketTrackingAvailable}
                ticketConfirm={ticketConfirm?.signup_id === openRow.id
                  ? ticketConfirm
                  : null}
                onTicketRequest={() => {
                  setConfirmTarget(null);
                  setRemoveConfirm(false);
                  setTicketConfirm({ ...ticketsBySignup[openRow.id] });
                }}
                onTicketCancel={() => setTicketConfirm(null)}
                onTicketReceive={receiveTickets}
              />
            )
            : (
              <div className="bo-detail-empty">
                <div className="bo-document-icon" aria-hidden="true">
                  <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
                    <rect
                      x="5"
                      y="3"
                      width="34"
                      height="46"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M13 16h18M13 24h18M13 32h11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <div className="bo-eyebrow">Reservation details</div>
                <h2>A place for every detail.</h2>
                <p>
                  Select a reservation to review payments, receive paperwork,
                  manage a guest, or print a packet.
                </p>
                <span className="bo-empty-hint">
                  Choose a cadet from the list to get started.
                </span>
              </div>
            )}
        </aside>
      </div>
      <footer className="bo-page-footer">
        <div className="bo-footer-actions">
          <button
            className="bp-refresh"
            disabled={refreshing}
            onClick={loadAll}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="bp-refresh"
            onClick={() =>
              exportCsv(
                rows,
                guestsBySignup,
                ticketError ? {} : ticketsBySignup,
              )}
          >
            Export CSV
          </button>
          <span className="bo-footer-divider" />
          <a href="/portal" className="rv-link">Switch portal</a>
          <button className="rv-link" disabled={!!busyId} onClick={signOut}>
            Sign out
          </button>
        </div>
        <span>
          Complete = cash & forms received · Attire managed separately
        </span>
      </footer>
    </main>,
  );
}

// Compact, click-to-open row — no action buttons here on purpose. Status at
// a glance via chips; the options live one tap away in PersonDetail.
function LookupRow({ r, guest, ticket, onOpen, tone, selected, disabled }) {
  const payment = getBallPaymentFacts(r, guest);
  const cashDone = payment.complete;
  const guestNeedsOwnForm = isBallGuestFormRequired(guest);
  const hostFormDone = !!r.field_trip_form_received;
  const guestFormDone = !!guest?.field_trip_form_received;
  const awaitingGuest = r.status === "guest_pending";

  return (
    <button
      type="button"
      className={`bp-row bp-row-btn is-${tone} ${
        selected ? "is-selected" : ""
      }`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onOpen(r.id)}
    >
      <div className="bp-row-main">
        <div>
          <span className="bp-name">{r.cadet_name}</span>
          {guest?.guest_type && (
            <span className="bp-tag">{guest.guest_type}</span>
          )}
        </div>
        <div className="bp-meta">
          LET {r.cadet_let_level || "--"} ·{" "}
          {(r.cadet_company || "").toUpperCase()}
          {guest?.name ? ` · guest ${guest.name}` : ""}
          {guest?.guest_company ? ` · ${guest.guest_company.toUpperCase()} Company` : ""}
        </div>
      </div>
      <div className="bo-row-status">
        {ticket && (
          <span
            style={chip(
              ticket.distributed ? "green" : ticket.ready ? "accent" : "mute",
            )}
          >
            {ticket.distributed
              ? "Tickets received"
              : ticket.ready
              ? "Hand out tickets"
              : "Tickets pending"}
          </span>
        )}
        {awaitingGuest && <span style={chip("mute")}>awaiting guest</span>}
        <span style={chip(cashDone ? "green" : "accent")}>
          {cashDone
            ? "paid"
            : payment.hostBalance == null || payment.friendBalance == null
            ? "payment unknown"
            : `owes ${money(payment.hostBalance + payment.friendBalance)}`}
        </span>
        {r.field_trip_form_required && (
          <span style={chip(hostFormDone ? "green" : "accent")}>
            {guest ? "host " : ""}form {hostFormDone ? "in" : "out"}
          </span>
        )}
        {guestNeedsOwnForm && (
          <span style={chip(guestFormDone ? "green" : "accent")}>
            guest form {guestFormDone ? "in" : "out"}
          </span>
        )}
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
      {phone && (
        <a
          className="bp-contact-val bp-contact-link"
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        >
          {phone}
        </a>
      )}
      {email && (
        <a className="bp-contact-val bp-contact-link" href={`mailto:${email}`}>
          {email}
        </a>
      )}
    </div>
  );
}

// Drill-down: look-up-a-person, click, get options. Everything actionable
// lives here instead of cluttering every row in the list.
function PersonDetail(
  {
    r,
    guest,
    busy,
    confirming,
    onRequestToggle,
    onConfirm,
    onCancel,
    onBack,
    onPrint,
    onRemove,
    onRemoveRequest,
    onRemoveCancel,
    removeConfirm,
    onPaperRequest,
    ticket,
    ticketTrackingAvailable,
    ticketConfirm,
    onTicketRequest,
    onTicketCancel,
    onTicketReceive,
  },
) {
  const friend = guest?.guest_type === "friend";
  const guestNeedsOwnForm = isBallGuestFormRequired(guest);
  const awaitingGuest = r.status === "guest_pending";
  const hasContact = guest?.poc_name || guest?.poc_phone || guest?.poc_email ||
    guest?.personal_email || r.notification_email;

  const confirmTarget = confirming ? FIELD_TARGETS[confirming.field] : null;
  const confirmCurrent = confirming?.current ?? false;
  const confirmTurningOn = confirming ? !confirmCurrent : false;
  const who = confirming?.who || r.cadet_name;

  return (
    <div className="bo-person">
      <div className="bo-detail-top">
        <span className="bo-eyebrow">Selected reservation</span>
        <button
          type="button"
          className="bo-close"
          aria-label="Close reservation details"
          disabled={busy}
          onClick={onBack}
        >
          ×
        </button>
      </div>
      <div className="rv-panel bo-person-body">
        <h2 className="bo-person-name">
          {r.cadet_name}
        </h2>
        {guest?.name && (
          <p className="bo-guest-name">
            With {guest.name} <span>{guest.guest_type}</span>
          </p>
        )}
        {guest?.guest_company && (
          <div className="bp-meta">
            {guest.name}: {guest.guest_let_level ? `LET ${guest.guest_let_level} · ` : ""}{guest.guest_company.toUpperCase()} Company · cadet guest
          </div>
        )}
        <div className="bp-meta" style={{ marginTop: 4 }}>
          LET {r.cadet_let_level || "--"} ·{" "}
          {(r.cadet_company || "").toUpperCase()}
          {guest?.guest_type
            ? ` · ${guest.guest_type} guest${
              guest.age != null ? ` (${guest.age})` : ""
            }`
            : ""}
        </div>

        <div className="bp-facts" style={{ marginTop: 12 }}>
          <span className="bp-fact">
            Host balance{" "}
            <b>
              {money(getBallPaymentFacts(r, guest).hostBalance) || "Unknown"}
            </b>
          </span>
          <span className="bp-fact">
            Payment recorded <b>{money(ballBalance(r).paid)}</b>
          </span>
          {ballBalance(r).credit > 0 && (
            <span className="bp-fact">
              Credit / refund review <b>{money(ballBalance(r).credit)}</b>
            </span>
          )}
          {friend && (
            <span className="bp-fact">
              Friend balance{" "}
              <b>
                {money(getBallPaymentFacts(r, guest).friendBalance) ||
                  "Unknown"}
              </b>{" "}
              ({guest.friend_payment_method === "host_delivers"
                ? "host brings it"
                : "friend pays direct"})
            </span>
          )}
          {!isBallHostFormRequired(r) && (
            <span className="bp-fact">no field trip form</span>
          )}
          {r.standalone_guest === true && r.field_trip_form_required == null &&
            <span className="bp-fact">host form requirement unknown</span>}
          {guestNeedsOwnForm && (
            <span className="bp-fact">
              {guest.field_trip_form_required === true ||
                  guest.is_sdhs_jrotc === true
                ? "guest needs own field trip form too"
                : "guest form requirement unknown; review with S-6"}
            </span>
          )}
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
              <ContactLine
                label={`${guest?.name || "Guest"} email`}
                email={guest.personal_email}
              />
            )}
            {r.notification_email && (
              <ContactLine label="Cadet contact" email={r.notification_email} />
            )}
          </div>
        )}

        <section
          className={`bo-ticket-panel ${
            ticket?.distributed
              ? "is-received"
              : ticket?.ready
              ? ""
              : "is-pending"
          }`}
          aria-label="Tickets"
        >
          <h3>
            {ticket?.distributed
              ? "Tickets received"
              : ticket?.ready
              ? "Hand out tickets"
              : ticket
              ? "Tickets not ready"
              : "Ticket status unavailable"}
          </h3>
          {ticket && (
            <>
              <p>
                {ticket.distributed
                  ? `Recorded for ${
                    ticket.received_by_name || ticket.recipient_name
                  }`
                  : `Pickup: ${ticket.recipient_name} · ${ticket.recipient_company}`}
                {" "}
                · {ticket.ticket_count}{" "}
                {ticket.ticket_count === 1 ? "ticket" : "tickets"}
              </p>
              {ticket.distributed
                ? (
                  <p>
                    {ticket.historical
                      ? "Previously handed out — recorded from the host company list. "
                      : ""}
                    {!ticket.ready
                      ? "Other reservation requirements are still outstanding."
                      : ""}
                  </p>
                )
                : ticket.ready
                ? (
                  <>
                    {ticketConfirm
                      ? (
                        <div>
                          <p>
                            Confirm these tickets have been handed to{" "}
                            <b>{ticketConfirm.recipient_name}</b>?
                          </p>
                          <button
                            className="bp-confirm-yes"
                            disabled={busy}
                            onClick={onTicketReceive}
                          >
                            {busy ? "Saving…" : "Confirm tickets received"}
                          </button>
                          <button
                            className="bp-confirm-no"
                            disabled={busy}
                            onClick={onTicketCancel}
                          >
                            Cancel
                          </button>
                        </div>
                      )
                      : (
                        <button
                          className="bp-confirm-yes"
                          disabled={busy || !ticketTrackingAvailable}
                          onClick={onTicketRequest}
                        >
                          Mark tickets received
                        </button>
                      )}
                    {!ticketTrackingAvailable && (
                      <p>Recording needs the ticket SQL update.</p>
                    )}
                  </>
                )
                : (
                  <p>
                    Complete registration, payment, signed forms, and required
                    attire approval before handing out tickets.
                  </p>
                )}
            </>
          )}
        </section>
        <div className="bo-person-actions">
          <div className="bp-section-head" style={{ marginBottom: 12 }}>
            Reservation tools
          </div>
          <div className="bp-options bo-tools">
            <button className="bp-toggle" disabled={busy} onClick={onPrint}>
              Print receipt & instructions / Save PDF
            </button>
            {guest && !removeConfirm && (
              <button
                className="bp-toggle"
                disabled={busy}
                onClick={onRemoveRequest}
              >
                Remove guest…
              </button>
            )}
          </div>
          {guest && awaitingGuest && !removeConfirm && (
            <div className="bo-paper-action">
              <p>Have the guest’s signed registration on paper?</p>
              <button
                className="bp-toggle"
                disabled={busy}
                onClick={onPaperRequest}
              >
                Record completed guest paperwork…
              </button>
            </div>
          )}
          {removeConfirm && (
            <div
              className="bo-removal"
              role="group"
              aria-label={removeConfirm.mode === "complete_guest"
                ? "Confirm paper registration"
                : "Confirm guest removal"}
            >
              <h3>
                {removeConfirm.mode === "complete_guest"
                  ? `Record signed paperwork for ${removeConfirm.guest.name}?`
                  : `Remove ${removeConfirm.guest.name}?`}
              </h3>
              {removeConfirm.mode === "complete_guest"
                ? (
                  <p>
                    Confirm you have reviewed the guest’s signed registration
                    and dress-code acknowledgment. Payment, field-trip forms,
                    and attire approval are recorded separately.
                  </p>
                )
                : (
                  <>
                    <p>
                      The cadet keeps their reservation and recorded payment. No
                      refund is issued automatically.
                    </p>
                    <p>
                      Host ticket after removal:{" "}
                      <b>
                        {money(
                          removeConfirm.guest.guest_type === "date"
                            ? removeConfirm.config.price_cadet
                            : removeConfirm.signup.amount_due,
                        ) || "Price unavailable"}
                      </b>
                      <br />Host payment preserved:{" "}
                      <b>{money(ballBalance(removeConfirm.signup).paid)}</b>
                      <br />Host credit for review:{" "}
                      <b>
                        {money(
                          Math.max(
                            0,
                            ballBalance(removeConfirm.signup).paid -
                              Number(
                                removeConfirm.guest.guest_type === "date"
                                  ? removeConfirm.config.price_cadet
                                  : removeConfirm.signup.amount_due,
                              ),
                          ),
                        )}
                      </b>
                      {removeConfirm.guest.guest_type === "friend" && (
                        <>
                          <br />Friend payment for staff review:{" "}
                          <b>
                            {money(
                              getBallPaymentFacts(
                                  removeConfirm.signup,
                                  removeConfirm.guest,
                                ).friendBalance === 0
                                ? removeConfirm.guest.friend_amount_due
                                : 0,
                            )}
                          </b>
                        </>
                      )}
                    </p>
                  </>
                )}
              <button
                className="bp-confirm-yes is-revoke"
                disabled={busy}
                onClick={onRemove}
              >
                {busy
                  ? "Saving…"
                  : removeConfirm.mode === "complete_guest"
                  ? "Confirm signed paperwork"
                  : "Confirm removal"}
              </button>
              <button
                className="bp-confirm-no"
                disabled={busy}
                onClick={onRemoveCancel}
              >
                Cancel
              </button>
            </div>
          )}
          <div className="bp-section-head" style={{ marginBottom: 12 }}>
            Payments and forms
          </div>

          {awaitingGuest && (
            <p className="rv-sub" style={{ margin: "0 0 14px", fontSize: 13 }}>
              Guest registration is pending. You can record payment and receive
              each person’s forms now.
            </p>
          )}
          {confirming
            ? (
              <div
                className="bp-confirm"
                style={{ justifyContent: "flex-start" }}
              >
                <span className="bp-confirm-msg">
                  {confirmTurningOn
                    ? `Mark ${confirmTarget.label} received for ${who}?`
                    : `Revoke ${confirmTarget.label} for ${who}?`}
                </span>
                <button
                  className={`bp-confirm-yes ${
                    confirmTurningOn ? "" : "is-revoke"
                  }`}
                  disabled={busy}
                  onClick={() => onConfirm(r, confirming.field, guest)}
                >
                  {busy ? "Saving…" : confirmTurningOn ? "Confirm" : "Revoke"}
                </button>
                <button
                  className="bp-confirm-no"
                  disabled={busy}
                  onClick={onCancel}
                >
                  Cancel
                </button>
              </div>
            )
            : (
              <div className="bp-options">
                {
                  <button
                    className={`bp-toggle ${r.cash_received ? "is-on" : ""}`}
                    disabled={busy || !!removeConfirm || !!ticketConfirm}
                    onClick={() => onRequestToggle(r, "cash_received")}
                  >
                    {r.cash_received
                      ? "✓ Cash received — tap to revoke"
                      : "Mark cash received"}
                  </button>
                }
                {guest?.guest_type === "friend" && (
                  <button
                    className={`bp-toggle ${
                      guest.friend_cash_received ? "is-on" : ""
                    }`}
                    disabled={busy || !!removeConfirm || !!ticketConfirm}
                    onClick={() => onRequestToggle(r, "friend_cash_received")}
                  >
                    {guest.friend_cash_received
                      ? "✓ Guest's cash received — tap to revoke"
                      : "Mark guest's cash received"}
                  </button>
                )}
                {isBallHostFormRequired(r) && (
                  <button
                    className={`bp-toggle ${
                      r.field_trip_form_received ? "is-on" : ""
                    }`}
                    disabled={busy || !!removeConfirm || !!ticketConfirm}
                    onClick={() =>
                      onRequestToggle(r, "field_trip_form_received")}
                  >
                    {r.field_trip_form_received
                      ? `✓ ${
                        guest ? "Host form" : "Field trip form"
                      } received — tap to revoke`
                      : `Mark ${
                        guest ? "host form" : "field trip form"
                      } received`}
                  </button>
                )}
                {guestNeedsOwnForm && (
                  <button
                    className={`bp-toggle ${
                      guest.field_trip_form_received ? "is-on" : ""
                    }`}
                    disabled={busy || !!removeConfirm || !!ticketConfirm}
                    onClick={() =>
                      onRequestToggle(r, "guest_field_trip_form_received")}
                  >
                    {guest.field_trip_form_received
                      ? "✓ Guest's form received — tap to revoke"
                      : "Mark guest's form received"}
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
