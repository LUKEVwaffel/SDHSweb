// Edge function: rifle-comp-parse
// Rifle Portal score import — AI FALLBACK ONLY. Spreadsheets/CSVs/pastes
// with real headers are read deterministically in the browser
// (src/components/rifle/portal/import/); this function only sees what that
// reader couldn't handle: ragged text, text pulled from a PDF, a scanned
// PDF, or a photo of a printed sheet. Claude extracts per-shooter rows,
// matched against the roster, and the result lands in rifle_comp_uploads as
// status='pending_review' — nothing touches rifle_scores/rifle_shooters
// here; review/publish stays a client-side write gated by rifle_scores' own
// RLS (is_rifle_admin() or is_s6()). Only STARTING an AI read is limited to
// RIFLE_UPLOAD_ALLOWLIST (it spends API credit), per the coach's request.
//
// Body: { raw_csv: string, source_name? }                      — text
//    or { file_base64, media_type, source_name? }              — image/PDF
//
// Secrets (set with `supabase secrets set`, NEVER in .env / client bundle):
//   ANTHROPIC_API_KEY   required (shared with analyze-event-feedback)
// Deploy WITH jwt verification (default).
import Anthropic from "npm:@anthropic-ai/sdk@^0.131.0";
import { json, preflight } from "../_shared/http.ts";
import { serviceClient, getRifleAdmin } from "../_shared/supabase.ts";
import { RIFLE_UPLOAD_ALLOWLIST } from "../_shared/rifleUploaders.ts";

const MODEL = "claude-opus-5-5";
const MAX_TEXT_CHARS = 60000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 300;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const SCORE_KEYS = ["prone", "standing", "kneeling", "total", "bulls"] as const;

const SYSTEM_PROMPT = `You extract rifle-team match scores from a score sheet. The sheet may be a CSV, text copied from a PDF or spreadsheet with ragged columns, a scanned PDF, or a photo of a printed sheet.

For each individual shooter, extract their name exactly as written and whichever of these are present: prone, standing, kneeling (position scores, often decimals like 96.4), total (the shooter's aggregate), bulls (the X / inner-ten / bull's-eye count, a whole number). Use null for anything not on the sheet — never invent a 0, never compute a value that isn't written. Values like "96-4X" mean score 96 with 4 X's. Skip team totals, averages, headers and other non-shooter rows. If the sheet covers several weeks or matches, extract only the most recent one and say so in notes.

You are also given the team's current roster. Set matched_shooter_name to the roster name a row most likely refers to (nicknames, misspellings, reversed "Last, First", initials) when reasonably confident, otherwise null. Never return a name that is not on the roster. Shooters from other schools will not be on the roster — leave them null.

notes: one or two sentences on anything ambiguous, unreadable or skipped; empty string if none.`;

const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rows", "notes"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["raw_name", "matched_shooter_name", ...SCORE_KEYS],
        properties: {
          raw_name: { type: "string" },
          matched_shooter_name: { anyOf: [{ type: "string" }, { type: "null" }] },
          prone: nullableNumber, standing: nullableNumber, kneeling: nullableNumber, total: nullableNumber, bulls: nullableNumber,
        },
      },
    },
    notes: { type: "string" },
  },
};

type Row = { raw_name: string; matched_shooter_name: string | null } & Record<typeof SCORE_KEYS[number], number | null>;

