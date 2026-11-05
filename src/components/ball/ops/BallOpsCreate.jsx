import { useEffect, useRef, useState } from "react";
import { ballOpsFunction, opsRequest } from "../../../lib/ballOpsApi";
import { openBallOpsPacket } from "../../../lib/ballOpsPacket";
export default function BallOpsCreate({ onBack, onCreated }) {
  const requestId = useRef(crypto.randomUUID());
  const [prices, setPrices] = useState(null);
  const [priceError, setPriceError] = useState("");
  const [pricingBusy, setPricingBusy] = useState(true);
  const [step, setStep] = useState(1),
    [query, setQuery] = useState(""),
    [cadets, setCadets] = useState([]),
    [cadet, setCadet] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [packet, setPacket] = useState(null),
    [searching, setSearching] = useState(false),
    [delivery, setDelivery] = useState("print"),
    [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    gender: "",
    guest_type: "none",
    guest_name: "",
    guest_gender: "",
    guest_email: "",
    guest_school: "",
    amount_paid: "0",
    host_form: false,
    guest_form_required: true,
    guest_form: false,
    guest_paid: false,
    guest_complete: false,
  });
  async function loadPrices() {
    setPricingBusy(true);
    try {
      const p = await opsRequest({ action: "pricing" });
      if (
        ![p.price_cadet, p.price_couple].every((v) =>
          v != null && Number.isFinite(Number(v)) && Number(v) >= 0
        )
      ) {
        throw new Error(
          "Ticket prices are not configured. Ask S-6 to set them before creating a reservation.",
        );
      }
      setPrices(p);
      setPriceError("");
    } catch (e) {
      setPrices(null);
      setPriceError(e.message);
    } finally {
      setPricingBusy(false);
    }
  }
  useEffect(() => {
    loadPrices();
  }, []);
  const patch = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    let active = true;
    setCadets([]);
    if (query.trim().length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    setError("");
    const timer = setTimeout(
      () =>
        opsRequest({ action: "search", query }).then((d) => {
          if (active) setCadets(d.cadets || []);
        }).catch((e) => {
          if (active) setError(e.message);
        }).finally(() => {
          if (active) setSearching(false);
        }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  const check = (key, label) => (
    <label className="bo-check">
      <input
        type="checkbox"
        checked={form[key]}
        onChange={(e) => patch(key, e.target.checked)}
      />
      {label}
    </label>
  );
  async function sendInvite() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await ballOpsFunction("ball-resend-guest-invite", {
        signup_id: packet.signup.id,
        guest_id: packet.guest.id,
        expected_email: packet.guest.personal_email,
      });
      setNotice("Guest invitation sent.");
    } catch (e) {
      setError(
        `Reservation saved. Email was not confirmed: ${e.message}. Retry or print the packet.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function printPacket() {
    const win = window.open("", "_blank");
    setBusy(true);
    setError("");
    try {
      if (!win) throw new Error("Allow popups to print the packet.");
      win.document.write("<p>Loading current receipt…</p>");
      openBallOpsPacket(
        await opsRequest({ action: "packet", signup_id: packet.signup.id }),
        win,
      );
    } catch (e) {
      win?.close();
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const data = await opsRequest({
        action: "create",
        ...form,
        request_id: requestId.current,
        expected_friend_price: form.guest_type === "friend"
          ? prices.price_cadet
          : null,
        expected_price: form.guest_type === "date"
          ? prices.price_couple
          : prices.price_cadet,
        guest_email: delivery === "email" ? form.guest_email : "",
        cadet_id: cadet.id,
      });
      setPacket(data);
      await onCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rv-panel bo-create">
      <button className="rv-back" onClick={onBack} disabled={busy}>
        ‹ Back to reservations
      </button>
      <h1 className="rv-h1">
        {packet ? "Reservation created" : "Create reservation"}
      </h1>
      {error && <p role="alert" className="bo-error">{error}</p>}
      {!prices && !packet && (
        <div className="bo-price-status">
          <p
            role={priceError ? "alert" : "status"}
            className={priceError ? "bo-error" : ""}
          >
            {priceError || "Loading ticket prices…"}
          </p>
          {priceError && (
            <button
              className="bp-refresh"
              disabled={pricingBusy}
              onClick={loadPrices}
            >
              {pricingBusy ? "Checking setup…" : "Retry loading ticket prices"}
            </button>
          )}
        </div>
      )}

      {notice && <p role="status">{notice}</p>}
      {packet
        ? (
          <>
            <p>
              {packet.signup.cadet_name}{" "}
              is on the reservation list. Print the receipt and instructions for
              each attendee.
            </p>
            <div className="bp-options">
              <button
                className="bp-toggle"
                disabled={busy}
                onClick={printPacket}
              >
                Print receipt & instruction packet / Save PDF
              </button>
              {packet.guest?.personal_email && (
                <button
                  className="bp-toggle"
                  disabled={busy}
                  onClick={sendInvite}
                >
                  {busy ? "Sending…" : "Send / retry guest invitation"}
                </button>
              )}
            </div>
          </>
        )
        : (
          <>
            <p className="rv-sub">
              Step {step} of 3 · {[
                "Find cadet",
                "Guest and paperwork",
                "Review and create",
              ][step - 1]}
            </p>
            {step === 1
              ? (
                <>
                  <label>
                    Cadet’s name<input
                      className="bp-search"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setCadet(null);
                      }}
                      autoFocus
                      placeholder="Start typing a name"
                    />
                  </label>
                  {searching && query.length >= 2 && (
                    <p role="status">Searching roster…</p>
                  )}
                  {!searching && !error && query.trim().length >= 2 &&
                    !cadets.length && <p>No cadets found.</p>}
                  <div className="bo-results">
                    {cadets.map((c) => (
                      <button
                        className={`bp-toggle ${
                          cadet?.id === c.id ? "is-on" : ""
                        }`}
                        key={c.id}
                        onClick={() => setCadet(c)}
                      >
                        {c.name} · LET {c.let_level || "—"} ·{" "}
                        {c.company || "No company"}
                      </button>
                    ))}
                  </div>
                  {cadet && (
                    <p>
                      Selected: <b>{cadet.name}</b>
                    </p>
                  )}
                  <button
                    className="bp-confirm-yes"
                    disabled={!cadet}
                    onClick={() => setStep(2)}
                  >
                    Continue
                  </button>
                </>
              )
              : null}
            {step === 2
              ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setStep(3);
                  }}
                  className="bo-fields"
                >
                  <label>
                    Cadet’s gender<select
                      required
                      value={form.gender}
                      onChange={(e) => patch("gender", e.target.value)}
                    >
                      <option value="">Choose for attire instructions</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </label>
                  <label>
                    Add a guest?<select
                      value={form.guest_type}
                      onChange={(e) => {
                        patch("guest_type", e.target.value);
                        patch("guest_paid", false);
                      }}
                    >
                      <option value="none">No guest</option>
                      <option value="date">Date · couple ticket</option>
                      <option value="friend">Friend · separate ticket</option>
                    </select>
                  </label>
                  {form.guest_type !== "none" && (
                    <>
                      <label>
                        Guest’s name<input
                          required
                          value={form.guest_name}
                          onChange={(e) => patch("guest_name", e.target.value)}
                        />
                      </label>
                      <label>
                        Guest’s gender<select
                          required
                          value={form.guest_gender}
                          onChange={(e) =>
                            patch("guest_gender", e.target.value)}
                        >
                          <option value="">
                            Choose for attire instructions
                          </option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </label>
                      <label>
                        Guest instructions<select
                          value={delivery}
                          onChange={(e) => setDelivery(e.target.value)}
                        >
                          <option value="print">
                            Print packet · no email needed
                          </option>
                          <option value="email">
                            Email invitation + printable packet
                          </option>
                        </select>
                      </label>
                      {delivery === "email" && (
                        <label>
                          Guest’s personal email<input
                            type="email"
                            required
                            value={form.guest_email}
                            onChange={(e) =>
                              patch("guest_email", e.target.value)}
                          />
                        </label>
                      )}
                      {check(
                        "guest_form_required",
                        "Guest attends SDHS / requires field trip form",
                      )}
                      {!form.guest_form_required && (
                        <label>
                          Guest’s school (or “Not currently a student”)<input
                            required
                            value={form.guest_school}
                            onChange={(e) =>
                              patch("guest_school", e.target.value)}
                          />
                        </label>
                      )}
                      {check(
                        "guest_form",
                        "Guest’s signed field trip form received",
                      )}
                      {form.guest_type === "friend" &&
                        check(
                          "guest_paid",
                          "Friend’s separate ticket paid in full",
                        )}
                      {check(
                        "guest_complete",
                        "Guest’s registration and dress-code acknowledgment completed on paper",
                      )}
                      <p className="rv-sub">
                        Mark registration complete only after reviewing signed
                        guest paperwork. This does not grant attire approval.
                      </p>
                    </>
                  )}
                  <label>
                    Host payment already received ($){form.guest_type === "date"
                      ? " · combined couple payment"
                      : ""}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.amount_paid}
                      onChange={(e) => patch("amount_paid", e.target.value)}
                    />
                  </label>
                  {check(
                    "host_form",
                    "Cadet’s signed field trip form received",
                  )}
                  <div className="bp-options">
                    <button
                      type="button"
                      className="bp-confirm-no"
                      onClick={() => setStep(1)}
                    >
                      Back
                    </button>
                    <button className="bp-confirm-yes">
                      Review reservation
                    </button>
                  </div>
                </form>
              )
              : null}
            {step === 3 && (
              <>
                <h2>{cadet.name}</h2>
                <p>
                  Host ticket total: ${prices
                    ? Number(
                      form.guest_type === "date"
                        ? prices.price_couple
                        : prices.price_cadet,
                    ).toFixed(2)
                    : "—"}
                  {form.guest_type === "friend" && (
                    <>
                      · Friend’s separate ticket: ${Number(prices?.price_cadet)
                        .toFixed(2)}
                    </>
                  )}
                </p>
                <p>
                  {form.guest_type === "none"
                    ? "Solo reservation"
                    : `${form.guest_type}: ${form.guest_name} · ${
                      delivery === "email"
                        ? form.guest_email
                        : "Printed instructions"
                    }`}
                </p>
                <p>
                  Host payment received: ${Number(form.amount_paid).toFixed(2)}
                  <br />Cadet form:{" "}
                  {form.host_form ? "Received" : "Outstanding"}
                </p>
                {form.guest_type !== "none" && (
                  <p>
                    Guest form: {form.guest_form
                      ? "Received"
                      : form.guest_form_required
                      ? "Outstanding"
                      : "Not required"}
                    <br />Guest registration:{" "}
                    {form.guest_complete ? "Completed on paper" : "Pending"}
                    {form.guest_type === "friend" && (
                      <>
                        <br />Friend payment:{" "}
                        {form.guest_paid ? "Received in full" : "Outstanding"}
                      </>
                    )}
                  </p>
                )}
                <p>
                  Ticket prices come from current Ball settings. Attire approval
                  remains with the attire staff. You can print and send the
                  invitation after saving.
                </p>
                <div className="bp-options">
                  <button
                    className="bp-confirm-no"
                    disabled={busy}
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                  <button
                    className="bp-confirm-yes"
                    disabled={busy || !prices}
                    onClick={save}
                  >
                    {busy ? "Creating…" : "Create reservation"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
    </section>
  );
}
