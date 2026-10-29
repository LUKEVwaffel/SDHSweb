import { isBallReceiptEligible } from "../ballTicketEligibility.js";
import { buildBallReceipt } from "./ballReceipts.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guestFormRequired, hostFormRequired, reservationStatus, type Row } from "../ballIntelligence.ts";
import { type PdfPlan, type PdfSection, renderPdf } from "./render.ts";
const string = (description: string) => ({ type: "string", description });
const filters = {
  company: string("Optional exact company, e.g. Alpha"),
  let_level: string("Optional LET level 1, 2, 3 or 4"),
  search: string("Optional name substring"),
};
const tool = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  name,
  description,
  input_schema: {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  },
});
export const PDF_TOOLS = [
  tool(
    "generate_ball_receipts_pdf",
    "Generate one printable PDF packet of ALL eligible Military Ball receipts across every company when no filters are supplied. Use this for 'print all receipts as one' and for receipts that include awaiting/unverified guests; never replace requested receipts with guest-correction slips. One receipt per reservation, all bundled into a single PDF for one print job. ALWAYS exclude reservations already delivered in ball_ticket_deliveries and reservations complete enough to appear in Ticket Delivery, even when exact signup_ids are supplied. A receipt is a follow-up for unfinished reservations, not a ticket. Read all live paginated records and never silently truncate. Unverified guests get a prominent GUEST NOT VERIFIED warning and invitation instructions. Cadet/guest form and attire statuses remain separate; totals show actual recorded payment/balance. No changes, emails or printer submission.",
    {
      ...filters,
      title: string("Optional receipt packet title"),
      signup_ids: {
        type: "array",
        items: { type: "string" },
        maxItems: 200,
        description:
          "Optional exact reservation IDs for eligible unfinished reservations; delivered and ticket-ready bookings are still excluded",
      },

    },
  ),
  tool(
    "generate_roster_pdf",
    "Generate a NEW downloadable print-ready PDF from ALL matching live cadets. No record changes. Company/LET/name filters; alphabetic or company order; roster, blank attendance/sign-in or form-status checklist. Full paginated data, never the 25-row people search.",
    {
      ...filters,
      title: string("Optional document title"),
      layout: { type: "string", enum: ["roster", "attendance", "forms"] },
      team: string("Optional exact team membership"),
      sort_by: { type: "string", enum: ["company", "name"] },
      include_email: {
        type: "boolean",
        description:
          "Only include school email when the admin requests contact details",
      },
      missing_form: {
        type: "string",
        enum: ["any", "consent", "dd3203", "datasheet"],
        description: "Optional filter to cadets missing this roster form",
      },
    },
  ),
  tool(
    "generate_ball_packet_pdf",
    "Generate a NEW single bundled PDF with one personalized follow-up sheet per matching Ball reservation, or a compact checklist/finance/attendance report. awaiting_guest_verification = guest has not verified; missing_guest_forms = required guest field-trip form not received. Unverified/awaiting guest forms or papers means this existing email-correction slip by default, selection awaiting_guest_verification and layout individual_sheets; use missing_guest_forms only for explicitly missing field-trip/permission forms. Unverified guest individual sheets reproduce the established Military Ball Guest Not Yet Verified slip: company banner, commander/cadet instructions, current invitation email, handwritten corrected email/name/date and S-6 return notice. Other selections use follow-up worksheets, not official permission forms. No status changes or email.",
    {
      ...filters,
      title: string("Optional document title"),
      selection: {
        type: "string",
        enum: [
          "awaiting_guest_verification",
          "missing_guest_forms",
          "missing_host_forms",
          "missing_any_forms",
          "unapproved_attire",
          "balance_due",
          "not_ready",
          "all",
        ],
      },
      layout: {
        type: "string",
        enum: ["individual_sheets", "checklist", "finance", "attendance"],
      },
      signup_ids: {
        type: "array",
        items: { type: "string" },
        maxItems: 500,
        description: "Optional exact reservation IDs to restrict the packet",
      },
    },
    ["selection", "layout"],
  ),
  tool(
    "generate_report_pdf",
    "Generate a NEW PDF report directly from a live read-only SELECT query under the signed-in user permissions. Exact column keys/labels, up to 199 rows; 200 results fails explicitly rather than silently truncating. Use dedicated roster/Ball tools for full lists. Supports other Dispatch workflows such as equipment, events, teams and tasks. Never include credentials or verification links.",
    {
      title: string("Document title"),
      query: string(
        "One SELECT or WITH statement, no semicolons; use stable ORDER BY; no LIMIT unless admin explicitly requested a limited selection",
      ),
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: string("Exact selected SQL alias"),
            label: string("Printed column heading"),
          },
          required: ["key", "label"],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 8,
      },
      note: string("Optional factual description of selection"),
      orientation: { type: "string", enum: ["portrait", "landscape"] },
    },
    ["title", "query", "columns"],
  ),
  tool(
    "generate_document_pdf",
    "Compose an original print-ready PDF: briefings, agendas, instructions, checklists, letters, worksheets, summaries or a custom multi-section document. Use verified live tool evidence for current people/statuses/numbers, not invented records. Does not retrieve existing PDFs, send email, sign documents or create official school permission forms. For complete live lists use roster/Ball/report tools.",
    {
      title: string("Title"),
      subtitle: string("Optional subtitle"),
      source_note: string(
        "Explain source: user-provided content, policy, or live lookup and scope",
      ),
      orientation: { type: "string", enum: ["portrait", "landscape"] },
      sections: {
        type: "array",
        minItems: 1,
        maxItems: 80,
        items: {
          type: "object",
          properties: {
            heading: string("Optional heading"),
            text: string("Plain text paragraphs, not HTML/Markdown"),
            columns: { type: "array", items: { type: "string" }, maxItems: 8 },
            rows: {
              type: "array",
              items: { type: "array", items: { type: "string" } },
              maxItems: 200,
            },
            checklist: {
              type: "array",
              items: { type: "string" },
              maxItems: 100,
            },
            writing_lines: { type: "integer", minimum: 0, maximum: 20 },
            writing_label: string(
              "Label above writing space, e.g. Notes, Corrected email, Signature",
            ),
            page_break: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
    },
    ["title", "source_note", "sections"],
  ),
];
export function pdfToolsForRole(role: string) {
  return PDF_TOOLS.filter((t) =>
    role === "s6" ||
    ![
      "generate_roster_pdf",
      "generate_ball_packet_pdf",
      "generate_ball_receipts_pdf",
    ].includes(t.name)
  );
}
const value = (s: unknown) =>
  s == null || s === ""
    ? "Not on file"
    : typeof s === "boolean"
    ? (s ? "Yes" : "No")
    : String(s);
const txt = (input: Row, key: string) =>
  typeof input[key] === "string" ? String(input[key]).trim() : "";
export function normalizedCompany(s: unknown) {
  return String(s ?? "").toLowerCase().replace(/\bcompany\b/g, "").replace(
    /[^a-z]/g,
    "",
  );
}
export function normalizedLet(s: unknown) {
  return String(s ?? "").toLowerCase().replace(/[^0-9]/g, "");
}
export function matchesFilters(row: Row, input: Row, ball = false) {
  const company = txt(input, "company"),
    letLevel = txt(input, "let_level"),
    search = txt(input, "search").toLowerCase();
  if (letLevel && !/^(?:LET\s*)?[1-4]$/i.test(letLevel)) {
    throw new Error("LET level must be 1, 2, 3 or 4");
  }
  return (!company ||
    normalizedCompany(row[ball ? "cadet_company" : "company"]) ===
      normalizedCompany(company)) &&
    (!letLevel ||
      normalizedLet(row[ball ? "cadet_let_level" : "let_level"]) ===
        normalizedLet(letLevel)) &&
    (!search ||
      String(row[ball ? "cadet_name" : "name"]).toLowerCase().includes(search));
}
async function readAll(scoped: SupabaseClient, table: string, columns: string, orderColumn = "id") {
  const rows: Row[] = [];
  for (let offset = 0; offset <= 5000; offset += 500) {
    const { data, error } = await scoped.from(table).select(columns).order(orderColumn)
      .range(offset, offset + 499);
    if (error) throw error;
    if (offset === 5000 && data?.length) {
      throw new Error(
        "More than 5,000 records; narrow the selection. No partial PDF was generated.",
      );
    }
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < 500) return rows;
  }
  return rows;
}
const form = (required: unknown, received: unknown) =>
  required === false
    ? "Not required"
    : received === true
    ? "Received"
    : required === true
    ? "MISSING"
    : "REQUIREMENT UNKNOWN";
const money = (v: unknown) =>
  v == null ? "Unknown" : `$${Number(v).toFixed(2)}`;
const order = (a: Row, b: Row, ball = false) =>
  String(a[ball ? "cadet_company" : "company"] ?? "").localeCompare(
    String(b[ball ? "cadet_company" : "company"] ?? ""),
  ) ||
  String(a[ball ? "cadet_name" : "name"]).localeCompare(
    String(b[ball ? "cadet_name" : "name"]),
  );
const privateKey = /(token|password|secret|credential|pin_hash|access_key)/i;
const rosterFormMissing = (v: unknown) => v !== "collected";
export function ballSelected(
  selection: string,
  host: Row,
  guest?: Row,
): boolean {
  switch (selection) {
    case "awaiting_guest_verification":
      return !!guest && !guest.verified_at;
    case "missing_guest_forms":
      return !!guest && guestFormRequired(guest) && guest.field_trip_form_received !== true;
    case "missing_host_forms":
      return hostFormRequired(host) && host.field_trip_form_received !== true;
    case "missing_any_forms":
      return ballSelected("missing_guest_forms", host, guest) ||
        ballSelected("missing_host_forms", host, guest);
    case "unapproved_attire":
      return reservationStatus(host, guest).issues.some((i) =>
        i.includes("dress_unapproved") || i.includes("attire_unapproved")
      );
    case "balance_due": {
      const s = reservationStatus(host, guest);
      return Number(s.payment.balance) > 0 ||
        Number(s.friend_payment?.balance) > 0;
    }
    case "not_ready":
      return !reservationStatus(host, guest).attendance_requirements_complete;
    case "all":
      return true;
    default:
      throw new Error("Choose a supported Ball selection");
  }
}
function none(rows: unknown[]) {
  if (!rows.length) {
    throw new Error(
      "No matching accessible records. No empty PDF was generated.",
    );
  }
}
function scope(input: Row) {
  return [
    txt(input, "company") && `${txt(input, "company")} company`,
    txt(input, "let_level") && `LET ${normalizedLet(input.let_level)}`,
    txt(input, "search") && `Name contains "${txt(input, "search")}"`,
  ].filter(Boolean).join(" / ") || "All accessible records";
}
export async function buildPdfPlan(
  name: string,
  input: Row,
  scoped: SupabaseClient,
  role: string,
): Promise<PdfPlan> {
  if (!pdfToolsForRole(role).some((t) => t.name === name)) {
    throw new Error("This PDF tool is not available to your role");
  }
  if (name === "generate_roster_pdf") {
    let rows = (await readAll(
      scoped,
      "cadet_consent",
      "id,name,company,school_email,let_level,grade,cadet_rank,consent_status,dd3203_status,datasheet_status",
    )).filter((r) => matchesFilters(r, input));
    const team = txt(input, "team");
    if (team) {
      const memberships = await readAll(
        scoped,
        "cadet_teams",
        "id,cadet_consent_id,team",
      );
      const ids = new Set(
        memberships.filter((r) =>
          String(r.team).toLowerCase() === team.toLowerCase()
        ).map((r) => r.cadet_consent_id),
      );
      rows = rows.filter((r) => ids.has(r.id));
    }
    const missing = txt(input, "missing_form");
    const formKeys: Record<string, string> = {
      consent: "consent_status",
      dd3203: "dd3203_status",
      datasheet: "datasheet_status",
    };
    if (missing) {
      if (!["any", ...Object.keys(formKeys)].includes(missing)) {
        throw new Error("Unknown roster form filter");
      }
      rows = rows.filter((r) =>
        missing === "any"
          ? Object.values(formKeys).some((k) => rosterFormMissing(r[k]))
          : rosterFormMissing(r[formKeys[missing]])
      );
    }
    rows.sort(
      input.sort_by === "name"
        ? (a, b) => String(a.name).localeCompare(String(b.name))
        : (a, b) => order(a, b),
    );
    none(rows);
    const layout = txt(input, "layout") || "roster";
    if (!["roster", "attendance", "forms"].includes(layout)) {
      throw new Error("Unknown roster layout");
    }
    const columns = ["#", "Cadet", "Company", "LET"];
    const widths = [.4, 2.4, 1.1, .5];
    if (layout === "forms") {
      columns.push("Photo consent", "DD 3203", "Datasheet");
      widths.push(1.1, 1, 1);
    }
    if (layout === "attendance") {
      columns.push("Present / signature");
      widths.push(2.6);
    }
    if (input.include_email === true) {
      columns.push("School email");
      widths.push(2.6);
    }
    const body = rows.map((r, i) => {
      const cells = [
        String(i + 1),
        value(r.name),
        value(r.company),
        value(r.let_level),
      ];
      if (layout === "forms") {
        cells.push(
          value(r.consent_status),
          value(r.dd3203_status),
          value(r.datasheet_status),
        );
      }
      if (layout === "attendance") cells.push("______________________");
      if (input.include_email === true) cells.push(value(r.school_email));
      return cells;
    });
    const source = `Live cadet roster${team ? `; team ${team}` : ""}${
      missing ? `; missing ${missing} form(s)` : ""
    }. ${scope(input)}. ${rows.length} cadets.`;
    return {
      title: txt(input, "title") ||
        `${scope(input)} - ${
          layout === "forms"
            ? "Form checklist"
            : layout === "attendance"
            ? "Attendance"
            : "Cadet roster"
        }`,
      subtitle: source,
      source,
      record_count: rows.length,
      orientation: layout === "forms" || input.include_email === true
        ? "landscape"
        : "portrait",
      sections: [{ columns, widths, rows: body }],
    };
  }
  if (
    name === "generate_ball_packet_pdf" || name === "generate_ball_receipts_pdf"
  ) {
    const {data:snapshot,error:snapshotError}=await scoped.rpc("ball_ticket_snapshot");
    if(snapshotError || !snapshot?.version) throw new Error("Could not read the current Ball ledger. No PDF was generated.");
    const hosts:Row[]=snapshot.hosts, guests:Row[]=snapshot.guests;
    if (name === "generate_ball_receipts_pdf") {
      if (input.completed_only === true) throw new Error("Completed reservations do not receive receipts. Use Ticket Delivery instead.");
      const deliveries:Row[]=snapshot.deliveries;
      const deliveriesByHost = new Map(deliveries.map(delivery => [delivery.signup_id, delivery]));
      if (
        input.signup_ids &&
        (!Array.isArray(input.signup_ids) || input.signup_ids.length > 200 ||
          input.signup_ids.some((id) => typeof id !== "string"))
      ) throw new Error("Use at most 200 exact reservation IDs");
      const selectedIds = Array.isArray(input.signup_ids)
        ? new Set(input.signup_ids)
        : null;
      const guestsByHost = new Map(guests.map((g) => [g.signup_id, g]));
      const receipts = hosts.filter((h) =>
        matchesFilters(h, input, true) &&
        (!selectedIds || selectedIds.has(h.id)) &&
        isBallReceiptEligible(h, guestsByHost.get(h.id), deliveriesByHost.get(h.id))
      ).sort(
        (a, b) => order(a, b, true),
      ).map((h) => buildBallReceipt(h, guestsByHost.get(h.id)));
      if (!receipts.length) throw new Error("No eligible unfinished reservations need receipts in this selection. Delivered tickets and complete Ticket Delivery reservations are excluded.");
      const receiptScope = selectedIds ? "Selected reservations" : scope(input) === "All accessible records" ? "All companies" : scope(input);
      return {
        title: txt(input, "title") ||
          `${receiptScope} - Military Ball Receipts`,
        source: `Live Military Ball ledger and attendance requirements. ${receiptScope}. ${receipts.length} eligible unfinished reservations in one print packet. Delivered tickets and complete Ticket Delivery reservations excluded.`,
        record_count: receipts.length,
        sections: [],
        ball_receipts: receipts,
        generated_at: snapshot.checked_at,
        ball_snapshot_version: snapshot.version,
        receipt_filters: Object.fromEntries(["company","let_level","search","signup_ids","title"].filter(key=>input[key]!=null).map(key=>[key,input[key]])),
      };
    }
    const selection = txt(input, "selection"), layout = txt(input, "layout");
    if (
      !["individual_sheets", "checklist", "finance", "attendance"].includes(
        layout,
      )
    ) throw new Error("Choose a supported Ball layout");
    const byHost = new Map(guests.map((g) => [g.signup_id, g]));
    if (
      input.signup_ids &&
      (!Array.isArray(input.signup_ids) || input.signup_ids.length > 500)
    ) throw new Error("Use at most 500 exact signup IDs");
    const ids = Array.isArray(input.signup_ids)
      ? new Set(input.signup_ids)
      : null;
    const rows = hosts.filter((h) =>
      matchesFilters(h, input, true) && (!ids || ids.has(h.id)) &&
      ballSelected(selection, h, byHost.get(h.id))
    ).sort((a, b) => order(a, b, true));
    none(rows);
    const labels: Record<string, string> = {
      awaiting_guest_verification: "Guests awaiting verification",
      missing_guest_forms: "Missing guest field-trip paperwork",
      missing_host_forms: "Missing cadet field-trip paperwork",
      missing_any_forms: "Outstanding Ball field-trip paperwork",
      unapproved_attire: "Ball attire follow-up",
      balance_due: "Ball outstanding balances",
      not_ready: "Ball readiness follow-up",
      all: "Ball reservations",
    };
    const title = txt(input, "title") || labels[selection];
    const source = `Live Ball reservations. ${
      scope(input)
    }. ${rows.length} reservations selected: ${labels[selection]}.`;
    if (
      selection === "awaiting_guest_verification" &&
      layout === "individual_sheets"
    ) {
      return {
        title: txt(input, "title") ||
          "Guest Not Yet Verified - Email Correction Slips",
        source,
        record_count: rows.length,
        sections: [],
        guest_verification_slips: rows.map((host) => ({
          companyLabel: String(host.cadet_company || "No company on file"),
          cadetName: String(host.cadet_name || "Not on file"),
          letLevel: String(host.cadet_let_level || ""),
          guestName: String(byHost.get(host.id)?.name || "Not on file"),
          sentTo: String(
            byHost.get(host.id)?.personal_email || "no email on file",
          ),
        })),
      };
    }
    let sections: PdfSection[];
    if (layout === "individual_sheets") {
      if (rows.length > 200) {
        throw new Error(
          "More than 200 individual sheets; filter by company or use a checklist",
        );
      }
      sections = rows.map((host, i) => {
        const guest = byHost.get(host.id);
        const s = reservationStatus(host, guest);
        const awaiting = selection === "awaiting_guest_verification";
        const text = awaiting
          ? `Deliver this sheet to ${value(host.cadet_name)}. Your guest, ${
            value(guest?.name)
          }, has not completed verification. Confirm the invitation address below, ask your guest to check their inbox and spam folder, and contact S-6 if the invitation needs to be resent.`
          : selection.includes("forms")
          ? `Deliver this follow-up sheet to ${
            value(host.cadet_name)
          }. The required paperwork listed as MISSING below has not been recorded as received. Obtain the official school form from staff, complete it with all required signatures, and return it to S-6. This sheet is a tracking worksheet and does not replace the official permission form.`
          : `Deliver this follow-up sheet to ${
            value(host.cadet_name)
          }. Review the outstanding items below with S-6. This worksheet does not change the reservation or confirm any payment.`;
        const details = [
          ["Cadet", value(host.cadet_name)],
          [
            "Company / LET",
            `${value(host.cadet_company)} / ${value(host.cadet_let_level)}`,
          ],
          ["Guest", guest ? value(guest.name) : "No guest"],
          [
            "Guest verification",
            guest
              ? (guest.verified_at ? "Verified" : "AWAITING VERIFICATION")
              : "Not applicable",
          ],
          [
            "Host field-trip form",
            form(host.field_trip_form_required, host.field_trip_form_received),
          ],
          [
            "Guest field-trip form",
            guest
              ? form(
                guest.field_trip_form_required,
                guest.field_trip_form_received,
              )
              : "Not applicable",
          ],
        ];
        if (awaiting) {
          details.push([
            "Guest invitation address",
            value(guest?.personal_email),
          ]);
        }
        if (selection === "balance_due") {
          details.push([
            "Host balance / credit",
            `${money(s.payment.balance)} / ${money(s.payment.credit)}`,
          ], [
            "Separate friend balance",
            s.friend_payment
              ? money(s.friend_payment.balance)
              : "Not applicable",
          ]);
        }
        if (selection === "unapproved_attire" || selection === "not_ready") {
          details.push([
            "Outstanding items",
            s.issues.join(", ").replace(/_/g, " ") || "None",
          ]);
        }
        return {
          page_break: i > 0,
          heading: `${value(host.cadet_company)} company - ${
            value(host.cadet_name)
          }`,
          text,
          columns: ["Reservation detail", "Current record"],
          widths: [1, 2],
          rows: details,
          checklist: [
            "Delivered to cadet",
            "Reviewed with guest / parent as needed",
            "Returned to S-6 for follow-up",
          ],
          writing_lines: 2,
          writing_label: awaiting
            ? "Corrected guest email / notes (if needed)"
            : "Notes / staff follow-up",
        };
      });
    } else if (layout === "finance") {
      sections = [{
        text:
          "Ledger balances only. Amount due is the ticket total; outstanding balance is total minus recorded payment. Unknown amounts remain Unknown. Friend charges are separate; date charges are included in the host total. Credits require staff review, not an automatic refund.",
        columns: [
          "Cadet / company",
          "Guest",
          "Host total",
          "Host paid",
          "Host balance",
          "Credit",
          "Friend balance",
        ],
        widths: [2.3, 1.8, 1, 1, 1, 1, 1],
        rows: rows.map((h) => {
          const g = byHost.get(h.id), s = reservationStatus(h, g);
          return [
            `${value(h.cadet_name)} / ${value(h.cadet_company)}`,
            g ? value(g.name) : "-",
            money(s.payment.total),
            money(s.payment.paid),
            money(s.payment.balance),
            money(s.payment.credit),
            s.friend_payment ? money(s.friend_payment.balance) : "-",
          ];
        }),
      }];
    } else if (layout === "attendance") {
      sections = [{
        columns: ["Cadet", "Company / LET", "Guest", "Checked in / signature"],
        widths: [2, 1.2, 2, 2],
        rows: rows.map(
          (h) => [
            value(h.cadet_name),
            `${value(h.cadet_company)} / ${value(h.cadet_let_level)}`,
            value(byHost.get(h.id)?.name),
            "________________",
          ],
        ),
      }];
    } else {sections = [{
        columns: [
          "Cadet / company",
          "Guest",
          "Guest verified",
          "Host form",
          "Guest form",
          "Outstanding items",
        ],
        widths: [2, 1.7, 1, 1, 1, 2.7],
        rows: rows.map((h) => {
          const g = byHost.get(h.id), s = reservationStatus(h, g);
          return [
            `${value(h.cadet_name)} / ${value(h.cadet_company)}`,
            g ? value(g.name) : "-",
            g ? (g.verified_at ? "Yes" : "AWAITING") : "N/A",
            form(h.field_trip_form_required, h.field_trip_form_received),
            g
              ? form(g.field_trip_form_required, g.field_trip_form_received)
              : "N/A",
            s.issues.join(", ").replace(/_/g, " ") || "None",
          ];
        }),
      }];}
    return {
      title,
      subtitle: `${rows.length} reservations / ${scope(input)}`,
      source,
      record_count: rows.length,
      orientation: ["checklist", "finance"].includes(layout)
        ? "landscape"
        : "portrait",
      sections: [{ text: source }, ...sections],
    };
  }
  if (name === "generate_report_pdf") {
    const query = txt(input, "query");
    if (!/^(select\b|with\b)/i.test(query) || query.includes(";")) {
      throw new Error("A single read-only SELECT or WITH query is required");
    }
    const columns = input.columns as { key: string; label: string }[];
    if (
      !Array.isArray(columns) || !columns.length || columns.length > 8 ||
      columns.some((c) => !c.key || !c.label || privateKey.test(c.key))
    ) throw new Error("Use 1 to 8 named, non-secret columns");
    const { data, error } = await scoped.rpc("run_admin_query", {
      query,
      row_limit: 200,
    });
    if (error) throw error;
    const rows = data as Row[];
    none(rows);
    if (rows.length >= 200) {
      throw new Error(
        "Report reached the 200-row query ceiling. Use a dedicated full-list PDF tool or narrow the query. No partial PDF was generated.",
      );
    }
    if (rows.some((r) => Object.keys(r).some((k) => privateKey.test(k)))) {
      throw new Error(
        "Query returned sensitive fields. Select only the exact printable fields.",
      );
    }
    if (rows.some((r) => columns.some((c) => !(c.key in r)))) {
      throw new Error("A printed column key is missing from the query result");
    }
    const source = `Live authorized database query. ${rows.length} rows. ${
      txt(input, "note")
    }`;
    return {
      title: txt(input, "title"),
      subtitle: txt(input, "note") || `${rows.length} matching records`,
      source,
      record_count: rows.length,
      orientation: input.orientation === "landscape" ? "landscape" : "portrait",
      sections: [{ text: source }, {
        columns: columns.map((c) => c.label),
        rows: rows.map((r) =>
          columns.map((c) =>
            typeof r[c.key] === "object" && r[c.key] !== null
              ? JSON.stringify(r[c.key])
              : value(r[c.key])
          )
        ),
      }],
    };
  }
  if (name === "generate_document_pdf") {
    if (!txt(input, "source_note")) {
      throw new Error("State the source of this document");
    }
    const sections = input.sections as PdfSection[];
    if (!Array.isArray(sections) || !sections.length || sections.length > 80) {
      throw new Error("Use 1 to 80 document sections");
    }
    for (const section of sections) {
      if (section.rows && section.rows.length > 200) {
        throw new Error(
          "Custom tables allow at most 200 rows; use a live list tool",
        );
      }
      if (section.checklist && section.checklist.length > 100) {
        throw new Error("Too many checklist items");
      }
    }
    return {
      title: txt(input, "title"),
      subtitle: txt(input, "subtitle"),
      source: txt(input, "source_note"),
      orientation: input.orientation === "landscape" ? "landscape" : "portrait",
      sections: [{ text: `Source: ${txt(input, "source_note")}` }, ...sections],
    };
  }
  throw new Error("Unknown PDF tool");
}
export async function generatePdf(
  name: string,
  input: Row,
  scoped: SupabaseClient,
  role: string,
) {
  return renderPdf(await buildPdfPlan(name, input, scoped, role));
}