// Never trust model output shape blindly: coerce, bound, and drop anything
// that isn't a usable row before it's stored for review.
function sanitize(parsed: unknown, roster: string[]): { rows: Row[]; notes: string } {
  const obj = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
  const rosterSet = new Set(roster);
  const rawRows = Array.isArray(obj.rows) ? obj.rows.slice(0, MAX_ROWS) : [];
  const rows: Row[] = [];
  for (const r of rawRows) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const raw_name = String(rec.raw_name ?? "").trim().slice(0, 120);
    if (!raw_name) continue;
    const matched = typeof rec.matched_shooter_name === "string" && rosterSet.has(rec.matched_shooter_name) ? rec.matched_shooter_name : null;
    const row = { raw_name, matched_shooter_name: matched } as Row;
    for (const k of SCORE_KEYS) {
      const n = typeof rec[k] === "number" ? rec[k] as number : Number.NaN;
      row[k] = Number.isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * 10) / 10 : null;
    }
    if (SCORE_KEYS.some((k) => row[k] != null)) rows.push(row);
  }
  return { rows, notes: typeof obj.notes === "string" ? obj.notes.slice(0, 600) : "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getRifleAdmin(req);
    if (!caller) return json({ error: "Not signed in as a rifle admin — sign out and back in." }, 403);
    if (caller.mustChangePassword) return json({ error: "Set a new password first (password_change_required)." }, 403);
    if (!RIFLE_UPLOAD_ALLOWLIST.includes(caller.email)) {
      return json({ error: "AI reading is limited to Kaz and Luke. Spreadsheets/CSVs with headers still import without it." }, 403);
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "Request body must be JSON." }, 400);
    const sourceName = String(body.source_name ?? "").slice(0, 200) || null;

    let content: Anthropic.ContentBlockParam[];
    let rawSnapshot: string;
    if (typeof body.raw_csv === "string") {
      const text = body.raw_csv.trim();
      if (!text) return json({ error: "Nothing to read — the text is empty." }, 400);
      if (text.length > MAX_TEXT_CHARS) return json({ error: `Too much text (max ${MAX_TEXT_CHARS.toLocaleString()} characters) — trim it to the score table.` }, 400);
      content = [{ type: "text", text: `Raw score sheet:\n${text}` }];
      rawSnapshot = text;
    } else if (typeof body.file_base64 === "string" && typeof body.media_type === "string") {
      const mediaType = body.media_type.toLowerCase();
      if (!MEDIA_TYPES.has(mediaType)) return json({ error: `Unsupported file type ${mediaType}.` }, 400);
      const b64 = body.file_base64.replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return json({ error: "File data is not valid base64." }, 400);
      if (b64.length * 0.75 > MAX_FILE_BYTES) return json({ error: "File too large for AI reading (max 8MB)." }, 400);
      content = mediaType === "application/pdf"
        ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }]
        : [{ type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: b64 } }];
      rawSnapshot = `[${mediaType === "application/pdf" ? "scanned PDF" : "photo"}${sourceName ? `: ${sourceName}` : ""} — read by AI]`;
    } else {
      return json({ error: "Send raw_csv text, or file_base64 + media_type." }, 400);
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "AI reading isn't configured (ANTHROPIC_API_KEY secret missing)." }, 500);

    const svc = serviceClient();
    const { data: shooters, error: rosterErr } = await svc.from("rifle_shooters").select("name").order("name");
    if (rosterErr) { console.error("rifle-comp-parse roster", rosterErr); return json({ error: "Couldn't load the roster." }, 500); }
    const roster = (shooters || []).map((s: { name: string }) => s.name);
    content.push({ type: "text", text: `Current roster:\n${roster.length ? roster.join("\n") : "(no shooters on file yet)"}` });

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });
    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        messages: [{ role: "user", content }],
      } as never);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json({ error: "AI is busy — wait a minute and try again." }, 503);
      if (e instanceof Anthropic.BadRequestError) {
        console.error("rifle-comp-parse 400", e.message);
        return json({ error: "AI couldn't read that file (it may be corrupt or unreadable)." }, 400);
      }
      if (e instanceof Anthropic.APIError) {
        console.error("rifle-comp-parse api error", e.status, e.message);
        return json({ error: "AI service error — try again shortly." }, 502);
      }
      throw e;
    }

    // deno-lint-ignore no-explicit-any
    const msg = response as any;
    if (msg.stop_reason === "refusal") return json({ error: "AI declined to read this file. Try a spreadsheet export instead." }, 422);
    if (msg.stop_reason === "max_tokens") return json({ error: "Sheet too long for one AI read — split it and import each part." }, 422);
    const text = (msg.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("rifle-comp-parse: non-JSON response", text.slice(0, 500));
      return json({ error: "AI returned an unexpected format — try again." }, 502);
    }
    const draft = { ...sanitize(parsed, roster), source: { name: sourceName, parser: "ai" } };

    const { data: upload, error: insErr } = await svc
      .from("rifle_comp_uploads")
      .insert({ uploaded_by: caller.email, raw_csv: rawSnapshot, draft, status: "pending_review" })
      .select("*")
      .single();
    if (insErr) { console.error("rifle-comp-parse insert", insErr); return json({ error: "Couldn't save the AI draft." }, 500); }

    return json({ ok: true, upload });
  } catch (e) {
    console.error("rifle-comp-parse", e);
    return json({ error: "Internal error reading the sheet." }, 500);
  }
});
